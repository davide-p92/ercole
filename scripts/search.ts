import { openDb, initSchema } from "./init-db";


const query = process.argv.slice(2).join("").trim();
if (!query) {
	console.error('Usage: pnpm search "your query"');
	process.exit(1);
}


(async () => {
	const db = await openDb();
	try {
		await initSchema(db);
	// FTS5: MATCH uses FTS syntax (may improve escaping later on
		const results = db.all(`
			SELECT
				n.id,
				n.title,
				n.path,
				snippet(notes_fts, 1, '[', ']', '...', 12) AS snippet
			FROM notes_fts
			JOIN notes n ON n.id = notes_fts.note_id
			WHERE notes_fts MATCH ?
			ORDER BY rank
			LIMIT 20;
		`, [query, query, query, query]);

	//const rows = stmt.all(query) as Array<{ id: string; title: string; path: string; snippet: string }>;

		if (results.length === 0) {
			console.log("No results.");
		} else {
			console.log(`Found ${results.length} results:`);
			for (const r of results) {
				console.log(`\n - [${r.id}] ${r.title} (${r.path})`);
				if (r.snippet) 
					console.log(`  ${r.snippet}`);
			}
		}
	} finally {
		await db.close();
	}
})().catch(console.error);

//search().catch(console.error);
