import { NextRequest, NextResponse } from "next/server";
import { db, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { sanitizeObject } from "@/lib/sanitize";
import logger from "@/lib/logger";
import { withRateLimit } from "@/lib/rate-limit";
import { createBroadcastSchema } from "@/lib/validations/schemas";

interface Broadcast {
  id: string;
  name: string;
  channel: "whatsapp" | "email" | "sms";
  status: "draft" | "scheduled" | "sent" | "failed";
  targetAudience: "all" | "vip" | "new" | "inactive" | "segment";
  message: string;
  scheduledAt?: string;
  sentAt?: string;
  recipientCount: number;
  openRate: number;
  clickRate: number;
  createdAt: string;
}

async function getBroadcasts(orgId: string): Promise<Broadcast[]> {
  const setting = await withRetry(async () => {
    return await db.systemSetting.findUnique({
    where: { key: `broadcasts-${orgId}` },
  })
  }, 2, 500);
  if (!setting) return [];
  try {
    return JSON.parse(setting.value);
  } catch {
    return [];
  }
}

async function saveBroadcasts(orgId: string, broadcasts: Broadcast[]) {
  await withRetry(async () => {
    return await db.systemSetting.upsert({
    where: { key: `broadcasts-${orgId}` },
    create: { key: `broadcasts-${orgId}`, value: JSON.stringify(broadcasts), category: "broadcasts" },
    update: { value: JSON.stringify(broadcasts) },
  })
  }, 2, 500);
}

export const GET = withRateLimit(withAuth(async (req, authCtx) => {
  try {
    const orgId = authCtx.organizationId;
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const broadcasts = await getBroadcasts(orgId);
    return NextResponse.json({ broadcasts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Broadcasts GET error", message, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to fetch broadcasts" }, { status: 500 });
  }
}), { maxRequests: 60, windowSeconds: 60 });

export const POST = withRateLimit(withAuth(async (req, authCtx) => {
  try {
    const orgId = authCtx.organizationId;
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const body = await req.json();
    Object.assign(body, sanitizeObject(body));
    // Phase 6: Zod validation
    const parseResult = createBroadcastSchema.safeParse(body);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(", ");
      return NextResponse.json({ error: `Validation failed: ${errors}` }, { status: 422 });
    }
    const { name, channel, targetAudience, message, scheduledAt, status } = body;

    if (!name?.trim() || !message?.trim()) {
      return NextResponse.json({ error: "Name and message are required" }, { status: 400 });
    }

    const broadcasts = await getBroadcasts(orgId);
    const newBroadcast: Broadcast = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name: name.trim(),
      channel: channel || "whatsapp",
      status: status || "draft",
      targetAudience: targetAudience || "all",
      message: message.trim(),
      scheduledAt: scheduledAt || undefined,
      recipientCount: 0,
      openRate: 0,
      clickRate: 0,
      createdAt: new Date().toISOString(),
    };
    broadcasts.unshift(newBroadcast);
    await saveBroadcasts(orgId, broadcasts);

    return NextResponse.json({ broadcast: newBroadcast }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Broadcasts POST error", message, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to create broadcast" }, { status: 500 });
  }
}), { maxRequests: 5, windowSeconds: 60 });

export const PUT = withRateLimit(withAuth(async (req, authCtx) => {
  try {
    const orgId = authCtx.organizationId;
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const body = await req.json();
    Object.assign(body, sanitizeObject(body));
    const { id, ...updates } = body;

    if (!id) return NextResponse.json({ error: "Broadcast ID required" }, { status: 400 });

    const broadcasts = await getBroadcasts(orgId);
    const idx = broadcasts.findIndex((b) => b.id === id);
    if (idx === -1) return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });

    broadcasts[idx] = { ...broadcasts[idx], ...updates };
    await saveBroadcasts(orgId, broadcasts);

    return NextResponse.json({ broadcast: broadcasts[idx] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Broadcasts PUT error", message, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to update broadcast" }, { status: 500 });
  }
}), { maxRequests: 30, windowSeconds: 60 });

export const DELETE = withRateLimit(withAuth(async (req, authCtx) => {
  try {
    const orgId = authCtx.organizationId;
    if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Broadcast ID required" }, { status: 400 });

    const broadcasts = await getBroadcasts(orgId);
    const filtered = broadcasts.filter((b) => b.id !== id);
    if (filtered.length === broadcasts.length) {
      return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });
    }
    await saveBroadcasts(orgId, filtered);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Broadcasts DELETE error", message, { orgId: authCtx?.organizationId });
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to delete broadcast" }, { status: 500 });
  }
}), { maxRequests: 30, windowSeconds: 60 });
