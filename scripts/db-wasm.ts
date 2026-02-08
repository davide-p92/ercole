import { WasmSQLiteDB, openDb } from './wasm-db';
import path from 'path';

const DB_PATH = path.resolve(__dirname, '../notes.db');

export async function initSchema(db: WasmSQLiteDB): Promise<void> {
  console.log('Creating database schema...');
  
  // Create main notes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      title TEXT NOT NULL,
      created TEXT NOT NULL,
      updated TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      UNIQUE(id)
    )
  `);
  
  // Create tags table
  db.exec(`
    CREATE TABLE IF NOT EXISTS note_tags (
      note_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      UNIQUE(note_id, tag)
    )
  `);
  
  // Create links table
  db.exec(`
    CREATE TABLE IF NOT EXISTS note_links (
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      FOREIGN KEY (from_id) REFERENCES notes(id) ON DELETE CASCADE,
      UNIQUE(from_id, to_id)
    )
  `);
  
  // Create search table (simple LIKE-based search)
  db.exec(`
    CREATE TABLE IF NOT EXISTS note_content (
      note_id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    )
  `);
  
  // Create indexes for better performance
  db.exec('CREATE INDEX IF NOT EXISTS idx_note_tags_note_id ON note_tags(note_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_note_links_from_id ON note_links(from_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_note_content_content ON note_content(content)');
  
  console.log('Database schema created successfully');
}

// Self-executing when run directly
if (require.main === module) {
  (async () => {
    try {
      const db = await openDb();
      await initSchema(db);
      console.log(`✅ Database initialized at ${DB_PATH}`);
      await db.close();
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      process.exit(1);
    }
  })();
}
