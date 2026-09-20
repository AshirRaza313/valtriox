#!/usr/bin/env node
// Mock psql for testing receipt-construction path.
// Called as: node mock-psql.mjs -t -A -F \t -c "SQL"
//
// Scenario control (OPTIONAL) — set MOCK_PSQL_SCENARIO env var:
//   (unset)              → default: successful run (backward-compatible)
//   readonly_off         → transaction_read_only returns "off"   (N4)
//   write_grants_table   → has_table_privilege returns "3"       (N5)
//   write_grants_column  → has_column_privilege returns "1"      (N5-variant)
//   version_17_5         → version() returns PostgreSQL 17.5     (N6)
//   schema_missing       → public schema check returns "f"
//
// When MOCK_PSQL_SCENARIO is unset, behavior is identical to the
// pre-Round-11 mock (so existing tests remain green).

const args = process.argv.slice(2);
const sqlIndex = args.indexOf("-c");
const sql = sqlIndex >= 0 ? String(args[sqlIndex + 1] || "") : "";
const sqlLower = sql.toLowerCase().replace(/\s+/g, " ");
const scenario = process.env.MOCK_PSQL_SCENARIO || "";

let stdout = "";

if (sqlLower.includes("current_user") && sqlLower.includes("transaction_read_only")) {
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
} else if (sqlLower.includes("has_table_privilege")) {
  stdout = scenario === "write_grants_table" ? "3\n" : "0\n";
} else if (sqlLower.includes("has_column_privilege")) {
  stdout = scenario === "write_grants_column" ? "1\n" : "0\n";
} else if (sqlLower.includes("select version()")) {
  stdout =
    scenario === "version_17_5"
      ? "PostgreSQL 17.5 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit\n"
      : "PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit\n";
} else if (sqlLower.includes("as total") && sqlLower.includes("as read_count")) {
  stdout = "100\t60\t40\t80\t20\t5\n";
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