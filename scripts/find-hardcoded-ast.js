// ============================================================================
// AST-based hardcoded UI string scanner — STRICT VERSION
// ============================================================================
// Only catches strings that are ACTUALLY RENDERED to the user.
// Excludes: className, CSS values, API routes, config, imports, enums,
//           status identifiers, i18n keys, test IDs.
// ============================================================================

const { Project, SyntaxKind } = require("ts-morph");
const path = require("path");
const fs = require("fs");

const project = new Project({
  tsConfigFilePath: path.join(__dirname, "..", "tsconfig.json"),
});

const SCAN_DIRS = ["src/app", "src/components"];

// Attributes whose string values are NEVER user-facing text
const SKIP_ATTRS = new Set([
  "className", "id", "key", "href", "src", "type", "name", "htmlFor",
  "data-testid", "aria-describedby", "role", "target", "rel", "value",
  "onClick", "onChange", "onSubmit", "onBlur", "onFocus", "style", "ref",
  "autoComplete", "inputMode", "pattern", "method", "action", "lang",
  "data-*", "aria-labelledby", "aria-controls", "aria-expanded",
  "accept", "multiple", "step", "min", "max", "as", "variant", "size",
]);

// Strings that look like non-UI values
const SKIP_VALUE_PATTERNS = [
  /^(https?:|\/|\.\/|\.\.\/|@\/)/,       // URLs, paths, imports
  /^[a-z0-9-_]+$/,                        // pure lowercase slug (class-like)
  /^\d+(\.\d+)?$/,                        // numbers
  /^[A-Z_]+$/,                            // CONSTANT_NAMES
  /\.(png|jpg|jpeg|svg|css|ts|tsx|js|jsx|json|pdf|woff2?)$/i,
  /^#[0-9a-f]{3,8}$/i,                    // hex colors
  /^(rgb|hsl|var)\(/,                     // CSS functions
  /^\s*[\d.,%-]+\s*$/,                    // numeric-heavy
  /^(en|ur|ar|fr|es)$/,                   // locale codes
  /^(GET|POST|PUT|PATCH|DELETE|OPTIONS)$/,
  /^(click|change|submit|focus|blur|input|keydown)$/,
  /^(pending|active|inactive|cancelled|completed|draft|published|archived|deleted)$/i,
  /^(info|success|warning|error|critical|debug)$/i,
  /^(admin|owner|manager|user|guest|member)$/i,
  /^(low|medium|high|urgent)$/i,
];

function shouldSkip(value) {
  if (!value || value.trim().length < 3) return true;
  const trimmed = value.trim();
  if (!/[a-zA-Z]/.test(trimmed)) return true;
  // Must contain a space OR start with uppercase (sentence-like)
  // Pure single lowercase words are often state/config values
  if (!/\s/.test(trimmed) && !/^[A-Z]/.test(trimmed)) return true;
  return SKIP_VALUE_PATTERNS.some((re) => re.test(trimmed));
}

function isInsideTranslation(node) {
  let current = node;
  let depth = 0;
  while (current && depth < 8) {
    const kind = current.getKind();
    if (kind === SyntaxKind.CallExpression) {
      const text = current.getText();
      if (/^\s*t\s*\(|useTranslation|^\s*Trans\b|i18n\./.test(text.slice(0, 80))) {
        return true;
      }
    }
    if (kind === SyntaxKind.JsxAttribute) {
      const attrName = current.getNameNode().getText();
      if (SKIP_ATTRS.has(attrName)) return true;
    }
    current = current.getParent();
    depth++;
  }
  return false;
}

const findings = [];

// Build all globs upfront and add in one call
const allGlobs = SCAN_DIRS.map((dir) =>
  path.join(__dirname, "..", dir, "**", "*.tsx").replace(/\\/g, "/")
);

const allFiles = project.addSourceFilesAtPaths(allGlobs);

{
  for (const sourceFile of allFiles) {
    const filePath = path.relative(path.join(__dirname, ".."), sourceFile.getFilePath());

    if (filePath.includes("__tests__") || filePath.includes(".test.")) continue;

    // 1. JSX text — HIGH SIGNAL (this is always rendered)
    for (const jsxText of sourceFile.getDescendantsOfKind(SyntaxKind.JsxText)) {
      const text = jsxText.getText().trim();
      if (shouldSkip(text)) continue;
      if (isInsideTranslation(jsxText)) continue;
      findings.push({
        file: filePath,
        line: jsxText.getStartLineNumber(),
        kind: "jsx-text",
        value: text,
      });
    }

    // 2. JSX attributes — MEDIUM SIGNAL (only user-facing attrs)
    const USER_FACING_ATTRS = new Set([
      "placeholder", "title", "label", "alt", "aria-label",
      "aria-description", "aria-placeholder",
    ]);

    for (const jsxAttr of sourceFile.getDescendantsOfKind(SyntaxKind.JsxAttribute)) {
      const attrName = jsxAttr.getNameNode().getText();
      if (!USER_FACING_ATTRS.has(attrName)) continue;
      const init = jsxAttr.getInitializer();
      if (!init) continue;

      if (init.getKind() === SyntaxKind.StringLiteral) {
        const value = init.getLiteralText();
        if (shouldSkip(value)) continue;
        if (isInsideTranslation(jsxAttr)) continue;
        findings.push({
          file: filePath,
          line: jsxAttr.getStartLineNumber(),
          kind: `attr:${attrName}`,
          value,
        });
      }

      if (init.getKind() === SyntaxKind.JsxExpression) {
        const expr = init.getExpression();
        if (!expr) continue;
        if (
          expr.getKind() === SyntaxKind.StringLiteral ||
          expr.getKind() === SyntaxKind.NoSubstitutionTemplateLiteral
        ) {
          const value =
            expr.getKind() === SyntaxKind.StringLiteral
              ? expr.getLiteralText()
              : expr.getText().slice(1, -1);
          if (shouldSkip(value)) continue;
          if (isInsideTranslation(jsxAttr)) continue;
          findings.push({
            file: filePath,
            line: jsxAttr.getStartLineNumber(),
            kind: `attr-expr:${attrName}`,
            value,
          });
        }
      }
    }

    // 3. String literals — LOW SIGNAL (only in JSX return contexts)
    // Only catch strings that are inside JSX expressions in return statements
    for (const jsxExpr of sourceFile.getDescendantsOfKind(SyntaxKind.JsxExpression)) {
      const expr = jsxExpr.getExpression();
      if (!expr) continue;
      if (expr.getKind() !== SyntaxKind.StringLiteral) continue;
      const value = expr.getLiteralText();
      if (shouldSkip(value)) continue;
      if (isInsideTranslation(jsxExpr)) continue;

      findings.push({
        file: filePath,
        line: jsxExpr.getStartLineNumber(),
        kind: "jsx-expr-string",
        value,
      });
    }
  }
}

const seen = new Set();
const unique = findings.filter((f) => {
  const k = `${f.file}:${f.line}:${f.value}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

unique.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file)));

console.log(`STRICT hardcoded UI candidates: ${unique.length}\n`);

const byFile = {};
for (const f of unique) {
  (byFile[f.file] = byFile[f.file] || []).push(f);
}

for (const [file, items] of Object.entries(byFile)) {
  console.log(`\n${file} (${items.length})`);
  for (const it of items) {
    console.log(`  L${it.line}  [${it.kind}]  ${JSON.stringify(it.value)}`);
  }
}

const reportPath = path.join(__dirname, "..", "hardcoded-ast-report.json");
fs.writeFileSync(reportPath, JSON.stringify(unique, null, 2));
console.log(`\nJSON report: ${path.relative(process.cwd(), reportPath)}`);