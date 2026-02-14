// scripts/graph.ts
import fs from "node:fs";
import { INDEX_PATH } from "./_paths.ts";

type Note = { id:string; title:string; path:string; tags:string[]; links:string[] };

if (!fs.existsSync(INDEX_PATH)) {
 	console.error(`Index not found: ${INDEX_PATH}. Run "pnpm index-db" first.`);
	process.exit(1);
}

const notes = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8")) as Note[];

const idToIndex = new Map<string, number>();
const nodes = notes.map((n, i) => {
	idToIndex.set(n.id, i);
	return { id: n.id, label: n.title, path: n.path, tags: n.tags };
});
const edges: Array<{source:number; target:number; type:string}> = [];
for (const n of notes) {
	const s = idToIndex.get(n.id)!;
	if (typeof s !== "number") continue;
	for (const ref of (n.links || [])) {
		const t = idToIndex.get(ref);
		if (typeof t === "number") edges.push({ source: s, target: t, type: "LINKS_TO" });
	}
}

const graph = { nodes, edges, meta: { count: nodes.length, links: edges.length, generatedAt: new Date().toISOString() } };
fs.writeFileSync("graph.json", JSON.stringify(graph, null, 2));
console.log(`✅ graph.json written  nodes:${nodes.length}  edges:${edges.length}`);
