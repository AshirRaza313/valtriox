// scripts/find-hardcoded-enhanced.js
// Enhanced regex scanner — catches lowercase, nested, and config-array strings.
// Base categories from original scanner + 3 new categories expert requested.

const fs = require("fs");
const path = require("path");

const ROOTS = [
  path.join(__dirname, "..", "src", "app"),
  path.join(__dirname, "..", "src", "components"),
];

const SKIP_DIRS = ["api", "__tests__", "node_modules"];

const PATTERNS = [
  // ── ORIGINAL: capitalized JSX text (3,479 baseline) ──
  { re: />\s*([A-Z][A-Za-z][A-Za-z0-9 ,.'!?\-]{2,120})\s*</g, kind: "jsx-text" },

  // ── NEW: lowercase JSX text (expert's concern) ──
  { re: />\s*([a-z][a-z][a-z0-9 ,.'!?\-]{2,120})\s*</g, kind: "jsx-text-lowercase" },

  // ── ORIGINAL: string props with capitalized values ──
  { re: /\b(placeholder|title|label|aria-label|aria-placeholder|alt)\s*=\s*"([A-Z][^"]{2,120})"/g, kind: "prop" },

  // ── NEW: string props with lowercase values ──
  { re: /\b(placeholder|title|label|aria-label|aria-placeholder|alt)\s*=\s*"([a-z][^"]{2,120})"/g, kind: "prop-lowercase" },

  // ── NEW: nested JSX expression strings: {"Hello"} ──
  { re: /\{\s*["']([A-Z][A-Za-z0-9 ,.'!?\-]{2,120})["']\s*\}/g, kind: "jsx-expr-string" },

  // ── NEW: config-array / object strings: { label: "Orders" } ──
  { re: /(?:label|text|name|title|placeholder|description|value)\s*:\s*["']([A-Z][A-Za-z0-9 ,.'!?\-]{2,120})["']/g, kind: "config-array" },
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith(".")) continue;
      const normalized = full.replace(/\\/g, "/");
      if (SKIP_DIRS.some((s) => normalized.includes(`/${s}/`))) continue;
      walk(full, files);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const findings = [];

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const src = fs.readFileSync(file, "utf8");
    const rel = path.relative(path.join(__dirname, ".."), file);

    for (const { re, kind } of PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src)) !== null) {
        const value = m[2] !== undefined ? m[2] : m[1];
        const idx = m.index;
        const line = src.slice(0, idx).split("\n").length;

                const before = src.slice(Math.max(0, idx - 100), idx);
        if (/\bt\(|\buseTranslation|Trans\b/.test(before)) continue;
        if (!/[a-zA-Z]/.test(value)) continue;

        // Skip non-UI strings: emails, URLs, connection strings, hex colors
        if (/@[a-z0-9.-]+\.[a-z]{2,}/i.test(value)) continue;          // emails
        if (/^(https?|postgres|mysql|mongodb|redis):\/\//i.test(value)) continue;  // URLs
        if (/^#[0-9a-f]{3,8}$/i.test(value.trim())) continue;           // hex colors
        if (/^\d+(\.\d+)?(px|em|rem|%)?$/.test(value.trim())) continue; // measurements
        // Skip sentence fragments (only conjunctions/preps)
        if (/^(and|or|but|the|a|an|of|to|for|in|on|at|with|by|from|prepared for|using our|grow!)$/i.test(value.trim())) continue;

        findings.push({ file: rel, line, kind, value });
      }
    }
  }
}

// Deduplicate
const seen = new Set();
const unique = findings.filter((f) => {
  const k = `${f.file}:${f.line}:${f.value}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

unique.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));

console.log(`Enhanced hardcoded candidates: ${unique.length}\n`);

const byKind = {};
for (const f of unique) byKind[f.kind] = (byKind[f.kind] || 0) + 1;
console.log("By category:");
for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${v}`);
}

fs.writeFileSync(
  path.join(__dirname, "..", "hardcoded-enhanced-report.json"),
  JSON.stringify(unique, null, 2)
);
console.log(`\nJSON report: hardcoded-enhanced-report.json`);