import { openDb, initSchema } from "./init-db";

const query = process.argv.slice(2).join("").trim();
if (!query) {
	console.error('Usage: pnpm search "your query"');
	process.exit(1);
}

const db = openDb();
try {
	initSchema(db);

	// FTS5: MATCH uses FTS syntax (may improve escaping later on
	const stmt = db.prepare(`
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
	`);

	const rows = stmt.all(query) as Array<{ id: string; title: string; path: string; snippet: string }>;

	if (rows.length === 0) {
		console.log("No results.");
	} else {
		for (const r of rows) {
			console.log(` - [${r.id}] ${r.title} (${r.path})`);
			console.log(`  ${r.snippet}`);
		}
	}
} finally {
	db.close();
}
