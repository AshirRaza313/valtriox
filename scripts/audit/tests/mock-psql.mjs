#!/usr/bin/env node
// Mock psql for testing receipt-construction path.
// Called as: node mock-psql.mjs -t -A -F \t -c "SQL"
//
// Scenario control (OPTIONAL) — set MOCK_PSQL_SCENARIO env var:
//   (unset)              → default: successful run (backward-compatible)
//   readonly_off         → transaction_read_only returns "off"   (N4)
//   write_grants_table   → has_table_privilege returns "3"       (N5)
//   wrong_relation_kind  → relkind query returns 'v' for one row (N11)
//   psql_error_on_version → exit 1 with stderr on version query (N12)
//   inconsistent_counts  → total != read+unread in inventory (N13)
//   write_grants_column  → has_column_privilege returns "1"      (N5-variant)
//   version_17_5         → version() returns PostgreSQL 17.5     (N6)
//   schema_missing       → public schema check returns "f"
//   env_dump             → print PG* env vars (for R14-1 test)
//
// When MOCK_PSQL_SCENARIO is unset, behavior is identical to the
// pre-Round-11 mock (so existing tests remain green).

const args = process.argv.slice(2);
const sqlIndex = args.indexOf("-c");
const sql = sqlIndex >= 0 ? String(args[sqlIndex + 1] || "") : "";
const sqlLower = sql.toLowerCase().replace(/\s+/g, " ");
const scenario = process.env.MOCK_PSQL_SCENARIO || "";

let stdout = "";

if (scenario === "env_dump") {
  // Dump PG* env vars for R14-1 verification
  const pgVars = Object.keys(process.env)
    .filter((k) => k.startsWith("PG"))
    .sort();
  for (const k of pgVars) {
    process.stdout.write(`${k}=<redacted>\n`);
  }
  process.exit(0);
} else if (sqlLower.includes("current_user") && sqlLower.includes("transaction_read_only")) {
  stdout =
    scenario === "readonly_off"
      ? "audit_readonly\taudit_readonly\toff\n"
      : "audit_readonly\taudit_readonly\ton\n";
} else if (sqlLower.includes("show search_path")) {
  stdout = '"$user", public\n';
} else if (
  sqlLower.includes("exists") &&
  sqlLower.includes("pg_catalog.pg_namespace") &&
  sqlLower.includes("nspname = 'public'")
) {
  stdout = scenario === "schema_missing" ? "f\n" : "t\n";
} else if (
  sqlLower.includes("c.relname in") &&
  sqlLower.includes("c.relkind")
) {
  stdout =
    scenario === "wrong_relation_kind"
      ? "Notification\tv\nNotificationReadReceipt\tr\n"
      : "Notification\tr\nNotificationReadReceipt\tr\n";
} else if (sqlLower.includes("has_table_privilege")) {
  stdout = scenario === "write_grants_table" ? "3\n" : "0\n";
} else if (sqlLower.includes("has_column_privilege")) {
  stdout = scenario === "write_grants_column" ? "1\n" : "0\n";
} else if (sqlLower.includes("select version()")) {
  if (scenario === "psql_error_on_version") {
    process.stderr.write("FATAL: connection lost\n");
    process.exit(1);
  }
  stdout =
    scenario === "version_17_5"
      ? "PostgreSQL 17.5 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit\n"
      : "PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit\n";
} else if (sqlLower.includes("as total") && sqlLower.includes("as read_count")) {
  stdout =
    scenario === "inconsistent_counts"
      ? "100\t50\t40\t80\t20\t5\n" // total=100, read+unread=90 → invariant fails
      : "100\t60\t40\t80\t20\t5\n";
} else if (
  sqlLower.includes("count(*)") &&
  sqlLower.includes("information_schema.role_table_grants")
) {
  stdout = "0\n";
} else if (
  sqlLower.includes("count(*)") &&
  sqlLower.includes("information_schema.column_privileges")
) {
  stdout = "0\n";
} else if (
  sqlLower.includes('from public."notificationreadreceipt"') &&
  sqlLower.includes("distinct")
) {
  stdout = "10\n";
} else if (
  sqlLower.includes('from public."notificationreadreceipt"') &&
  sqlLower.includes("count(*)")
) {
  stdout = "25\n";
}

process.stdout.write(stdout);
process.exit(0);