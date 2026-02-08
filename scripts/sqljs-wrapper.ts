// scripts/sqljs-wrapper.ts
import fs from 'fs';
import path from 'path';
import initSqlJs, { Database } from 'sql.js';

const DB_PATH = path.resolve(__dirname, '../notes.db');

export class SQLJSWrapper {
  private db: Database | null = null;
  private dbPath: string;

  constructor(dbPath: string = DB_PATH) {
    this.dbPath = path.resolve(dbPath);
  }

  async init(): Promise<void> {
    if (this.db) return;

    try {
      console.log('Initializing SQL.js...');
      
      // Initialize SQL.js
      const SQL = await initSqlJs({
        // Use the wasm file from the package
        locateFile: (file: string) => {
          // Try local node_modules first
          const localPath = path.join(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm');
          if (fs.existsSync(localPath)) {
            return localPath;
          }
          // Fallback to CDN
          return `https://sql.js.org/dist/${file}`;
        }
      });

      // Load existing database or create new one
      if (fs.existsSync(this.dbPath)) {
        console.log(`Loading existing database from ${this.dbPath}`);
        const buffer = fs.readFileSync(this.dbPath);
        this.db = new SQL.Database(new Uint8Array(buffer));
      } else {
        console.log(`Creating new database at ${this.dbPath}`);
        this.db = new SQL.Database();
        // Initialize with pragmas
        this.exec("PRAGMA journal_mode = WAL");
        this.exec("PRAGMA synchronous = NORMAL");
        this.exec("PRAGMA foreign_keys = ON");
      }

      console.log('SQL.js initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SQL.js:', error);
      throw error;
    }
  }

  exec(sql: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run(sql);
  }

  query(sql: string, params: any[] = []): any[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    
    const results: any[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    
    stmt.free();
    return results;
  }

  run(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number } {
    if (!this.db) throw new Error('Database not initialized');
    
    this.exec(sql);
    
    return {
      changes: this.db.getRowsModified(),
      lastInsertRowid: this.getLastInsertRowid()
    };
  }

  private getLastInsertRowid(): number {
    if (!this.db) return 0;
    
    try {
      const result = this.db.exec("SELECT last_insert_rowid()");
      
      // Safe access with optional chaining and nullish checks
      if (result && 
          result.length > 0 && 
          result[0] && 
          result[0].values && 
          result[0].values.length > 0 && 
          result[0].values[0] && 
          result[0].values[0].length > 0) {
        
        const value = result[0].values[0][0];
        if (typeof value === 'number') {
          return value;
        }
      }
    } catch (error) {
      console.warn('Could not get last insert rowid:', error);
    }
    
    return 0;
  }

  prepare(sql: string): any {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.prepare(sql);
  }

  async close(): Promise<void> {
    if (this.db) {
      // Export and save to file
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
      
      this.db.close();
      this.db = null;
      console.log(`Database saved to ${this.dbPath}`);
    }
  }

  transaction(callback: () => void): void {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      this.exec("BEGIN TRANSACTION");
      callback();
      this.exec("COMMIT");
    } catch (error) {
      this.exec("ROLLBACK");
      throw error;
    }
  }
}

// Factory function
export async function openDb(dbPath: string = DB_PATH): Promise<SQLJSWrapper> {
  const db = new SQLJSWrapper(dbPath);
  await db.init();
  return db;
}

// Test function
export async function testSQLJS(): Promise<boolean> {
  try {
    console.log('Testing SQL.js...');
    
    const db = new SQLJSWrapper(':memory:');
    await db.init();
    
    // Create table
    db.exec(`
      CREATE TABLE test (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        value INTEGER
      )
    `);
    
    // Insert data
    db.run("INSERT INTO test (name, value) VALUES (?, ?)", ["Test 1", 100]);
    db.run("INSERT INTO test (name, value) VALUES (?, ?)", ["Test 2", 200]);
    
    // Query data
    const results = db.query("SELECT * FROM test");
    console.log('Query results:', results);
    
    // Test transaction
    db.transaction(() => {
      db.run("UPDATE test SET value = ? WHERE name = ?", [150, "Test 1"]);
      db.run("UPDATE test SET value = ? WHERE name = ?", [250, "Test 2"]);
    });
    
    const updated = db.query("SELECT * FROM test");
    console.log('Updated results:', updated);
    
    await db.close();
    
    console.log('✅ SQL.js test passed!');
    return true;
  } catch (error) {
    console.error('❌ SQL.js test failed:', error);
    return false;
  }
}

// Run test if called directly
if (require.main === module) {
  testSQLJS().then(success => {
    process.exit(success ? 0 : 1);
  });
}
