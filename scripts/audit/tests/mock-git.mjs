#!/usr/bin/env node
// Mock git for testing receipt-construction path.

const args = process.argv.slice(2).join(" ");

if (args.includes("rev-parse") && args.includes("HEAD")) {
  process.stdout.write("b".repeat(40) + "\n");
  process.exit(0);
}

process.exit(0);