// scripts/init-db.ts
import { openDb } from './wasm-sqlite-wrapper';
import path from 'path';

const DB_PATH = path.resolve(__dirname, '../notes.db');

export async function initSchema(db: any): Promise<void> {
  console.log('Creating database schema...');
  
  // Enable foreign keys
  db.exec("PRAGMA foreign_keys = ON");
  
  // Create notes table
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
  
  // Create FTS5 virtual table for full-text search
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      note_id UNINDEXED,
      content,
      tokenize = 'porter unicode61'
    )
  `);
  
  console.log('✅ Database schema created');
}

// Self-executing when run directly
if (require.main === module) {
  (async () => {
    try {
      console.log(`Initializing database at ${DB_PATH}...`);
      
      const db = await openDb();
      await initSchema(db);
      
      // Test the schema
      const tables = db.all(`
        SELECT name FROM sqlite_master 
        WHERE type='table' 
        ORDER BY name
      `);
      
      console.log('\nDatabase tables created:');
      tables.forEach((table: any) => {
        console.log(`  - ${table.name}`);
      });
      
      await db.close();
      console.log(`\n✅ Database initialized successfully at ${DB_PATH}`);
      
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      process.exit(1);
    }
  })();
}
