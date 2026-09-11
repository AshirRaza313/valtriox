// scripts/fix-urdu-keys.js
// Updates specific UR keys in src/lib/i18n.ts to proper Roman Urdu.

const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "src", "lib", "i18n.ts");
let src = fs.readFileSync(filePath, "utf8");

const urStart = src.indexOf("  ur: {");
if (urStart === -1) {
  console.error("ur block not found");
  process.exit(1);
}

const before = src.slice(0, urStart);
let urPart = src.slice(urStart);

// Each entry: [regex matching the key: "OldValue", replacement]
const replacements = [
  [/(\s+cancel:\s*)"Cancel"/, '$1"Radd Karein"'],
  [/(\s+on:\s*)"On"/, '$1"Chalu"'],
  [/(\s+off:\s*)"Off"/, '$1"Band"'],
  [/(\s+groups:\s*)"(?:groups|guruh)"/, '$1"Majma"'],
  [/(\s+items:\s*)"items"/, '$1"cheezein"'],
  [/(\s+slaActive:\s*)"active"/, '$1"chalu"'],
  [/(\s+slaDisabled:\s*)"Off"/, '$1"band"'],
];

let count = 0;
for (const [re, rep] of replacements) {
  const next = urPart.replace(re, rep);
  if (next !== urPart) {
    count++;
    console.log(`✅ ${rep.replace(/\$1/, "").trim()}`);
  } else {
    console.log(`⚠️  No match: ${re}`);
  }
  urPart = next;
}

fs.writeFileSync(filePath, before + urPart, "utf8");
console.log(`\nReplaced: ${count} of 7 keys`);