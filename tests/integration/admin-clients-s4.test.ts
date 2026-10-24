/**
 * S4 - Security tests: /api/admin/clients/* must be platform-only.
 *
 * Proves that org-level `owner`/`admin` roles are rejected (the S4 defect)
 * and that `valtriox_team` (internal staff) is admitted (business decision).
 *
 * Scope A: negative-path only. Positive-path 200 responses are deferred to S4.1.
 * DB is mocked to fail -> handlers return 5xx on positive path -> we assert
 * "not 401 / not 403" rather than "200", which is the correct security gate.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';

// -- Mocks (must be declared before imports of code under test) --------------

vi.mock('next-auth', () => ({
  // Force cookie-auth path in getAuthContext
  getServerSession: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/auth', () => ({
  // Passed to getServerSession; ignored by mock. Prevents @/lib/auth side-effects.
  authOptions: {},
}));

vi.mock('@/lib/db', () => {
  // Any DB method call rejects. Handlers catch -> return 5xx on positive path.
  const reject = vi.fn().mockRejectedValue(new Error('DB mocked for S4 test'));
  const proxy: unknown = new Proxy(
    {},
    { get: () => new Proxy({}, { get: () => reject }) },
  );
  return {
    db: proxy,
    isDbUnavailable: () => true,
    isSchemaError: () => false,
    withRetry: (fn: () => Promise<unknown>) => fn(),
    ensureDb: vi.fn().mockResolvedValue(undefined),
  };
});

// -- Imports after mocks -----------------------------------------------------

import { signAuthData } from '@/lib/auth-middleware';
import * as clientsRoute from '@/app/api/admin/clients/route';
import * as clientDetailRoute from '@/app/api/admin/clients/[id]/route';
import * as clientOrdersRoute from '@/app/api/admin/clients/[id]/orders/route';

// -- Test helpers -----------------------------------------------------------

beforeAll(() => {
  // signAuthData throws if NEXTAUTH_SECRET is missing.
  process.env.NEXTAUTH_SECRET = 's4-vitest-secret-do-not-use-in-prod';
});

let ipCounter = 0;
function uniqueIp(): string {
  ipCounter += 1;
  // Unique IP per request -> own rate-limit bucket -> no 429 contamination
  return `10.${(ipCounter >> 16) & 0xff}.${(ipCounter >> 8) & 0xff}.${ipCounter & 0xff}`;
}

interface BuildReqOpts {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  role?: string; // undefined -> no auth cookies at all
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
    const sig = signAuthData({
      userId,
      email,
      role: opts.role,
      organizationId,
    });
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
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  handler: Handler;
  ctx?: { params: Promise<Record<string, string>> };
  body?: unknown;
}

const ROUTES: RouteCase[] = [
  {
    label: 'GET  /api/admin/clients',
    url: 'http://localhost/api/admin/clients',
    method: 'GET',
    handler: clientsRoute.GET as unknown as Handler,
  },
  {
    label: 'POST /api/admin/clients',
    url: 'http://localhost/api/admin/clients',
    method: 'POST',
    handler: clientsRoute.POST as unknown as Handler,
    body: {},
  },
  {
    label: 'GET  /api/admin/clients/[id]',
    url: 'http://localhost/api/admin/clients/test-client-id',
    method: 'GET',
    handler: clientDetailRoute.GET as unknown as Handler,
    ctx: dynamicCtx,
  },
  {
    label: 'PUT  /api/admin/clients/[id]',
    url: 'http://localhost/api/admin/clients/test-client-id',
    method: 'PUT',
    handler: clientDetailRoute.PUT as unknown as Handler,
    ctx: dynamicCtx,
    body: {},
  },
  {
    label: 'DEL  /api/admin/clients/[id]',
    url: 'http://localhost/api/admin/clients/test-client-id',
    method: 'DELETE',
    handler: clientDetailRoute.DELETE as unknown as Handler,
    ctx: dynamicCtx,
  },
  {
    label: 'GET  /api/admin/clients/[id]/orders',
    url: 'http://localhost/api/admin/clients/test-client-id/orders',
    method: 'GET',
    handler: clientOrdersRoute.GET as unknown as Handler,
    ctx: dynamicCtx,
  },
];

const DENIED_ROLES = ['owner', 'admin', 'brand_owner', 'member', 'viewer'];
const ALLOWED_ROLES = ['platform_owner', 'platform_admin', 'valtriox_team'];

// -- Tests ------------------------------------------------------------------

describe.each(ROUTES)('S4: $label', ({ url, method, handler, ctx, body }) => {
  describe.each(DENIED_ROLES)('role=%s -> blocked', (role) => {
    it('returns 403', async () => {
      const res = await handler(buildReq({ method, url, role, body }), ctx);
      expect(res.status).toBe(403);
    });
  });

  it('unauthenticated -> 401', async () => {
    const res = await handler(buildReq({ method, url, body }), ctx);
    expect(res.status).toBe(401);
  });

  describe.each(ALLOWED_ROLES)('role=%s -> allowed', (role) => {
    it('passes auth gate (not 401/403)', async () => {
      const res = await handler(buildReq({ method, url, role, body }), ctx);
      expect([401, 403]).not.toContain(res.status);
    });
  });
});
