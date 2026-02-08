import fs from "fs";
import Database from "better-sqlite3";
import { APP_DIR, DB_PATH } from "./_paths";

export function openDb() {
	fs.mkdirSync(APP_DIR, { recursive: true });
	const db = new Database(DB_PATH);

	// Good practices for SQLite local
	db.pragma("journal_mode = WAL");
	db.pragma("synchronous = NORMAL");
	db.pragma("foreign_keys = ON");

	return db;
}

export function initSchema(db: Database.Database) {
	// Main tables
	db.exec(`
		CREATE TABLE IF NOT EXISTS notes (
			id TEXT PRIMARY KEY,
			path TEXT NOT NULL UNIQUE,
			title TEXT NOT NULL,
			created TEXT NOT NULL,
			updated TEXT NOT NULL,
			content_hash TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS note_tags (
			note_id TEXT NOT NULL,
			tag TEXT NOT NULL,
			PRIMARY KEY (note_id, tag),
			FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
		);

		CREATE TABLE IF NOT EXISTS note_links (
			from_id TEXT NOT NULL,
			to_id TEXT NOT NULL,
			PRIMARY KEY (from_id, to_id),
			FOREIGN KEY (from_id) REFERENCES notes(id) ON DELETE CASCADE
			-- to_id may refer to not yet present notes; we keep it free for now
		);
	`);
	
	// FTS5 (indexed content separated from table notes for simplicity/robustness
	// note_id is the "key" binding FTS -> notes
	db.exec(`
		CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
			note_id,
			content,
			tokenize = 'unicode61'
		);
	`);

	// Useful indexes
	db.exec(`
		CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated);
		CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON note_tags(tag);
		CREATE INDEX IF NOT EXISTS idx_note_links_from ON note_links(from_id);
		CREATE INDEX IF NOT EXISTS idx_note_links_to ON note_links(to_id);
	`);
}

if (require.main == module) {
	const db = openDb();
	try {
		initSchema(db);
		console.log(`DB initialized at ${DB_PATH}`);
	} finally {
		db.close();
	}
}

