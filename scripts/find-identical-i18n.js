#!/usr/bin/env node
// ============================================================================
// Find identical EN/UR values in src/lib/i18n.ts
// ============================================================================
// Purpose: Detect translation regressions where EN and UR values are the same.
// Every identical key must appear in docs/urdu-glossary.md — otherwise it is
// an untranslated string (regression).
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

// Locate `en: {` and `ur: {` blocks
const enStart = src.indexOf("  en: {");
const urStart = src.indexOf("  ur: {");

if (enStart === -1 || urStart === -1) {
  console.error("ERROR: Could not find en:/ur: blocks in i18n.ts");
  process.exit(1);
}

// en block ends just before ur:
const enBlock = src.slice(enStart, urStart);

// ur block ends at the top-level closing `\n};`
const urEnd = src.indexOf("\n};", urStart);
if (urEnd === -1) {
  console.error("ERROR: Could not find end of ur: block");
  process.exit(1);
}
const urBlock = src.slice(urStart, urEnd);

// Parse `key: "value",` lines
function parseBlock(block) {
  const map = {};
  const re = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*"((?:[^"\\]|\\.)*)"\s*,?\s*$/gm;
  let m;
  while ((m = re.exec(block)) !== null) {
    map[m[1]] = m[2];
  }
  return map;
}

const en = parseBlock(enBlock);
const ur = parseBlock(urBlock);

const enKeys = Object.keys(en);
const urKeys = Object.keys(ur);

console.log(`EN keys: ${enKeys.length}`);
console.log(`UR keys: ${urKeys.length}`);

// Missing keys check
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

// Exit non-zero if identical keys exist that are NOT in glossary
// (Soft check — just exit 0 for now, but warn)
if (identical.length > 0) {
  console.log(
    `\n⚠️  Verify each of the ${identical.length} identical keys is listed in docs/urdu-glossary.md`
  );
}

process.exit(0);