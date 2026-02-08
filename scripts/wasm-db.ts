import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve(__dirname, '../notes.db');

// We'll use the sqlite-wasm library
export class WasmSQLiteDB {
  private db: any = null;
  private dbPath: string;
  private sqlite3: any = null;

  constructor(dbPath: string = DB_PATH) {
    this.dbPath = dbPath;
  }

  async init(): Promise<void> {
    // Dynamically import sqlite-wasm
    const sqlite3 = await import('@sqlite.org/sqlite-wasm');
    this.sqlite3 = sqlite3;
    
    console.log('SQLite version:', sqlite3.version.libVersion);
    
    // Create or open database
    if (fs.existsSync(this.dbPath)) {
      const dbBytes = fs.readFileSync(this.dbPath);
      const p = sqlite3.wasm.allocFromTypedArray(dbBytes);
      this.db = new sqlite3.oo1.DB(p, 'c');
      sqlite3.wasm.dealloc(p);
    } else {
      this.db = new sqlite3.oo1.DB(this.dbPath, 'c');
    }
    
    // Set pragmas
    this.exec("PRAGMA journal_mode = WAL");
    this.exec("PRAGMA synchronous = NORMAL");
    this.exec("PRAGMA foreign_keys = ON");
  }

  exec(sql: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.exec(sql);
  }

  run(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number } {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params);
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
      stmt.bind(params);
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
      stmt.bind(params);
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
    if (this.db) {
      // Save to file
      const bytes = this.db.export();
      const buffer = Buffer.from(bytes);
      fs.writeFileSync(this.dbPath, buffer);
      this.db.close();
      this.db = null;
    }
  }

  transaction(callback: () => void): void {
    if (!this.db) throw new Error('Database not initialized');
    
    this.exec("BEGIN TRANSACTION");
    try {
      callback();
      this.exec("COMMIT");
    } catch (error) {
      this.exec("ROLLBACK");
      throw error;
    }
  }
}

export async function openDb(): Promise<WasmSQLiteDB> {
  const db = new WasmSQLiteDB();
  await db.init();
  return db;
}
