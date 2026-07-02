import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { sanitizeObject } from "@/lib/sanitize";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";
import { createFlashSaleSchema } from "@/lib/validations/schemas";

interface FlashSale {
  id: string;
  name: string;
  description: string;
  productId?: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  startAt: string;
  endAt: string;
  status: "draft" | "active" | "expired" | "cancelled";
  viewerCount: number;
  redemptionCount: number;
  maxRedemptions?: number;
  createdAt: string;
}

async function getFlashSales(orgId: string): Promise<FlashSale[]> {
  const setting = await withRetry(async () => {
    return await db.systemSetting.findUnique({
    where: { key: `flash-sales-${orgId}` },
  })
  }, 2, 500);
  if (!setting) return [];
  try {
    return JSON.parse(setting.value);
  } catch {
    return [];
  }
}

async function saveFlashSales(orgId: string, sales: FlashSale[]) {
  await withRetry(async () => {
    return await db.systemSetting.upsert({
    where: { key: `flash-sales-${orgId}` },
    create: { key: `flash-sales-${orgId}`, value: JSON.stringify(sales), category: "flash-sales" },
    update: { value: JSON.stringify(sales) },
  })
  }, 2, 500);
}

function updateSaleStatuses(sales: FlashSale[]): FlashSale[] {
  const now = new Date();
  return sales.map((sale) => {
    if (sale.status === "active" && new Date(sale.endAt) < now) {
      return { ...sale, status: "expired" as const };
    }
    if (sale.status === "draft" && new Date(sale.startAt) <= now && new Date(sale.endAt) > now) {
      return { ...sale, status: "active" as const };
    }
    return sale;
  });
}

export const GET = withRateLimit(withAuth(async (req, authCtx) => {
  try {
    const orgId = authCtx.organizationId;
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    let sales = await getFlashSales(orgId);
    sales = updateSaleStatuses(sales);
    await saveFlashSales(orgId, sales);

    return NextResponse.json({ flashSales: sales });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("FlashSales GET error", message, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to fetch flash sales" }, { status: 500 });
  }
}), { maxRequests: 60, windowSeconds: 60 });

export const POST = withRateLimit(withAuth(async (req, authCtx) => {
  try {
    const orgId = authCtx.organizationId;
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const body = await req.json();
    Object.assign(body, sanitizeObject(body));
    // Phase 6: Zod validation
    const parseResult = createFlashSaleSchema.safeParse(body);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(", ");
      return NextResponse.json({ error: `Validation failed: ${errors}` }, { status: 422 });
    }
    const { name, description, productId, discountType, discountValue, startAt, endAt, maxRedemptions } = body;

    if (!name?.trim() || !startAt || !endAt) {
      return NextResponse.json({ error: "Name, start date, and end date are required" }, { status: 400 });
    }
    if (new Date(endAt) <= new Date(startAt)) {
      return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
    }

    const sales = await getFlashSales(orgId);
    const now = new Date();
    const newSale: FlashSale = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name: name.trim(),
      description: (description || "").trim(),
      productId: productId || undefined,
      discountType: discountType || "percentage",
      discountValue: parseFloat(discountValue) || 0,
      startAt,
      endAt,
      status: new Date(startAt) <= now ? "active" : "draft",
      viewerCount: 0,
      redemptionCount: 0,
      maxRedemptions: maxRedemptions ? parseInt(maxRedemptions) : undefined,
      createdAt: new Date().toISOString(),
    };
    sales.unshift(newSale);
    await saveFlashSales(orgId, sales);

    return NextResponse.json({ flashSale: newSale }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("FlashSales POST error", message, { orgCtx: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to create flash sale" }, { status: 500 });
  }
}), { maxRequests: 10, windowSeconds: 60 });

export const PUT = withRateLimit(withAuth(async (req, authCtx) => {
  try {
    const orgId = authCtx.organizationId;
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const body = await req.json();
    Object.assign(body, sanitizeObject(body));
    const { id, ...updates } = body;

    if (!id) return NextResponse.json({ error: "Flash sale ID required" }, { status: 400 });

    const sales = await getFlashSales(orgId);
    const idx = sales.findIndex((s) => s.id === id);
    if (idx === -1) return NextResponse.json({ error: "Flash sale not found" }, { status: 404 });

    sales[idx] = { ...sales[idx], ...updates };
    await saveFlashSales(orgId, sales);

    return NextResponse.json({ flashSale: sales[idx] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("FlashSales PUT error", message, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to update flash sale" }, { status: 500 });
  }
}), { maxRequests: 30, windowSeconds: 60 });

export const DELETE = withRateLimit(withAuth(async (req, authCtx) => {
  try {
    const orgId = authCtx.organizationId;
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Flash sale ID required" }, { status: 400 });

    const sales = await getFlashSales(orgId);
    const filtered = sales.filter((s) => s.id !== id);
    if (filtered.length === sales.length) {
      return NextResponse.json({ error: "Flash sale not found" }, { status: 404 });
    }
    await saveFlashSales(orgId, filtered);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("FlashSales DELETE error", message, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to delete flash sale" }, { status: 500 });
  }
}), { maxRequests: 30, windowSeconds: 60 });
