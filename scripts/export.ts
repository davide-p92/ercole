// scripts/export.ts
import fs from "node:fs";
import path from "node:path";
import { INDEX_PATH } from "./_paths.ts";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: pnpm export --tag t1[,t2] [--dir out]');
  process.exit(1);
}
let tags: string[] = [];
let outDir = "export";

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--tag" || a === "-t") {
    tags = (args[++i] || "").split(",").map(s => s.trim()).filter(Boolean);
  } else if (a === "--dir") {
    outDir = args[++i] || outDir;
  }
}
if (tags.length === 0) {
  console.error("Please provide at least one --tag.");
  process.exit(1);
}

const notes = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
const filtered = notes.filter((n: any) =>
  tags.every(t => (n.tags || []).map((x: string) => x.toLowerCase()).includes(t.toLowerCase()))
);

fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `notes-${tags.join("_")}.json`);
fs.writeFileSync(outPath, JSON.stringify(filtered, null, 2));
console.log(`✅ Exported ${filtered.length} notes to ${outPath}`);
