#!/usr/bin/env node
// ============================================================================
// find-identical-i18n.js — DIAGNOSTIC TOOL (not a complete audit gate)
// ============================================================================
// Finds:
//   - EN/UR key parity (missing keys)
//   - Identical EN/UR values (candidates for glossary)
//   - DUPLICATE keys within EN or UR blocks (fails loudly)
//
// Limitations (acknowledged):
//   - Does NOT enforce glossary as a hard gate
//   - Does NOT validate value semantics
//   - Intended as a diagnostic aid, not a merge blocker on its own
//
// Usage: node scripts/find-identical-i18n.js
// Exit codes:
//   0 = clean (no duplicates, parity OK)
//   1 = issues found (duplicates or missing keys)
// ============================================================================

const fs = require("node:fs");
const path = require("node:path");

// File path: optional CLI arg (for tests), default is src/lib/i18n.ts
const argPath = process.argv[2];
const filePath = argPath
  ? path.resolve(argPath)
  : path.join(__dirname, "..", "src", "lib", "i18n.ts");

if (!fs.existsSync(filePath)) {
  console.error(`ERROR: i18n file not found: ${filePath}`);
  process.exit(1);
}

const src = fs.readFileSync(filePath, "utf8");
const lines = src.split(/\r?\n/);

const en = {};
const ur = {};
const enDuplicates = []; // { key, firstLine, dupLine }
const urDuplicates = [];
const enSeen = {}; // key -> line number
const urSeen = {};

let current = null;
let currentName = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const t = line.trim();
  const lineNum = i + 1;

  // Detect start of en/ur blocks
  if (/^en:\s*\{/.test(t)) {
    current = en;
    currentName = "en";
    continue;
  }
  if (/^ur:\s*\{/.test(t)) {
    current = ur;
    currentName = "ur";
    continue;
  }

  // Detect end of block
  if (current && /^\};?\s*$/.test(t)) {
    current = null;
    currentName = null;
    continue;
  }

  if (!current) continue;

  // Match: keyName: "value",
  const m = t.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*"((?:[^"\\]|\\.)*)"\s*,?\s*$/);
  if (!m) continue;

  const key = m[1];
  const value = m[2];

  // Duplicate detection
  if (currentName === "en") {
    if (enSeen[key] !== undefined) {
      enDuplicates.push({ key, firstLine: enSeen[key], dupLine: lineNum });
    } else {
      enSeen[key] = lineNum;
    }
  } else if (currentName === "ur") {
    if (urSeen[key] !== undefined) {
      urDuplicates.push({ key, firstLine: urSeen[key], dupLine: lineNum });
    } else {
      urSeen[key] = lineNum;
    }
  }

  current[key] = value;
}

// ── Duplicate check (FAIL-CLOSED) ────────────────────────────────────────
if (enDuplicates.length > 0 || urDuplicates.length > 0) {
  console.error(`\n❌ DUPLICATE KEYS DETECTED — silent overwrites possible\n`);

  if (enDuplicates.length > 0) {
    console.error(`EN block — ${enDuplicates.length} duplicate(s):`);
    for (const d of enDuplicates) {
      console.error(`  ${d.key} — first at line ${d.firstLine}, duplicate at line ${d.dupLine}`);
    }
  }
  if (urDuplicates.length > 0) {
    console.error(`UR block — ${urDuplicates.length} duplicate(s):`);
    for (const d of urDuplicates) {
      console.error(`  ${d.key} — first at line ${d.firstLine}, duplicate at line ${d.dupLine}`);
    }
  }

  console.error(`\nFix src/lib/i18n.ts: remove duplicate keys before proceeding.\n`);
  process.exit(1);
}

// ── Normal diagnostic output ─────────────────────────────────────────────
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
  `\n⚠️  DIAGNOSTIC ONLY — verify each identical key is in docs/urdu-glossary.md`
);

// Non-zero exit if parity issues exist
if (missingInUr.length > 0 || missingInEn.length > 0) {
  process.exit(1);
}

process.exit(0);