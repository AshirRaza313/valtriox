import { NextRequest, NextResponse } from "next/server";
import { dbErrorResponse, db, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { withRateLimit } from "@/lib/rate-limit";
import logger from "@/lib/logger";

// GET /api/admin/clients/[id] - Admin-only: return full details for one organization
export const GET = withRateLimit(withAuth(async (req: NextRequest, authCtx, context) => {
  const { id } = await context.params;
  logger.info("[Admin Client Detail] GET request", { userId: authCtx.userId, clientId: id });
  try {
    // Fetch org with counts
    const org = await withRetry(async () => {
      return await db.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            members: true,
            products: true,
            orders: true,
            customers: true,
            expenses: true,
            teamTasks: true,
            coupons: true,
          },
        },
        subscription: {
          include: {
            plan: {
              select: {
                name: true,
                price: true,
                trialDays: true,
              },
            },
          },
        },
      },
    })
    }, 2, 500);

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Revenue aggregation (Prisma can't SUM across relations)
    const revenueRows: any[] = await db.$queryRaw`
      SELECT COALESCE(SUM(total), 0) as total
      FROM "Order"
      WHERE "organizationId" = ${id}
    `;
    const revenueTotal = parseFloat(revenueRows[0]?.total) || 0;

    // Team members with user info
    const teamMembersRaw = await withRetry(async () => {
      return await db.organizationMember.findMany({
      where: { organizationId: id },
      orderBy: { joinedAt: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, image: true } },
      },
    })
    }, 2, 500);

    // Recent orders with customer info
    const recentOrders = await withRetry(async () => {
      return await db.order.findMany({
      where: { organizationId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        customer: { select: { name: true, email: true, phone: true } },
      },
    })
    }, 2, 500);

    // Map recent orders to match the raw SQL shape (customerName, customerEmail, customerPhone as top-level)
    const recentOrdersMapped = recentOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      organizationId: o.organizationId,
      customerId: o.customerId,
      status: o.status,
      subtotal: o.subtotal,
      discount: o.discount,
      total: o.total,
      channel: o.channel,
      courier: o.courier,
      trackingNumber: o.trackingNumber,
      notes: o.notes,
      priority: o.priority,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      customerName: o.customer?.name || null,
      customerEmail: o.customer?.email || null,
      customerPhone: o.customer?.phone || null,
    }));

    // Build team members list
    const teamMembers = teamMembersRaw.map((m, idx) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      image: m.user.image,
      joinedAt: m.joinedAt,
      isOwner: idx === 0,
    }));

    // Build subscription response to match original shape
    const sub = org.subscription;
    const subscription = sub
      ? {
          id: sub.id,
          organizationId: sub.organizationId,
          planId: sub.planId,
          status: sub.status,
          billingCycle: sub.billingCycle,
          trialStartsAt: sub.trialStartsAt,
          trialEndsAt: sub.trialEndsAt,
          currentPeriodEnd: sub.currentPeriodEnd,
          lastReminderAt: sub.lastReminderAt,
          reminderCount: sub.reminderCount,
          createdAt: sub.createdAt,
          updatedAt: sub.updatedAt,
          planName: sub.plan?.name || null,
          price: sub.plan?.price ?? 0,
          trialDays: sub.plan?.trialDays ?? 14,
        }
      : null;

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo: org.logo,
        email: org.email,
        phone: org.phone,
        website: org.website,
        plan: org.plan || "starter",
        currency: org.currency,
        timezone: org.timezone,
        country: org.country,
        religion: (org as any).religion,
        brandTagline: org.brandTagline,
        brandColor: org.brandColor,
        brandDescription: org.brandDescription,
        address: org.address,
        taxId: org.taxId,
        isActive: org.isActive,
        isBanned: org.isBanned || false,
        banReason: org.banReason,
        bannedAt: org.bannedAt,
        paymentRejectionCount: org.paymentRejectionCount || 0,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
      },
      stats: {
        memberCount: org._count?.members || 0,
        productCount: org._count?.products || 0,
        orderCount: org._count?.orders || 0,
        customerCount: org._count?.customers || 0,
        expenseCount: org._count?.expenses || 0,
        taskCount: org._count?.teamTasks || 0,
        couponCount: org._count?.coupons || 0,
        revenueTotal,
      },
      owner:
        teamMembers.length > 0
          ? { id: teamMembers[0].userId, name: teamMembers[0].name, email: teamMembers[0].email, role: teamMembers[0].role }
          : null,
      teamMembers,
      recentOrders: recentOrdersMapped,
      subscription,
    });
  } catch (error: unknown) {
    logger.error("Admin client detail API error:", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to fetch client details", details: undefined }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });

// PUT /api/admin/clients/[id] - Admin-only: manage client (suspend, ban, change plan, etc.)
export const PUT = withRateLimit(withAuth(async (req: NextRequest, authCtx, context) => {
  const { id } = await context.params;
  logger.info("[Admin Client Manage] PUT request", { userId: authCtx.userId, clientId: id });
  try {
    const body = await req.json();
    const { action, ...data } = body;

    // Verify org exists
    const org = await withRetry(async () => {
      return await db.organization.findUnique({ where: { id } })
    }, 2, 500);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Helper: find the first (owner) member for notifications
    const getOwnerMember = async () => {
      const member = await withRetry(async () => {
        return await db.organizationMember.findFirst({
        where: { organizationId: id },
        orderBy: { joinedAt: "asc" },
        select: { userId: true },
      })
      }, 2, 500);
      return member;
    };

    // Helper: create a notification
    const createNotification = async (userId: string, title: string, message: string, type: string) => {
      await withRetry(async () => {
        return await db.notification.create({
        data: {
          orgId: id,
          userId,
          title,
          message,
          type,
        },
      })
      }, 2, 500);
    };

    switch (action) {
      case "suspend": {
        await withRetry(async () => {
          return await db.organization.update({
          where: { id },
          data: { isActive: false },
        })
        }, 2, 500);
        break;
      }
      case "activate": {
        await withRetry(async () => {
          return await db.organization.update({
          where: { id },
          data: { isActive: true },
        })
        }, 2, 500);
        break;
      }
      case "ban": {
        if (!data.banReason) {
          return NextResponse.json({ error: "Ban reason is required" }, { status: 400 });
        }
        await withRetry(async () => {
          return await db.organization.update({
          where: { id },
          data: {
            isBanned: true,
            banReason: data.banReason,
            bannedAt: new Date(),
          },
        })
        }, 2, 500);
        // Notify owner
        const owner = await getOwnerMember();
        if (owner) {
          await createNotification(
            owner.userId,
            "Organization Banned",
            `Your organization "${org.name}" has been banned. Reason: ${data.banReason}.`,
            "warning"
          );
        }
        break;
      }
      case "unban": {
        await withRetry(async () => {
          return await db.organization.update({
          where: { id },
          data: {
            isBanned: false,
            banReason: null,
            bannedAt: null,
          },
        })
        }, 2, 500);
        const owner = await getOwnerMember();
        if (owner) {
          await createNotification(
            owner.userId,
            "Organization Unbanned",
            `Your organization "${org.name}" has been unbanned.`,
            "success"
          );
        }
        break;
      }
      case "change-plan": {
        const validPlans = ["starter", "growth", "professional", "enterprise"];
        if (!data.plan || !validPlans.includes(data.plan)) {
          return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
        }
        await withRetry(async () => {
          return await db.organization.update({
          where: { id },
          data: { plan: data.plan },
        })
        }, 2, 500);
        if (data.planId) {
          await withRetry(async () => {
            return await db.subscription.update({
            where: { organizationId: id },
            data: { planId: data.planId },
          })
          }, 2, 500);
        }
        const owner = await getOwnerMember();
        if (owner) {
          await createNotification(
            owner.userId,
            "Plan Changed",
            `Your plan has been changed to ${data.plan}.`,
            "info"
          );
        }
        break;
      }
      case "update-info": {
        const updateData: Record<string, any> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.email !== undefined) updateData.email = data.email;
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.website !== undefined) updateData.website = data.website;
        if (Object.keys(updateData).length === 0) {
          return NextResponse.json({ error: "No fields to update" }, { status: 400 });
        }
        await withRetry(async () => {
          return await db.organization.update({
          where: { id },
          data: updateData,
        })
        }, 2, 500);
        break;
      }
      case "send-notification": {
        if (!data.title || !data.message) {
          return NextResponse.json({ error: "Notification title and message are required" }, { status: 400 });
        }
        const owner = await getOwnerMember();
        if (!owner) return NextResponse.json({ error: "No owner found" }, { status: 404 });
        await createNotification(owner.userId, data.title, data.message, data.type || "info");
        return NextResponse.json({ success: true, message: "Notification sent" });
      }
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: `Action "${action}" completed` });
  } catch (error: unknown) {
    logger.error("Admin client manage API error:", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to manage client", details: undefined }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });

// DELETE /api/admin/clients/[id] - Admin-only: permanently delete a client and all associated data
export const DELETE = withRateLimit(withAuth(async (req: NextRequest, authCtx, context) => {
  const { id } = await context.params;
  logger.info("[Admin Client Delete] DELETE request", { userId: authCtx.userId, clientId: id });
  try {
    // Verify org exists
    const org = await withRetry(async () => {
      return await db.organization.findUnique({ where: { id } })
    }, 2, 500);
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Prevent deleting admin's own organization
    const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
    if (org.email && org.email.toLowerCase() === adminEmail) {
      return NextResponse.json({ error: "Cannot delete the platform admin's organization" }, { status: 400 });
    }

    // Get user IDs for cleanup
    const members = await withRetry(async () => {
      return await db.organizationMember.findMany({
      where: { organizationId: id },
      select: { userId: true },
    })
    }, 2, 500);
    const userIds = members.map((m) => m.userId);

    // Delete in FK-safe order inside a transaction (prevents partial deletion on failure)
    await db.$transaction(async (tx) => {
      // 1. Support messages (via conversation)
      await tx.$executeRaw`DELETE FROM "SupportMessage" WHERE "conversationId" IN (SELECT id FROM "SupportConversation" WHERE "organizationId" = ${id})`;
      await tx.$executeRaw`DELETE FROM "SupportConversation" WHERE "organizationId" = ${id}`;

      // 2. Notifications
      await tx.$executeRaw`DELETE FROM "Notification" WHERE "orgId" = ${id}`;

      // 3. Payment proofs
      await tx.$executeRaw`DELETE FROM "PaymentProof" WHERE "subscriptionId" IN (SELECT id FROM "Subscription" WHERE "organizationId" = ${id})`;

      // 4. Invoices
      await tx.$executeRaw`DELETE FROM "Invoice" WHERE "organizationId" = ${id}`;

      // 5. Subscriptions
      await tx.$executeRaw`DELETE FROM "Subscription" WHERE "organizationId" = ${id}`;

      // 6. Team invitations
      await tx.$executeRaw`DELETE FROM "TeamInvitation" WHERE "organizationId" = ${id}`;

      // 7. Order items + orders
      await tx.$executeRaw`DELETE FROM "OrderItem" WHERE "orderId" IN (SELECT id FROM "Order" WHERE "organizationId" = ${id})`;
      await tx.$executeRaw`DELETE FROM "Order" WHERE "organizationId" = ${id}`;

      // 8. Organization members
      await tx.$executeRaw`DELETE FROM "OrganizationMember" WHERE "organizationId" = ${id}`;

      // 9. Customers
      await tx.$executeRaw`DELETE FROM "Customer" WHERE "organizationId" = ${id}`;

      // 10. Products
      await tx.$executeRaw`DELETE FROM "Product" WHERE "organizationId" = ${id}`;

      // 11. Expenses
      await tx.$executeRaw`DELETE FROM "Expense" WHERE "organizationId" = ${id}`;

      // 12. Team tasks
      await tx.$executeRaw`DELETE FROM "TeamTask" WHERE "organizationId" = ${id}`;

      // 13. Coupons
      await tx.$executeRaw`DELETE FROM "Coupon" WHERE "organizationId" = ${id}`;

      // 14. Attendance
      await tx.$executeRaw`DELETE FROM "Attendance" WHERE "organizationId" = ${id}`;

      // 15. Finally, delete the organization
      await tx.$executeRaw`DELETE FROM "Organization" WHERE id = ${id}`;

      // 16. Delete brand users (not admin)
      if (userIds.length > 0) {
        await tx.$executeRaw`DELETE FROM "User" WHERE id = ANY(${userIds}::text[]) AND role IN ('brand_owner', 'member') AND LOWER(email) != ${adminEmail}`;
      }
    }, { timeout: 30000 });

    logger.info("[Admin Client Delete] Client fully deleted", {
      adminId: authCtx.userId,
      deletedOrgId: id,
      deletedOrgName: org.name,
    });

    return NextResponse.json({
      success: true,
      message: `Client "${org.name}" and all associated data have been permanently deleted`,
    });
  } catch (error: unknown) {
    logger.error("Admin client delete API error:", error);
    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }
    return NextResponse.json({ error: "Failed to delete client", details: undefined }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false }), { maxRequests: 30, windowSeconds: 60 });
