// scripts/find-hardcoded-strings.js
// Scans JSX/TSX files for user-facing English strings that are not wrapped
// in a t() or useTranslation() call.

const fs = require("fs");
const path = require("path");

const ROOTS = [
  path.join(__dirname, "..", "src", "app"),
  path.join(__dirname, "..", "src", "components"),
];

// Patterns that indicate a hardcoded string
const PATTERNS = [
  // JSX text content: >Some Text<
  { re: />\s*([A-Z][A-Za-z][A-Za-z0-9 ,.'!?\-]{2,80})\s*</g, kind: "jsx-text" },
  // String props commonly used for UI
  { re: /\b(placeholder|title|label|aria-label|alt)\s*=\s*"([A-Z][^"]{2,80})"/g, kind: "prop" },
];

// Skip patterns (false positives)
const SKIP_VALUES = new Set([
  // common CSS class fragments, urls, etc.
]);

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
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
    const lines = src.split("\n");

    for (const { re, kind } of PATTERNS) {
      let m;
      while ((m = re.exec(src)) !== null) {
        const value = kind === "jsx-text" ? m[1] : m[2];
        const idx = m.index;
        const line = src.slice(0, idx).split("\n").length;

        // Skip obvious non-UI strings
        if (!/[a-zA-Z]/.test(value)) continue;
        if (value.length < 3) continue;
        // Skip if it looks like a t() call result or already translated
        const before = src.slice(Math.max(0, idx - 80), idx);
        if (/\bt\(|\buseTranslation|Trans\b/.test(before)) continue;

        findings.push({
          file: path.relative(path.join(__dirname, ".."), file),
          line,
          kind,
          value,
        });
      }
    }
  }
}

// Deduplicate by file:line:value
const seen = new Set();
const unique = findings.filter((f) => {
  const k = `${f.file}:${f.line}:${f.value}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

console.log(`Hardcoded candidate strings: ${unique.length}\n`);

// Group by file
const byFile = {};
for (const f of unique) {
  (byFile[f.file] = byFile[f.file] || []).push(f);
}

for (const [file, items] of Object.entries(byFile)) {
  console.log(`\n${file}`);
  for (const it of items) {
    console.log(`  L${it.line}  [${it.kind}]  ${JSON.stringify(it.value)}`);
  }
}

// Also emit JSON for programmatic consumption
fs.writeFileSync(
  path.join(__dirname, "..", "hardcoded-strings-report.json"),
  JSON.stringify(unique, null, 2)
);
console.log(`\nJSON report: hardcoded-strings-report.json`);