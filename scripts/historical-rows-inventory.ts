import { PrismaClient } from "@prisma/client";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";

const readonlyUrl = process.env.DATABASE_URL_READONLY;
if (!readonlyUrl) {
  console.error("ERROR: DATABASE_URL_READONLY is required. Refusing to run with default DATABASE_URL.");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: readonlyUrl } } });

function sanitizeOrgId(orgId: string | null): string {
  if (!orgId) return "null";
  return orgId.slice(0, 8) + "...";
}

async function main() {
  console.log("Historical Notification Inventory (Read-Only Audit)");
  console.log("===================================================");
  const nowIso = new Date().toISOString();
  const env = process.env.NODE_ENV || "development";
  const headSha = process.env.PR_HEAD_SHA || (() => {
    try { return require("child_process").execSync("git rev-parse HEAD").toString().trim(); } catch { return "unknown"; }
  })();
  console.log(`Timestamp: ${nowIso}`);
  console.log(`Environment: ${env}`);
  console.log(`HEAD SHA: ${headSha}`);

  // Effective table-level write privileges (handles PUBLIC, inherited roles, ownership)
  const tableWriteGrants = await prisma.$queryRawUnsafe(`
    SELECT c.relname AS table_name, p.privilege_type
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN (VALUES ('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) AS p(privilege_type)
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
      AND pg_catalog.has_table_privilege(current_user, c.oid, p.privilege_type)
  `) as any[];

  // Effective column-level write privileges
  const columnWriteGrants = await prisma.$queryRawUnsafe(`
    SELECT c.relname AS table_name, a.attname AS column_name, p.privilege_type
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    CROSS JOIN (VALUES ('INSERT'),('UPDATE'),('REFERENCES')) AS p(privilege_type)
    WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
      AND pg_catalog.has_column_privilege(current_user, c.oid, a.attname, p.privilege_type)
  `) as any[];

  const writePrivilegesFound = tableWriteGrants.length > 0 || columnWriteGrants.length > 0;
  if (writePrivilegesFound) {
    console.error("ERROR: current user has effective write privileges on public tables/columns; SELECT-only role required.");
    if (tableWriteGrants.length) console.error(JSON.stringify(tableWriteGrants, null, 2));
    if (columnWriteGrants.length) console.error(JSON.stringify(columnWriteGrants, null, 2));
    process.exit(1);
  }

  const roleRows = await prisma.$queryRawUnsafe(`
    SELECT current_user, session_user, current_setting('transaction_read_only') AS read_only, current_setting('transaction_isolation') AS isolation
  `) as any[];
  if (!roleRows.length) { console.error("ERROR: role query failed"); process.exit(1); }
  const row = roleRows[0];
  console.log(`Database role: current_user=${row.current_user}, session_user=${row.session_user}`);
  console.log(`Read-only mode: ${row.read_only}, isolation: ${row.isolation}`);
  if (String(row.read_only).toLowerCase() !== "on") { console.error("ERROR: transaction_read_only off"); process.exit(1); }

  console.log("SELECT-only grants verified (effective table & column level).");

  // Inventory queries
  const total = await prisma.notification.count();
  const readCount = await prisma.notification.count({ where: { read: true } });
  const unreadCount = await prisma.notification.count({ where: { read: false } });
  console.log(`\nTotal notifications: ${total}`);
  console.log(`Read: ${readCount}`);
  console.log(`Unread: ${unreadCount}`);

  const byType = await prisma.notification.groupBy({ by: ["type"], _count: { _all: true }, orderBy: { type: "asc" } });
  console.log("\nCounts by type:");
  for (const r of byType) console.log(`  ${r.type}: ${r._count._all}`);

  const byOrg = await prisma.notification.groupBy({ by: ["orgId"], _count: { _all: true }, orderBy: { _count: { id: "desc" } }, take: 10 });
  console.log("\nTop 10 orgs:");
  for (const r of byOrg) console.log(`  org ${sanitizeOrgId(r.orgId)}: ${r._count._all}`);

  const orgWide = await prisma.notification.count({ where: { userId: null } });
  const targeted = await prisma.notification.count({ where: { userId: { not: null } } });
  console.log(`\nOrg-wide: ${orgWide}, Targeted: ${targeted}`);

  try {
    const receiptCount = await prisma.notificationReadReceipt.count();
    const distinctUsers = await prisma.notificationReadReceipt.findMany({ distinct: ["userId"], select: { userId: true } });
    console.log(`\nNotificationReadReceipt rows: ${receiptCount}, Distinct users: ${distinctUsers.length}`);
  } catch (e) {
    console.error("Receipt table query failed, fail-closed.", e);
    process.exit(1);
  }

  const genericTypes = ["info", "success", "warning", "error"];
  const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000);
  const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000);
  for (const type of genericTypes) {
    const totalType = await prisma.notification.count({ where: { type } });
    const last7 = await prisma.notification.count({ where: { type, createdAt: { gte: sevenDaysAgo } } });
    const last30 = await prisma.notification.count({ where: { type, createdAt: { gte: thirtyDaysAgo } } });
    if (totalType > 0) console.log(`\n${type}: Total ${totalType}, 7d ${last7}, 30d ${last30}`);
  }

  const executionReceipt = {
    receipt_type: "PROTECTED_EXACT_HEAD_EXECUTION_RECEIPT",
    timestamp: nowIso,
    pr_head_sha: headSha,
    database_role: { current_user: row.current_user, session_user: row.session_user },
    grants_summary: { table_write_count: tableWriteGrants.length, column_write_count: columnWriteGrants.length },
    read_only_mode_status: String(row.read_only).toLowerCase() === "on" ? "on" : "off",
  };
  console.log("\n===================================================");
  console.log(JSON.stringify(executionReceipt, null, 2));
  console.log("===================================================");
  const fs = require("fs");
  const receiptDir = "backups";
  if (!fs.existsSync(receiptDir)) fs.mkdirSync(receiptDir, { recursive: true });
  const receiptPath = path.join(receiptDir, "historical-rows-inventory-receipt.json");
  const receiptContent = JSON.stringify(executionReceipt, null, 2) + "\n";
  fs.writeFileSync(receiptPath, receiptContent);
  const receiptHash = crypto.createHash("sha256").update(receiptContent).digest("hex");
  fs.writeFileSync(receiptPath + ".sha256", receiptHash + "\n");
  console.log(`Receipt saved: ${receiptPath}`);
}

main().catch((e) => { console.error("Inventory script failed:", e); process.exit(1); }).finally(() => prisma.$disconnect());



