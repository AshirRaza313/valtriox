// scripts/find-identical-i18n.js
// Finds keys where EN and UR translations are identical.

const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "src", "lib", "i18n.ts");
const src = fs.readFileSync(filePath, "utf8");

// Extract the `en: { ... }` and `ur: { ... }` blocks
const enStart = src.indexOf("  en: {");
const urStart = src.indexOf("  ur: {");
if (enStart === -1 || urStart === -1) {
  console.error("Could not find en:/ur: blocks in i18n.ts");
  process.exit(1);
}

// en block ends right before ur:
const enBlock = src.slice(enStart, urStart);
// ur block ends before the closing of the top-level object
const urEnd = src.indexOf("\n};", urStart);
if (urEnd === -1) {
  console.error("Could not find end of ur: block");
  process.exit(1);
}
const urBlock = src.slice(urStart, urEnd);

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

console.log(`EN keys: ${Object.keys(en).length}`);
console.log(`UR keys: ${Object.keys(ur).length}`);

const identical = [];
for (const key of Object.keys(en)) {
  if (Object.prototype.hasOwnProperty.call(ur, key) && ur[key] === en[key]) {
    identical.push({ key, value: en[key] });
  }
}

console.log(`\nIdentical EN/UR values: ${identical.length}\n`);
console.log(JSON.stringify(identical, null, 2));

// Also report keys present in EN but missing in UR
const missing = Object.keys(en).filter((k) => !(k in ur));
if (missing.length) {
  console.log(`\nMissing in UR: ${missing.length}`);
  console.log(JSON.stringify(missing, null, 2));
}