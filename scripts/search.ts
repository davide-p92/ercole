// scripts/search.ts
import fs from "fs";
import path from "path";

const query = process.argv.slice(2).join(" ").trim();
if (!query) {
  console.error('Usage: pnpm search-db "your query"');
  process.exit(1);
}

const INDEX_PATH = path.resolve(__dirname, "../notes-index.json");
const data = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8")) as Array<{
  id:string; title:string; path:string; content:string; updated:string; tags:string[];
}>;

const q = query.toLowerCase();
const results = data.filter(n =>
  n.title.toLowerCase().includes(q) ||
  n.content.toLowerCase().includes(q) ||
  n.tags.some(t => t.toLowerCase().includes(q)) ||
  n.id.toLowerCase().includes(q)
).sort((a,b) => b.updated.localeCompare(a.updated));

if (results.length === 0) console.log("No results.");
else {
  console.log(`Found ${results.length} results:`);
  for (const r of results) {
    const ex = (r.content ?? "").slice(0, 150).replace(/\n/g, " ");
    console.log(`\n - [${r.id}] ${r.title} (${r.path})`);
    if (ex) console.log(`   ${ex}${r.content.length>150?"...":""}`);
  }
}
