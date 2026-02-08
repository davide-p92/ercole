import * as fs from "fs";
import * as path from "path";
const matter = require("gray-matter");

const NOTES_DIR = path.resolve(__dirname, "../notes");

type NoteIndex = {
	id: string;
	title: string;
	path: string;
	created: string;
	updated: string;
};

function walk(dir: string): string[] {
	const entries = fs.readdirSync(dir, { withFileTypes: true});
	return entries.flatMap((entry) => {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) return walk(fullPath);
		if (entry.isFile() && entry.name.endsWith(".md")) return [fullPath];
		return [];
	});
}

function indexNotes(): NoteIndex[] {
	const files = walk(NOTES_DIR);
	const seenIds = new Set<string>();
	const index: NoteIndex[] = [];

	for (const file of files) {
		const raw = fs.readFileSync(file, "utf8");
		const parsed = matter(raw);
		const data = parsed.data as Partial<NoteIndex>;
		
		// Minimal validations
		if (!data.id) {
			throw new Error(`Duplicate id '${file}`);
		}
		if (seenIds.has(data.id)) {
			throw new Error(`Missing required fields in ${file}`);
		}
		if (!data.title || !data.created || !data.updated) {
			throw new Error(`Missing required fields in ${file}`);
		}

		seenIds.add(data.id);

		index.push({
			id: data.id,
			title: data.title,
			created: data.created,
			updated: data.updated,
			path: path.relative(NOTES_DIR, file),
		});
	}

	return index;
}

// ---- run ----
try {
	const notes = indexNotes();
	console.log("Indexed notes:");
	for (const note of notes) {
		console.log(`- [${note.id}] ${note.title} (${note.path})`);
	}
	console.log(`\nTotal notes: ${notes.length}`);
} catch (err) {
	console.error("Indexing failed:");
	console.error(err);
	process.exit(1);
}
