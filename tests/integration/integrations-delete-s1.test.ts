// tests/integration/integrations-delete-s1.test.ts
// S1 - DELETE /api/integrations security fix verification
// Validates: auth gate, fresh membership check, canonical role allowlist,
// platform-without-org guard, rate limit, and tenant binding.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- MOCKS (hoisted before imports) ---

vi.mock("@/lib/db", () => ({
  db: {
    integrationConnection: {
      deleteMany: vi.fn(),
    },
    organizationMember: {
      findUnique: vi.fn(),
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
const mockFindUnique = vi.mocked(db.organizationMember.findUnique);

function makeReq(opts: { id?: string; ip?: string } = {}) {
  const url = new URL("http://localhost/api/integrations");
  if (opts.id !== undefined) url.searchParams.set("id", opts.id);
  return new NextRequest(url, {
    method: "DELETE",
    headers: { "x-forwarded-for": opts.ip ?? "127.0.0.1" },
  });
}

function authAs(
  user: {
    id?: string;
    email?: string;
    role?: string;
    organizationId?: string;
  } | null,
) {
  mockGetServerSession.mockResolvedValue((user ? { user } : null) as never);
}

function memberAs(member: { role: string; penaltyUntil: Date | null } | null) {
  mockFindUnique.mockResolvedValue(member as never);
}

const VALID_OWNER = { role: "owner", penaltyUntil: null as Date | null };

beforeEach(() => {
  vi.clearAllMocks();
  // Default: valid owner membership row for tests that don't override
  memberAs(VALID_OWNER);
  // Clear rate-limit singleton so tests don't share counters
  const g = globalThis as unknown as {
    __valtrioxMemoryStore?: Map<string, unknown>;
  };
  g.__valtrioxMemoryStore?.clear();
});

// --- TESTS ---

describe("S1: DELETE /api/integrations - auth + tenant binding", () => {
  // --- Baseline (Round 1) ---

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
    memberAs({ role: "member", penaltyUntil: null });
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

  it("6. Platform admin WITHOUT org -> 403 platform-bypass message", async () => {
    authAs({
      id: "pu",
      email: "p@x.com",
      role: "platform_admin",
      organizationId: undefined,
    });
    const res = await DELETE(makeReq({ id: "any-int" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "Platform role requires organization context for this mutation",
    });
    expect(mockDeleteMany).not.toHaveBeenCalled();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  // --- Round 2 additions ---

  it("7. Removed member (no DB row) -> 403, deleteMany NOT called", async () => {
    authAs({
      id: "u1",
      email: "o@x.com",
      role: "owner",
      organizationId: "org-1",
    });
    memberAs(null);
    const res = await DELETE(makeReq({ id: "int-1" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "Organization context required",
    });
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("8. Demoted member (DB role=member, session=owner) -> 403", async () => {
    authAs({
      id: "u1",
      email: "o@x.com",
      role: "owner",
      organizationId: "org-1",
    });
    memberAs({ role: "member", penaltyUntil: null });
    const res = await DELETE(makeReq({ id: "int-1" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Insufficient permissions" });
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("8b. Migration case (session owner, DB brand_owner) -> 200", async () => {
    authAs({
      id: "u1",
      email: "o@x.com",
      role: "owner",
      organizationId: "org-1",
    });
    memberAs({ role: "brand_owner", penaltyUntil: null });
    mockDeleteMany.mockResolvedValue({ count: 1 } as never);
    const res = await DELETE(makeReq({ id: "int-1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
  });

  it("9. Penalized member (penaltyUntil future) -> 403", async () => {
    authAs({
      id: "u1",
      email: "o@x.com",
      role: "owner",
      organizationId: "org-1",
    });
    memberAs({
      role: "owner",
      penaltyUntil: new Date(Date.now() + 86400000),
    });
    const res = await DELETE(makeReq({ id: "int-1" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "Organization context required",
    });
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("9b. Org-changed user (no DB row for session org) -> 403", async () => {
    authAs({
      id: "u1",
      email: "o@x.com",
      role: "owner",
      organizationId: "org-X",
    });
    memberAs(null);
    const res = await DELETE(makeReq({ id: "int-1" }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "Organization context required",
    });
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: {
        organizationId_userId: {
          organizationId: "org-X",
          userId: "u1",
        },
      },
      select: { role: true, penaltyUntil: true },
    });
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it("10. Platform admin WITH org + fresh DB role=brand_owner -> 200", async () => {
    authAs({
      id: "u1",
      email: "p@x.com",
      role: "platform_admin",
      organizationId: "org-1",
    });
    memberAs({ role: "brand_owner", penaltyUntil: null });
    mockDeleteMany.mockResolvedValue({ count: 1 } as never);
    const res = await DELETE(makeReq({ id: "int-1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    // Fresh DB role is authoritative -- assert fresh lookup actually happened
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: {
        organizationId_userId: {
          organizationId: "org-1",
          userId: "u1",
        },
      },
      select: { role: true, penaltyUntil: true },
    });
    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
  });

  it("12. Rate limit -> 11th request 429, deleteMany called 10x", async () => {
    authAs({
      id: "u1",
      email: "o@x.com",
      role: "owner",
      organizationId: "org-1",
    });
    mockDeleteMany.mockResolvedValue({ count: 0 } as never);

    // 10 allowed requests
    for (let i = 0; i < 10; i++) {
      const res = await DELETE(makeReq({ id: `int-${i}` }));
      expect(res.status).toBe(404);
    }
    expect(mockDeleteMany).toHaveBeenCalledTimes(10);

    // 11th blocked by rate limit
    const blocked = await DELETE(makeReq({ id: "int-11" }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
    expect(mockDeleteMany).toHaveBeenCalledTimes(10);
  });
});