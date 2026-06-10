import { NextRequest, NextResponse } from "next/server";
import { db, ensureDb, dbErrorResponse, isDbUnavailable, withRetry} from "@/lib/db";
import { withAuth } from "@/lib/auth-middleware";
import { generateInvoiceNumber } from "@/lib/pdf-generator";
import { getCurrencyForCountry } from "@/lib/currency";
import logger from "@/lib/logger";

// PUT /api/admin/subscriptions/[id] - Admin manage subscription (reset, downgrade, extend, ban/unban)
export const PUT = withAuth(async (
  req: NextRequest,
  authCtx,
  { params }: { params: Promise<{ id: string }> }
) => {
  logger.info("[Admin Subscriptions] PUT request", { userId: authCtx.userId });
  try {
    await ensureDb();
    const { id } = await params;
    const body = await req.json();
    const {
      action,
      planName,
      billingCycle,
      extendDays,
      status,
      banReason,
    } = body;

    // ── FIND SUBSCRIPTION ──
    const subscription = await withRetry(async () => {
      return await db.subscription.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true, plan: true, isBanned: true, email: true } },
        plan: { select: { id: true, name: true, price: true, annualPrice: true } },
      },
    })
    }, 2, 500);

    if (!subscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    // ── HANDLE DIFFERENT ACTIONS ──

    // ACTION: Change plan
    if (action === "change_plan") {
      if (!planName) {
        return NextResponse.json({ error: "planName is required for change_plan action" }, { status: 400 });
      }

      const targetPlan = await withRetry(async () => {
        return await db.subscriptionPlan.findUnique({ where: { name: planName } })
      }, 2, 500);
      if (!targetPlan) {
        return NextResponse.json({ error: `Plan "${planName}" not found` }, { status: 404 });
      }

      const cycle = billingCycle || subscription.billingCycle || "monthly";
      const periodDays = cycle === "annually" ? 365 : 30;

      await withRetry(async () => {
        return await db.subscription.update({
        where: { id },
        data: {
          planId: targetPlan.id,
          status: targetPlan.price === 0 ? "active" : (status || subscription.status),
          billingCycle: cycle,
          currentPeriodEnd: targetPlan.price === 0 ? null : new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000),
          reminderCount: 0,
          lastReminderAt: null,
        },
      })
      }, 2, 500);

      await withRetry(async () => {
        return await db.organization.update({
        where: { id: subscription.organization.id },
        data: { plan: planName, isActive: true },
      })
      }, 2, 500);

      await withRetry(async () => {
        return await db.notification.create({
        data: {
          type: "info",
          title: "Plan Updated by Admin",
          message: `Your plan has been changed to ${planName} (${cycle}) by the platform admin.`,
          orgId: subscription.organization.id,
          actionUrl: "/billing",
        },
      })
      }, 2, 500);

      // ── AUTO-GENERATE INVOICE for plan change ──
      if (targetPlan.price > 0) {
        try {
          const org = await withRetry(async () => {
            return await db.organization.findUnique({ where: { id: subscription.organization.id } })
          }, 2, 500);
          const currency = org ? getCurrencyForCountry(org.country || "PK") : { code: "PKR", symbol: "Rs." };
          const invoiceCount = await withRetry(async () => {
            return await db.invoice.count({ where: { organizationId: subscription.organization.id } })
          }, 2, 500);
          const amount = cycle === "annually" ? targetPlan.annualPrice : targetPlan.price;
          const periodEnd = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000);
          await withRetry(async () => {
            return await db.invoice.create({
            data: {
              invoiceNumber: generateInvoiceNumber(invoiceCount),
              organizationId: subscription.organization.id,
              subscriptionId: id,
              planName: planName,
              amount: Number(amount) || 0,
              billingCycle: cycle,
              status: "paid",
              currencyCode: currency.code,
              currencySymbol: currency.symbol,
              issuedAt: new Date(),
              paidAt: new Date(),
              periodStart: new Date(),
              periodEnd,
              orgName: subscription.organization.name,
              orgEmail: org?.email || null,
              orgPhone: org?.phone || null,
              orgAddress: org?.address || null,
              notes: `Plan upgrade/change to ${planName} (${cycle}) - processed by admin.`,
            },
          })
          }, 2, 500);
        } catch (invErr: any) {
          console.warn("[Admin change_plan] Auto-invoice generation failed:", invErr?.message);
        }
      }

      return NextResponse.json({ success: true, message: `Plan changed to ${planName} (${cycle})` });
    }

    // ACTION: Extend subscription period
    if (action === "extend") {
      if (!extendDays || extendDays <= 0) {
        return NextResponse.json({ error: "extendDays must be a positive number" }, { status: 400 });
      }

      const currentEnd = subscription.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd)
        : new Date();
      const baseDate = currentEnd > new Date() ? currentEnd : new Date();
      const newEnd = new Date(baseDate.getTime() + extendDays * 24 * 60 * 60 * 1000);

      await withRetry(async () => {
        return await db.subscription.update({
        where: { id },
        data: {
          currentPeriodEnd: newEnd,
          status: "active",
          reminderCount: 0,
          lastReminderAt: null,
        },
      })
      }, 2, 500);

      await withRetry(async () => {
        return await db.organization.update({
        where: { id: subscription.organization.id },
        data: { isActive: true, plan: subscription.plan.name },
      })
      }, 2, 500);

      await withRetry(async () => {
        return await db.notification.create({
        data: {
          type: "success",
          title: "Subscription Extended",
          message: `Your subscription has been extended by ${extendDays} days. New expiry: ${newEnd.toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" })}`,
          orgId: subscription.organization.id,
          actionUrl: "/billing",
        },
      })
      }, 2, 500);

      // NOTE: Invoice for extension is NOT auto-generated.
      // Admin must manually create/send the invoice from Invoice Management.

      return NextResponse.json({ success: true, message: `Subscription extended by ${extendDays} days` });
    }

    // ACTION: Reset subscription to starter/trial
    if (action === "reset") {
      const starterPlan = await withRetry(async () => {
        return await db.subscriptionPlan.findUnique({ where: { name: "starter" } })
      }, 2, 500);
      if (!starterPlan) {
        return NextResponse.json({ error: "Starter plan not found" }, { status: 500 });
      }

      const now = new Date();
      const trialEnd = new Date(now.getTime() + starterPlan.trialDays * 24 * 60 * 60 * 1000);

      await withRetry(async () => {
        return await db.subscription.update({
        where: { id },
        data: {
          planId: starterPlan.id,
          status: "trial",
          billingCycle: "monthly",
          currentPeriodEnd: null,
          trialStartsAt: now,
          trialEndsAt: trialEnd,
          reminderCount: 0,
          lastReminderAt: null,
        },
      })
      }, 2, 500);

      await withRetry(async () => {
        return await db.organization.update({
        where: { id: subscription.organization.id },
        data: { plan: "starter" },
      })
      }, 2, 500);

      await withRetry(async () => {
        return await db.paymentProof.updateMany({
        where: { subscriptionId: id, status: "pending" },
        data: { status: "rejected", adminNote: "Subscription reset by admin", reviewedBy: authCtx.userId, reviewedAt: now },
      })
      }, 2, 500);

      await withRetry(async () => {
        return await db.notification.create({
        data: {
          type: "info",
          title: "Subscription Reset",
          message: "Your subscription has been reset to the Starter plan with a new trial period by the platform admin.",
          orgId: subscription.organization.id,
          actionUrl: "/billing",
        },
      })
      }, 2, 500);

      return NextResponse.json({ success: true, message: "Subscription reset to Starter plan with new trial" });
    }

    // ACTION: Cancel subscription
    if (action === "cancel") {
      await withRetry(async () => {
        return await db.subscription.update({
        where: { id },
        data: { status: "cancelled" },
      })
      }, 2, 500);

      const starterPlan = await withRetry(async () => {
        return await db.subscriptionPlan.findUnique({ where: { name: "starter" } })
      }, 2, 500);
      if (starterPlan) {
        await withRetry(async () => {
          return await db.subscription.update({
          where: { id },
          data: { planId: starterPlan.id },
        })
        }, 2, 500);
      }

      await withRetry(async () => {
        return await db.organization.update({
        where: { id: subscription.organization.id },
        data: { plan: "starter" },
      })
      }, 2, 500);

      await withRetry(async () => {
        return await db.notification.create({
        data: {
          type: "warning",
          title: "Subscription Cancelled",
          message: "Your subscription has been cancelled by the platform admin. You have been moved to the Starter plan.",
          orgId: subscription.organization.id,
          actionUrl: "/billing",
        },
      })
      }, 2, 500);

      return NextResponse.json({ success: true, message: "Subscription cancelled" });
    }

    // ACTION: Ban organization
    if (action === "ban") {
      if (!banReason) {
        return NextResponse.json({ error: "banReason is required for ban action" }, { status: 400 });
      }

      await withRetry(async () => {
        return await db.organization.update({
        where: { id: subscription.organization.id },
        data: { isBanned: true, banReason, bannedAt: new Date(), isActive: false },
      })
      }, 2, 500);

      await withRetry(async () => {
        return await db.subscription.update({ where: { id }, data: { status: "cancelled" } })
      }, 2, 500);

      await withRetry(async () => {
        return await db.paymentProof.updateMany({
        where: { subscriptionId: id, status: "pending" },
        data: { status: "rejected", adminNote: `Organization banned: ${banReason}`, reviewedBy: authCtx.userId, reviewedAt: new Date() },
      })
      }, 2, 500);

      await withRetry(async () => {
        return await db.notification.create({
        data: {
          type: "error",
          title: "Account Banned",
          message: `Your account has been banned. Reason: ${banReason}. Contact support if you believe this is an error.`,
          orgId: subscription.organization.id,
        },
      })
      }, 2, 500);

      return NextResponse.json({ success: true, message: "Organization banned" });
    }

    // ACTION: Unban organization
    if (action === "unban") {
      await withRetry(async () => {
        return await db.organization.update({
        where: { id: subscription.organization.id },
        data: { isBanned: false, banReason: null, bannedAt: null, isActive: true },
      })
      }, 2, 500);

      await withRetry(async () => {
        return await db.notification.create({
        data: {
          type: "success",
          title: "Account Unbanned",
          message: "Your account has been unbanned by the platform admin. You now have full access.",
          orgId: subscription.organization.id,
        },
      })
      }, 2, 500);

      return NextResponse.json({ success: true, message: "Organization unbanned" });
    }

    // ACTION: Reset rejection count
    if (action === "reset_rejections") {
      await withRetry(async () => {
        return await db.organization.update({
        where: { id: subscription.organization.id },
        data: { paymentRejectionCount: 0 },
      })
      }, 2, 500);
      return NextResponse.json({ success: true, message: "Rejection count reset to 0" });
    }

    // ACTION: Update billing cycle
    if (action === "change_billing_cycle") {
      if (!billingCycle || !["monthly", "annually"].includes(billingCycle)) {
        return NextResponse.json({ error: "billingCycle must be 'monthly' or 'annually'" }, { status: 400 });
      }

      const periodDays = billingCycle === "annually" ? 365 : 30;
      await withRetry(async () => {
        return await db.subscription.update({
        where: { id },
        data: {
          billingCycle,
          currentPeriodEnd: new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000),
          reminderCount: 0,
          lastReminderAt: null,
        },
      })
      }, 2, 500);

      await withRetry(async () => {
        return await db.notification.create({
        data: {
          type: "info",
          title: "Billing Cycle Updated",
          message: `Your billing cycle has been changed to ${billingCycle} by the platform admin.`,
          orgId: subscription.organization.id,
          actionUrl: "/billing",
        },
      })
      }, 2, 500);

      return NextResponse.json({ success: true, message: `Billing cycle changed to ${billingCycle}` });
    }

    return NextResponse.json(
      { error: "Invalid action. Supported: change_plan, extend, reset, cancel, ban, unban, reset_rejections, change_billing_cycle" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Admin subscription management error:", {
      message: error?.message,
      code: error?.code,
    });

    if (isDbUnavailable(error)) {
      return dbErrorResponse(error);
    }

    return NextResponse.json({ error: "Failed to manage subscription" }, { status: 500 });
  }
}, { requireRole: ["admin", "owner", "platform_owner", "platform_admin"], requireOrg: false });
