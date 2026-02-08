// scripts/wasm-sqlite-wrapper.ts
import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve(__dirname, '../notes.db');

// Type definitions for sqlite-wasm
interface SQLiteWASM {
  version: {
    libVersion: string;
    sourceId: string;
  };
  oo1: {
    DB: new (path: string, mode?: string) => any;
  };
  opfs?: {
    OpfsDB: new (path: string, mode?: string) => any;
  };
}

export class WasmSQLiteDB {
  private db: any = null;
  private dbPath: string;
  private sqlite3: SQLiteWASM | null = null;

  constructor(dbPath: string = DB_PATH) {
    this.dbPath = dbPath;
  }

  async init(): Promise<void> {
    if (this.db) return;

    try {
      console.log('Initializing SQLite WASM...');
      
      // Import and initialize
      const initSQLite = (await import('@sqlite.org/sqlite-wasm')).default;
      this.sqlite3 = await initSQLite({
        print: console.log,
        printErr: console.error,
      });
      
      console.log(`SQLite version: ${this.sqlite3.version.libVersion}`);
      
      // Check if we can use OPFS (for browsers) or regular file system
      if (fs.existsSync(this.dbPath)) {
        console.log(`Loading existing database from ${this.dbPath}...`);
        const dbBytes = fs.readFileSync(this.dbPath);
        
        // Create temporary in-memory DB
        this.db = new this.sqlite3.oo1.DB(':memory:');
        
        // Import the bytes
        const p = this.sqlite3.wasm.allocFromTypedArray(dbBytes);
        this.db.close();
        this.db = new this.sqlite3.oo1.DB(p, 'c');
        this.sqlite3.wasm.dealloc(p);
      } else {
        console.log(`Creating new database at ${this.dbPath}...`);
        this.db = new this.sqlite3.oo1.DB(this.dbPath, 'c');
      }
      
      // Set pragmas for better performance
      this.exec("PRAGMA journal_mode = WAL");
      this.exec("PRAGMA synchronous = NORMAL");
      this.exec("PRAGMA foreign_keys = ON");
      this.exec("PRAGMA busy_timeout = 5000");
      
      console.log('SQLite WASM initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize SQLite WASM:', error);
      throw error;
    }
  }

  exec(sql: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.exec(sql);
  }

  run(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number } {
    if (!this.db) throw new Error('Database not initialized');
    
    // Prepare statement
    const stmt = this.db.prepare(sql);
    try {
      if (params && params.length > 0) {
        stmt.bind(params);
      }
      stmt.step();
      
      const changes = this.db.changes();
      const lastInsertRowid = this.db.lastInsertRowid;
      
      return { changes, lastInsertRowid };
    } finally {
      stmt.finalize();
    }
  }

  all(sql: string, params: any[] = []): any[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(sql);
    try {
      if (params && params.length > 0) {
        stmt.bind(params);
      }
      
      const results = [];
      while (stmt.step()) {
        results.push(stmt.get({}));
      }
      
      return results;
    } finally {
      stmt.finalize();
    }
  }

  get(sql: string, params: any[] = []): any {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(sql);
    try {
      if (params && params.length > 0) {
        stmt.bind(params);
      }
      
      return stmt.step() ? stmt.get({}) : null;
    } finally {
      stmt.finalize();
    }
  }

  prepare(sql: string): any {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.prepare(sql);
  }

  async close(): Promise<void> {
    if (this.db && this.sqlite3) {
      try {
        // Export database to bytes
        const bytes = this.db.export();
        
        // Save to file
        if (this.dbPath !== ':memory:') {
          const buffer = Buffer.from(bytes);
          fs.writeFileSync(this.dbPath, buffer);
          console.log(`Database saved to ${this.dbPath}`);
        }
        
        this.db.close();
        this.db = null;
        console.log('Database closed');
      } catch (error) {
        console.error('Error closing database:', error);
        throw error;
      }
    }
  }

  transaction<T>(callback: () => T): T {
    if (!this.db) throw new Error('Database not initialized');
    
    this.exec("BEGIN TRANSACTION");
    try {
      const result = callback();
      this.exec("COMMIT");
      return result;
    } catch (error) {
      this.exec("ROLLBACK");
      throw error;
    }
  }
}

// Factory function to create and initialize database
export async function openDb(dbPath: string = DB_PATH): Promise<WasmSQLiteDB> {
  const db = new WasmSQLiteDB(dbPath);
  await db.init();
  return db;
}

// Test function
export async function testWasmSQLite(): Promise<boolean> {
  try {
    console.log('Testing WASM SQLite...');
    
    const db = new WasmSQLiteDB(':memory:');
    await db.init();
    
    // Create table
    db.exec(`
      CREATE TABLE test_table (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        value INTEGER
      )
    `);
    
    // Insert data
    db.run("INSERT INTO test_table (name, value) VALUES (?, ?)", ["Alice", 100]);
    db.run("INSERT INTO test_table (name, value) VALUES (?, ?)", ["Bob", 200]);
    
    // Query data
    const results = db.all("SELECT * FROM test_table");
    console.log('Query results:', results);
    
    // Test transaction
    db.transaction(() => {
      db.run("UPDATE test_table SET value = ? WHERE name = ?", [150, "Alice"]);
      db.run("UPDATE test_table SET value = ? WHERE name = ?", [250, "Bob"]);
    });
    
    const updated = db.all("SELECT * FROM test_table");
    console.log('Updated results:', updated);
    
    await db.close();
    
    console.log('✅ WASM SQLite test passed!');
    return true;
  } catch (error) {
    console.error('❌ WASM SQLite test failed:', error);
    return false;
  }
}

// Run test if called directly
if (require.main === module) {
  testWasmSQLite().then(success => {
    process.exit(success ? 0 : 1);
  });
}
