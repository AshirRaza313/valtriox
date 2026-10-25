/**
 * S4 - Security tests: /api/admin/clients/* must be platform-only.
 *
 * Proves that org-level owner/admin roles are rejected (the S4 defect)
 * and that valtriox_team is denied (Option C) while platform_owner is allowed
 * everywhere and platform_admin is allowed on non-DELETE gates only.
 */

/**
 * SCOPE (S4, Option C, PATH 2-full):
 *  - Denial paths: fully proven (org roles 403, unauth 401,
 *    valtriox_team 403, platform_admin 403 on DELETE only).
 *  - Allowed paths: exact 200 asserted with realistic mock
 *    shapes. GET /clients also asserts _dbError undefined.
 *  - NOT in scope: real-DB integration, business flow
 *    correctness beyond auth gate + operation success.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';

// -- Mocks (must be declared before imports of code under test) --------------

vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('mock-hashed-password'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/lib/db', () => {
  const now = new Date();

  const mockOrg = {
    id: 'test-org-id', name: 'Test Org', slug: 'test-org',
    logo: null, email: 'test@example.com', phone: null, website: null,
    plan: 'starter', currency: 'PKR', timezone: 'UTC', country: null,
    religion: null, brandTagline: null, brandColor: null, brandDescription: null,
    address: null, taxId: null, isActive: true, isBanned: false,
    banReason: null, bannedAt: null, paymentRejectionCount: 0, industry: null,
    createdAt: now, updatedAt: now,
    _count: { members: 1, products: 0, orders: 0, customers: 0, expenses: 0, teamTasks: 0, coupons: 0 },
    subscription: {
      id: 'mock-sub-id', organizationId: 'test-org-id',
      planId: 'mock-plan-id', status: 'active', billingCycle: 'monthly',
      trialStartsAt: null, trialEndsAt: null, currentPeriodEnd: now,
      lastReminderAt: null, reminderCount: 0,
      createdAt: now, updatedAt: now,
      plan: { name: 'starter', price: 0, trialDays: 0 },
    },
  };

  const mockMember = {
    id: 'mock-member-id', organizationId: 'test-org-id',
    userId: 'mock-owner-user-id', role: 'brand_owner', joinedAt: now,
    user: { id: 'mock-owner-user-id', name: 'Mock Owner', email: 'owner@example.com',
            role: 'brand_owner', image: null },
  };

  const mockUser = { id: 'mock-new-user-id', name: 'New User',
                     email: 'new@example.com', role: 'brand_owner', image: null,
                     createdAt: now, updatedAt: now };

  const mockNotification = { id: 'mock-notif-id', organizationId: 'test-org-id',
                             userId: 'mock-owner-user-id', title: 'Test',
                             message: 'Test', type: 'info', createdAt: now };

  const mockRawRow = {
    organizationId: 'test-org-id', total: '0', count: 0,
    subtotal: '0', discount: '0', createdAt: now.toISOString(),
  };

  const makeEmptyModel = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    findFirst: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    groupBy: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(null),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    createMany: vi.fn().mockResolvedValue({ count: 0 }),
    aggregate: vi.fn().mockResolvedValue({ _count: 0, _sum: {} }),
  });

  const organizationModel = makeEmptyModel();
  organizationModel.findMany = vi.fn().mockResolvedValue([mockOrg]);
  organizationModel.findUnique = vi.fn().mockResolvedValue(mockOrg);
  organizationModel.create = vi.fn().mockResolvedValue(mockOrg);
  organizationModel.update = vi.fn().mockResolvedValue(mockOrg);
  organizationModel.delete = vi.fn().mockResolvedValue(mockOrg);

  const orgMemberModel = makeEmptyModel();
  orgMemberModel.findMany = vi.fn().mockResolvedValue([mockMember]);
  orgMemberModel.findFirst = vi.fn().mockResolvedValue(mockMember);
  orgMemberModel.create = vi.fn().mockResolvedValue(mockMember);

  const userModel = makeEmptyModel();
  userModel.findUnique = vi.fn().mockResolvedValue(null);
  userModel.create = vi.fn().mockResolvedValue(mockUser);
  userModel.delete = vi.fn().mockResolvedValue(mockUser);

  const subscriptionModel = makeEmptyModel();
  const subscriptionPlanModel = makeEmptyModel();
  const notificationModel = makeEmptyModel();
  notificationModel.create = vi.fn().mockResolvedValue(mockNotification);
  const leadModel = makeEmptyModel();
  const orderModel = makeEmptyModel();

  const txProxy = { $executeRaw: vi.fn().mockResolvedValue(1) };

  const dbProxy = {
    organization: organizationModel,
    organizationMember: orgMemberModel,
    order: orderModel,
    user: userModel,
    subscriptionPlan: subscriptionPlanModel,
    subscription: subscriptionModel,
    notification: notificationModel,
    lead: leadModel,
    $queryRaw: vi.fn().mockResolvedValue([mockRawRow]),
    $executeRaw: vi.fn().mockResolvedValue(1),
    $transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(txProxy)),
  };

  return {
    db: dbProxy,
    isDbUnavailable: () => false,
    isSchemaError: () => false,
    withRetry: (fn: () => Promise<unknown>) => fn(),
    ensureDb: vi.fn().mockResolvedValue(true),
    dbErrorResponse: vi.fn().mockImplementation(
      () => new Response(JSON.stringify({ error: 'DB unavailable' }), { status: 503 })
    ),
  };
});

// -- Imports after mocks -----------------------------------------------------

import { signAuthData } from '@/lib/auth-middleware';
import * as clientsRoute from '@/app/api/admin/clients/route';
import * as clientDetailRoute from '@/app/api/admin/clients/[id]/route';
import * as clientOrdersRoute from '@/app/api/admin/clients/[id]/orders/route';

// -- Test helpers ------------------------------------------------------------

const ORIGINAL_ENV = {
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
};

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = 's4-vitest-secret-do-not-use-in-prod';
  process.env.ADMIN_EMAIL = 'nobody@example.com';
});

afterAll(() => {
  if (ORIGINAL_ENV.NEXTAUTH_SECRET !== undefined) {
    process.env.NEXTAUTH_SECRET = ORIGINAL_ENV.NEXTAUTH_SECRET;
  } else {
    delete process.env.NEXTAUTH_SECRET;
  }
  if (ORIGINAL_ENV.ADMIN_EMAIL !== undefined) {
    process.env.ADMIN_EMAIL = ORIGINAL_ENV.ADMIN_EMAIL;
  } else {
    delete process.env.ADMIN_EMAIL;
  }
});

let ipCounter = 0;
function uniqueIp(): string {
  ipCounter += 1;
  return `10.${(ipCounter >> 16) & 0xff}.${(ipCounter >> 8) & 0xff}.${ipCounter & 0xff}`;
}

interface BuildReqOpts {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  role?: string;
  body?: unknown;
}

function buildReq(opts: BuildReqOpts): NextRequest {
  const headers: Record<string, string> = {
    'x-forwarded-for': uniqueIp(),
    'content-type': 'application/json',
  };

  if (opts.role) {
    const userId = `user-${randomUUID()}`;
    const email = `${opts.role}@test.example`;
    const organizationId = 'test-org-s4';
    const sig = signAuthData({ userId, email, role: opts.role, organizationId });
    headers.cookie = [
      `vt-user-id=${userId}`,
      `vt-user-email=${email}`,
      `vt-user-role=${opts.role}`,
      `vt-org-id=${organizationId}`,
      `vt-auth-sig=${sig}`,
    ].join('; ');
  }

  return new NextRequest(opts.url, {
    method: opts.method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

type Handler = (
  req: NextRequest,
  ctx?: { params: Promise<Record<string, string>> },
) => Promise<Response>;

const dynamicCtx = { params: Promise.resolve({ id: 'test-client-id' }) };

interface RouteCase {
  label: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  handler: Handler;
  ctx?: { params: Promise<Record<string, string>> };
  body?: unknown;
  allowedRoles: string[];
  deniedRoles: string[];
  checkDbError?: boolean;
}

const DENIED_ALWAYS = ['owner', 'admin', 'brand_owner', 'member', 'viewer', 'valtriox_team'];
const ALLOWED_TIER1 = ['platform_owner', 'platform_admin'];
const ALLOWED_TIER2 = ['platform_owner'];

const ROUTES: RouteCase[] = [
  {
    label: 'GET  /api/admin/clients',
    method: 'GET',
    url: 'http://localhost/api/admin/clients',
    handler: clientsRoute.GET as unknown as Handler,
    allowedRoles: ALLOWED_TIER1,
    deniedRoles: DENIED_ALWAYS,
    checkDbError: true,
  },
  {
    label: 'POST /api/admin/clients',
    method: 'POST',
    url: 'http://localhost/api/admin/clients',
    handler: clientsRoute.POST as unknown as Handler,
    body: { name: 'Test User', email: 'new@example.com', password: 'password123', brandName: 'Test Brand' },
    allowedRoles: ALLOWED_TIER1,
    deniedRoles: DENIED_ALWAYS,
  },
  {
    label: 'GET  /api/admin/clients/[id]',
    method: 'GET',
    url: 'http://localhost/api/admin/clients/test-client-id',
    handler: clientDetailRoute.GET as unknown as Handler,
    ctx: dynamicCtx,
    allowedRoles: ALLOWED_TIER1,
    deniedRoles: DENIED_ALWAYS,
  },
  {
    label: 'PUT  /api/admin/clients/[id]',
    method: 'PUT',
    url: 'http://localhost/api/admin/clients/test-client-id',
    handler: clientDetailRoute.PUT as unknown as Handler,
    ctx: dynamicCtx,
    body: { action: 'suspend' },
    allowedRoles: ALLOWED_TIER1,
    deniedRoles: DENIED_ALWAYS,
  },
  {
    label: 'DEL  /api/admin/clients/[id]',
    method: 'DELETE',
    url: 'http://localhost/api/admin/clients/test-client-id',
    handler: clientDetailRoute.DELETE as unknown as Handler,
    ctx: dynamicCtx,
    allowedRoles: ALLOWED_TIER2,
    deniedRoles: [...DENIED_ALWAYS, 'platform_admin'],
  },
  {
    label: 'GET  /api/admin/clients/[id]/orders',
    method: 'GET',
    url: 'http://localhost/api/admin/clients/test-client-id/orders',
    handler: clientOrdersRoute.GET as unknown as Handler,
    ctx: dynamicCtx,
    allowedRoles: ALLOWED_TIER1,
    deniedRoles: DENIED_ALWAYS,
  },
];

// -- Tests -------------------------------------------------------------------

describe.each(ROUTES)('$label', (route) => {
  describe.each(route.deniedRoles)('role=%s -> blocked', (role) => {
    it('returns 403', async () => {
      const res = await route.handler(
        buildReq({ method: route.method, url: route.url, role, body: route.body }),
        route.ctx,
      );
      expect(res.status).toBe(403);
    });
  });

  it('unauthenticated -> 401', async () => {
    const res = await route.handler(
      buildReq({ method: route.method, url: route.url, body: route.body }),
      route.ctx,
    );
    expect(res.status).toBe(401);
  });

  describe.each(route.allowedRoles)('role=%s -> allowed', (role) => {
    it('returns 200', async () => {
      const res = await route.handler(
        buildReq({ method: route.method, url: route.url, role, body: route.body }),
        route.ctx,
      );
      expect(res.status).toBe(200);
      if (route.checkDbError) {
        const bodyJson = await res.clone().json();
        expect(bodyJson._dbError).toBeUndefined();
      }
    });
  });
});