import fs from 'fs';
import path from 'path';
import initSqlJs, { Database as SqlJsDatabase, QueryExecResult } from 'sql.js';

export class SQLiteDB {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;

  constructor(dbPath: string = './notes.db') {
    this.dbPath = path.resolve(process.cwd(), dbPath);
  }

  async open(): Promise<void> {
    if (this.db) return;

    try {
      const SQL = await initSqlJs();
      
      if (fs.existsSync(this.dbPath)) {
        const fileBuffer = fs.readFileSync(this.dbPath);
        this.db = new SQL.Database(fileBuffer);
      } else {
        this.db = new SQL.Database();
        // Initialize with default pragmas
        this.exec(`
          PRAGMA journal_mode = WAL;
          PRAGMA synchronous = NORMAL;
          PRAGMA foreign_keys = ON;
        `);
      }
    } catch (error) {
      console.error('Failed to open database:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      // Save to file
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
      
      this.db.close();
      this.db = null;
    }
  }

  exec(sql: string): void {
    if (!this.db) throw new Error('Database not open');
    this.db.exec(sql);
  }

  run(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number | null } {
    if (!this.db) throw new Error('Database not open');
    const stmt = this.db.prepare(sql);
    stmt.run(params);
    const changes = this.db.getRowsModified();
    
    // Get last insert rowid - handle potential null/undefined
    let lastInsertRowid: number | null = null;
    try {
      const result: QueryExecResult[] = this.db.exec("SELECT last_insert_rowid()");
      if (result && result.length > 0 && result[0] && result[0].values && result[0].values.length > 0 && result[0].values[0].length > 0) {
        const value = result[0].values[0][0];
        if (typeof value === 'number') {
          lastInsertRowid = value;
        }
      }
    } catch (error) {
      // Ignore if we can't get last insert rowid
    }
    
    stmt.free();
    return { changes, lastInsertRowid };
  }

  all(sql: string, params: any[] = []): any[] {
    if (!this.db) throw new Error('Database not open');
    const stmt = this.db.prepare(sql);
    const results: any[] = [];
    stmt.bind(params);
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  get(sql: string, params: any[] = []): any {
    if (!this.db) throw new Error('Database not open');
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const result = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return result;
  }

  prepare(sql: string): {
    run: (params?: any[]) => void;
    all: (params?: any[]) => any[];
    get: (params?: any[]) => any;
    finalize: () => void;
  } {
    if (!this.db) throw new Error('Database not open');
    const stmt = this.db.prepare(sql);
    
    return {
      run: (params = []) => {
        stmt.run(params);
      },
      all: (params = []) => {
        stmt.bind(params);
        const results: any[] = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.reset();
        return results;
      },
      get: (params = []) => {
        stmt.bind(params);
        const result = stmt.step() ? stmt.getAsObject() : null;
        stmt.reset();
        return result;
      },
      finalize: () => {
        stmt.free();
      }
    };
  }
}
