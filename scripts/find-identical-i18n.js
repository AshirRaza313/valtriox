#!/usr/bin/env node
// ============================================================================
// Find identical EN/UR values in src/lib/i18n.ts
// ============================================================================
// Simple line-based parser — reliable for flat key-value structure.
//
// Usage: node scripts/find-identical-i18n.js
// ============================================================================

const fs = require("node:fs");
const path = require("node:path");

const filePath = path.join(__dirname, "..", "src", "lib", "i18n.ts");

if (!fs.existsSync(filePath)) {
  console.error(`ERROR: i18n file not found: ${filePath}`);
  process.exit(1);
}

const src = fs.readFileSync(filePath, "utf8");
const lines = src.split(/\r?\n/);

const en = {};
const ur = {};
let current = null;

for (const line of lines) {
  const t = line.trim();

  // Detect start of en/ur blocks
  if (/^en:\s*\{/.test(t)) {
    current = en;
    continue;
  }
  if (/^ur:\s*\{/.test(t)) {
    current = ur;
    continue;
  }

  // Detect end of a block
  if (current && /^\};?\s*$/.test(t)) {
    current = null;
    continue;
  }

  if (!current) continue;

  // Match: keyName: "value",
  const m = t.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*"((?:[^"\\]|\\.)*)"\s*,?\s*$/);
  if (m) {
    current[m[1]] = m[2];
  }
}

const enKeys = Object.keys(en);
const urKeys = Object.keys(ur);

console.log(`EN keys: ${enKeys.length}`);
console.log(`UR keys: ${urKeys.length}`);

// Missing keys
const missingInUr = enKeys.filter((k) => !(k in ur));
const missingInEn = urKeys.filter((k) => !(k in en));

if (missingInUr.length > 0) {
  console.log(`\n⚠️  Missing in UR (${missingInUr.length}):`);
  console.log(JSON.stringify(missingInUr, null, 2));
}
if (missingInEn.length > 0) {
  console.log(`\n⚠️  Missing in EN (${missingInEn.length}):`);
  console.log(JSON.stringify(missingInEn, null, 2));
}

// Identical values
const identical = [];
for (const key of enKeys) {
  if (ur[key] !== undefined && ur[key] === en[key]) {
    identical.push({ key, value: en[key] });
  }
}

console.log(`\nIdentical EN/UR values: ${identical.length}\n`);
console.log(JSON.stringify(identical, null, 2));

console.log(
  `\n⚠️  Verify each of the ${identical.length} identical keys is in docs/urdu-glossary.md`
);

process.exit(0);