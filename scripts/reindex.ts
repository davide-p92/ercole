import fs from "fs";
import path from "path";
import crypto from "crypto";
import matter from "gray-matter";
import Database from "better-sqlite3";
import { NOTES_DIR } from "./_paths";
import { openDb, initSchema } from "./init-db";

type Frontmatter = {
	id: string;
	title: string;
	created: string;	// YYYY-MM-DD
	updated: string;	// YYYY-MM-DD
	tags?: string[];
	links?: string[];
	status?: "draft" | "active" | "archived";
	source?: string;
};

type IndexedNote = {
	id: string;
	relPath: string;
	title: string;
	created: string;
	updated: string;
	tags: string[];
	links: string[];
	content: string;
	contentHash: string;
};

function walk(dir: string): string[] {
	if (!fs.existsSync(dir)) return [];
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	return entries.flatMap((entry) => {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) return walk(fullPath); 
		if (entry.isFile() && entry.name.endsWith(".md")) return [fullPath];
		return [];
	});
}

function sha256(text: string): string {
	return crypto.createHash("sha256").update(text).digest("hex");
}

function assertIsoDate(d: string, ctx: string) {
	// YYYY-MM-DD simple
	if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
		throw new Error(`Invalid ISO date '${d}' in ${ctx} (expected YYYY-MM-DD)`);
	}
}

function parseNote(fileAbsPath: string): IndexedNote {
	const raw = fs.readFileSync(fileAbsPath, "utf8");
	const parsed = matter(raw);

	const data = parsed.data as Partial<Frontmatter>;
	const relPath = path.relative(NOTES_DIR, fileAbsPath);

	if (!data.id) throw new Error(`Missing 'id' in frontmatter: ${relPath}`);
	if (!data.title) throw new Error(`Missing 'title' in frontmatter: ${relPath}`);
	if (!data.created) throw new Error(`Missing 'created' in frontmatter: ${relPath}`);
	if (!data.updated) throw new Error(`Missing 'updated' in frontmatter: ${relPath}`);

	assertIsoDate(data.created, relPath);
	assertIsoDate(data.updated, relPath);
	
	const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
	const links = Array.isArray(data.links) ? data.links.map(String) : [];

	// Indexable content: body with no frontmatter
	const content = (parsed.content ?? "").trim();

	// Hash: full raw to be conservative
	const contentHash = sha256(raw);

	return {
		id: String(data.id),
		relPath,
		title: String(data.title),
		created: String(data.created),
		updated: String(data.updated),
		tags,
		links,
		content,
		contentHash,
	};
}

function reindex(db: Database.Database) {
	initSchema(db);

	const files = walk(NOTES_DIR);
	const notes: IndexedNote[] = files.map(parseNote);

	// Glob validations (unique ids)
	const seen = new Set<string>();
	for (const n of notes) {
		if (seen.has(n.id)) throw new Error(`Duplicate note id: ${n.id}`);
		seen.add(n.id);
	}

	const tx = db.transaction(() => {
		// "Full rebuild" of cache (DB derivable)
		db.exec("DELETE FROM note_tags;");
		db.exec("DELETE FROM  note_links;");
		db.exec("DELETE FROM notes_fts;");
		db.exec("DELETE FROM notes;");

		const insertNote = db.prepare(`
			INSERT INTO notes (id, path, title, created, updated, content_hash)
			VALUES (@id, @path, @title, @created, @updated, @content_hash);
		`);
		const insertTag = db.prepare(`
			INSERT INTO note_tags (note_id, tag) VALUES (?, ?);
		`);
		const insertLink = db.prepare(`
			INSERT INTO note_links (from_id, to_id) VALUES (?, ?);
		`);
		const insertFts = db.prepare(`
			INSERT INTO notes_fts (note_id, content) VALUES (?, ?);
		`);

		for (const n of notes) {
			insertNote.run({
				id: n.id,
				path: n.relPath,
				title: n.title,
				created: n.created,
				updated: n.updated,
				content_hash: n.contentHash,
			});
			
			for (const tag of n.tags)
				insertTag.run(n.id, tag);
			for (const toId of n.links)
				insertLink.run(n.id, toId);

			// Indicizza il testo
			insertFts.run(n.id, n.content);
		}
	});

	tx();

	return { count: notes.length };
}

if (require.main === module) {
	const db = openDb();
	try {
		const { count } = reindex(db);
		console.log(`Reindex OK. Notes indexed: ${count}`);
	} catch(err) {
		console.error("Reindex failed:");
		console.error(err);
		process.exitCode = 1;
	} finally {
		db.close();
	}
}
			
