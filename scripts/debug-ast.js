// scripts/debug-ast.js — Diagnose why AST scanner returns 0
const { Project } = require("ts-morph");
const path = require("path");
const fs = require("fs");

const root = path.join(__dirname, "..");
console.log("Root:", root);
console.log("cwd:", process.cwd());
console.log("tsconfig exists:", fs.existsSync(path.join(root, "tsconfig.json")));

const project = new Project({
  tsConfigFilePath: path.join(root, "tsconfig.json"),
});

console.log("\n--- Testing source file globs ---");

const globs = [
  "src/components/**/*.tsx",
  "src/app/**/*.tsx",
  "src/**/*.tsx",
];

for (const glob of globs) {
  const full = path.join(root, glob).replace(/\\/g, "/");
  const files = project.addSourceFilesAtPaths(full);
  console.log(`Glob: ${full}`);
  console.log(`  Found: ${files.length} files`);
}

const allFiles = project.getSourceFiles();
console.log(`\nTotal source files in project: ${allFiles.length}`);

if (allFiles.length > 0) {
  console.log("\nFirst 5 files:");
  allFiles.slice(0, 5).forEach((f) => console.log("  " + f.getFilePath()));
}