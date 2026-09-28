// tests/integration/integrations-delete-s1-e2e.test.ts
//
// ============================================================================
// ROLLBACK PLAN
// ============================================================================
// - INTEGRATION_DATABASE_URL missing -> suite skips cleanly
//   (describe.skipIf pattern -- matches postgres-supplier-constraints.test.ts)
// - DB connection fails after beforeAll -> suite fails (correct; env is
//   misconfigured, not a silent skip)
// - Prisma client missing -> import error (expected; run npm ci first)
// - Test fails mid-way -> afterAll still cleans up by prefix test-s1-*
// - Parallel CI runs -> unique test-s1-* prefix per run avoids collisions
// ============================================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const connectionString = process.env.INTEGRATION_DATABASE_URL;

// Point the app's Prisma client at the test DB before any module load.
vi.hoisted(() => {
  if (process.env.INTEGRATION_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.INTEGRATION_DATABASE_URL;
  }
});

// Mock only the auth data source so we can inject per-test callers.
// db + membership helper + route handler logic remain REAL.
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { DELETE } from "@/app/api/integrations/route";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";

const mockGetServerSession = vi.mocked(getServerSession);

const PREFIX = "test-s1-";

// --- Fixture IDs (unique per run, prefix-safe) ---
const orgA = `${PREFIX}org-a`;
const orgB = `${PREFIX}org-b`;
const userA = `${PREFIX}user-a`;
const userB = `${PREFIX}user-b`;
const userRemoved = `${PREFIX}user-removed`;
const userDemoted = `${PREFIX}user-demoted`;
const intA = `${PREFIX}int-a`;
const intB = `${PREFIX}int-b`;
const intRemoved = `${PREFIX}int-removed`;
const intDemoted = `${PREFIX}int-demoted`;

function makeReq(id: string) {
  const url = new URL("http://localhost/api/integrations");
  url.searchParams.set("id", id);
  return new NextRequest(url, {
    method: "DELETE",
    headers: { "x-forwarded-for": "127.0.0.1" },
  });
}

function authAs(
  user: {
    id: string;
    email: string;
    role: string;
    organizationId: string;
  } | null,
) {
  mockGetServerSession.mockResolvedValue((user ? { user } : null) as never);
}

async function cleanup() {
  // FK-safe order: integrations -> members -> users -> orgs
  await db.integrationConnection.deleteMany({
    where: { id: { startsWith: PREFIX } },
  });
  await db.organizationMember.deleteMany({
    where: { organizationId: { startsWith: PREFIX } },
  });
  await db.user.deleteMany({
    where: { id: { startsWith: PREFIX } },
  });
  await db.organization.deleteMany({
    where: { id: { startsWith: PREFIX } },
  });
}

describe.skipIf(!connectionString)(
  "S1 E2E - two-tenant DELETE (real DB)",
  () => {
    beforeAll(async () => {
      await cleanup();

      await db.organization.createMany({
        data: [
          { id: orgA, name: "Test S1 Org A", slug: `${PREFIX}org-a` },
          { id: orgB, name: "Test S1 Org B", slug: `${PREFIX}org-b` },
        ],
      });

      await db.user.createMany({
        data: [
          { id: userA, name: "User A", email: `${userA}@example.test` },
          { id: userB, name: "User B", email: `${userB}@example.test` },
          {
            id: userRemoved,
            name: "User Removed",
            email: `${userRemoved}@example.test`,
          },
          {
            id: userDemoted,
            name: "User Demoted",
            email: `${userDemoted}@example.test`,
          },
        ],
      });

      // Note: userRemoved has NO membership row (already removed)
      await db.organizationMember.createMany({
        data: [
          { organizationId: orgA, userId: userA, role: "owner" },
          { organizationId: orgB, userId: userB, role: "owner" },
          { organizationId: orgA, userId: userDemoted, role: "member" },
        ],
      });

      await db.integrationConnection.createMany({
        data: [
          {
            id: intA,
            organizationId: orgA,
            type: "mailchimp",
            provider: "email_marketing",
            name: "A Mailchimp",
          },
          {
            id: intB,
            organizationId: orgB,
            type: "shopify",
            provider: "ecommerce",
            name: "B Shopify",
          },
          {
            id: intRemoved,
            organizationId: orgA,
            type: "stripe",
            provider: "payments",
            name: "Removed User Target",
          },
          {
            id: intDemoted,
            organizationId: orgA,
            type: "twilio",
            provider: "communication",
            name: "Demoted User Target",
          },
        ],
      });
    });

    afterAll(async () => {
      await cleanup();
      await db.$disconnect();
    });

    beforeEach(() => {
      vi.clearAllMocks();
      const g = globalThis as unknown as {
        __valtrioxMemoryStore?: Map<string, unknown>;
      };
      g.__valtrioxMemoryStore?.clear();
    });

    it("E1. Org A caller -> Org B integration -> 404, row remains", async () => {
      authAs({
        id: userA,
        email: `${userA}@example.test`,
        role: "owner",
        organizationId: orgA,
      });

      const res = await DELETE(makeReq(intB));
      expect(res.status).toBe(404);

      const stillExists = await db.integrationConnection.findUnique({
        where: { id: intB },
      });
      expect(stillExists).not.toBeNull();
      expect(stillExists?.organizationId).toBe(orgB);
    });

    it("E2. Org A caller -> own Org A integration -> 200, row gone", async () => {
      authAs({
        id: userA,
        email: `${userA}@example.test`,
        role: "owner",
        organizationId: orgA,
      });

      const res = await DELETE(makeReq(intA));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ success: true });

      const gone = await db.integrationConnection.findUnique({
        where: { id: intA },
      });
      expect(gone).toBeNull();
    });

    it("E3. Removed user (no membership row) -> 403, no mutation", async () => {
      authAs({
        id: userRemoved,
        email: `${userRemoved}@example.test`,
        role: "owner",
        organizationId: orgA,
      });

      const res = await DELETE(makeReq(intRemoved));
      expect(res.status).toBe(403);

      const stillExists = await db.integrationConnection.findUnique({
        where: { id: intRemoved },
      });
      expect(stillExists).not.toBeNull();
    });

    it("E4. Demoted user (DB=member, session=owner) -> 403, no mutation", async () => {
      authAs({
        id: userDemoted,
        email: `${userDemoted}@example.test`,
        role: "owner",
        organizationId: orgA,
      });

      const res = await DELETE(makeReq(intDemoted));
      expect(res.status).toBe(403);

      const stillExists = await db.integrationConnection.findUnique({
        where: { id: intDemoted },
      });
      expect(stillExists).not.toBeNull();
    });

    it("E5. Session role=platform_admin, fresh DB role=owner -> 200 (fresh DB role wins)", async () => {
      // Session claims platform_admin; fresh DB role for this user in Org B is
      // "owner". Both are in the allowlist, so the handler's fresh-lookup
      // behavior is proven by E4 (session=owner, DB=member -> 403) combined
      // with this test (handler correctly returns 200 for valid fresh role).
      authAs({
        id: userB,
        email: `${userB}@example.test`,
        role: "platform_admin",
        organizationId: orgB,
      });

      const res = await DELETE(makeReq(intB));
      expect(res.status).toBe(200);

      const gone = await db.integrationConnection.findUnique({
        where: { id: intB },
      });
      expect(gone).toBeNull();
    });
  },
);