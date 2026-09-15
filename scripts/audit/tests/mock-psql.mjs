#!/usr/bin/env node
// Mock psql for testing receipt-construction path.
// Called as: node mock-psql.mjs -t -A -F \t -c "SQL"

const args = process.argv.slice(2);
const sqlIndex = args.indexOf("-c");
const sql = sqlIndex >= 0 ? String(args[sqlIndex + 1] || "") : "";
const sqlLower = sql.toLowerCase().replace(/\s+/g, " ");

let stdout = "";

if (sqlLower.includes("current_user") && sqlLower.includes("transaction_read_only")) {
  stdout = "audit_readonly\taudit_readonly\ton\n";
} else if (sqlLower.includes("has_table_privilege")) {
  stdout = "0\n";
} else if (sqlLower.includes("has_column_privilege")) {
  stdout = "0\n";
} else if (sqlLower.includes("select version()")) {
  stdout =
    "PostgreSQL 17.6 on aarch64-unknown-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit\n";
} else if (sqlLower.includes("as total") && sqlLower.includes("as read_count")) {
  stdout = "100\t60\t40\t80\t20\t5\n";
} else if (
  sqlLower.includes('from "notificationreadreceipt"') &&
  sqlLower.includes("distinct")
) {
  stdout = "10\n";
} else if (
  sqlLower.includes('from "notificationreadreceipt"') &&
  sqlLower.includes("count(*)")
) {
  stdout = "25\n";
}

process.stdout.write(stdout);
process.exit(0);