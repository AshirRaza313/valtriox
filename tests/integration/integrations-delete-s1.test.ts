// tests/integration/integrations-delete-s1.test.ts
// S1 - DELETE /api/integrations security fix verification
// Validates: auth gate, org binding, role gate, platform-user-without-org guard
// Security boundary: withAuth (real) + handler's explicit org guard (real)

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- MOCKS (hoisted before imports) ---

vi.mock("@/lib/db", () => ({
  db: {
    integrationConnection: {
      deleteMany: vi.fn(),
    },
  },
  withRetry: async (fn: () => Promise<unknown>) => fn(),
  isDbUnavailable: () => false,
  dbErrorResponse: () =>
    new Response(JSON.stringify({ error: "db_unavailable" }), { status: 503 }),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// --- IMPORTS (after mocks) ---

import { DELETE } from "@/app/api/integrations/route";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";

// --- HELPERS ---

const mockGetServerSession = vi.mocked(getServerSession);
const mockDeleteMany = vi.mocked(db.integrationConnection.deleteMany);

function makeReq(opts: { id?: string; ip?: string } = {}) {
  const url = new URL("http://localhost/api/integrations");
  if (opts.id !== undefined) url.searchParams.set("id", opts.id);
  return new NextRequest(url, {
    method: "DELETE",
    headers: { "x-forwarded-for": opts.ip ?? "127.0.0.1" },
  });
}

function authAs(
  user: { id?: string; email?: string; role?: string; organizationId?: string } | null,
) {
  mockGetServerSession.mockResolvedValue(
    (user ? { user } : null) as never,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  const g = globalThis as unknown as {
    __valtrioxMemoryStore?: Map<string, unknown>;
  };
  g.__valtrioxMemoryStore?.clear();
});

// --- TESTS ---

describe("S1: DELETE /api/integrations - auth + tenant binding", () => {
  it("1. Unauthenticated request -> 401, deleteMany NOT called", async () => {
    authAs(null);
    const res = await DELETE(makeReq({ id: "int-1" }));
    expect(res.status).toBe(401);
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("2. Authenticated member role -> 403, deleteMany NOT called", async () => {
    authAs({
      id: "u1",
      email: "m@x.com",
      role: "member",
      organizationId: "org-1",
    });
    const res = await DELETE(makeReq({ id: "int-1" }));
    expect(res.status).toBe(403);
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("3. Cross-org ID -> 404, deleteMany scoped to auth org only", async () => {
    authAs({
      id: "u1",
      email: "o@x.com",
      role: "owner",
      organizationId: "org-1",
    });
    mockDeleteMany.mockResolvedValue({ count: 0 } as never);
    const res = await DELETE(makeReq({ id: "int-of-org-2" }));
    expect(res.status).toBe(404);
    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { id: "int-of-org-2", organizationId: "org-1" },
    });
  });

  it("4. Same-org ID -> 200 {success:true}, deleteMany scoped to auth org", async () => {
    authAs({
      id: "u1",
      email: "o@x.com",
      role: "owner",
      organizationId: "org-1",
    });
    mockDeleteMany.mockResolvedValue({ count: 1 } as never);
    const res = await DELETE(makeReq({ id: "int-of-org-1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { id: "int-of-org-1", organizationId: "org-1" },
    });
  });

  it("5. Missing ?id= -> 400, deleteMany NOT called", async () => {
    authAs({
      id: "u1",
      email: "o@x.com",
      role: "owner",
      organizationId: "org-1",
    });
    const res = await DELETE(makeReq({}));
    expect(res.status).toBe(400);
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("6. Platform admin WITHOUT org -> 403 from HANDLER guard (not withAuth), deleteMany NOT called", async () => {
    authAs({
      id: "pu",
      email: "p@x.com",
      role: "platform_admin",
      organizationId: undefined,
    });
    const res = await DELETE(makeReq({ id: "any-int" }));

    // Boundary distinction: platform role bypasses withAuth's requireOrg,
    // so the 403 must originate from the handler's explicit !organizationId
    // guard. Message string proves the source.
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "Organization context required",
    });
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });
});