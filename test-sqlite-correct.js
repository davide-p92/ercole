// test-sqlite-correct.js
async function testSQLiteWASM() {
  try {
    console.log('Testing SQLite WASM (correct way)...');
    
    // The default export is a function that initializes SQLite
    const initSQLite = (await import('@sqlite.org/sqlite-wasm')).default;
    
    // Initialize SQLite
    const sqlite3 = await initSQLite({
      // Optional: print and error handlers
      print: console.log,
      printErr: console.error,
    });
    
    console.log('SQLite version:', sqlite3.version.libVersion);
    
    // Create an in-memory database
    const db = new sqlite3.oo1.DB(':memory:');
    
    // Create a table
    db.exec(`
      CREATE TABLE IF NOT EXISTS test (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Insert data
    db.exec(`
      INSERT INTO test (name) VALUES ('Alice');
      INSERT INTO test (name) VALUES ('Bob');
      INSERT INTO test (name) VALUES ('Charlie');
    `);
    
    // Query data
    const result = db.exec(`
      SELECT * FROM test ORDER BY name
    `, { returnValue: 'resultRows' });
    
    console.log('Query result:', result);
    
    // Get row count
    const count = db.exec(`
      SELECT COUNT(*) as count FROM test
    `, { returnValue: 'resultRows' });
    
    console.log('Total rows:', count[0].count);
    
    // Close database
    db.close();
    
    console.log('✅ SQLite WASM test passed!');
    return true;
    
  } catch (error) {
    console.error('❌ SQLite WASM test failed:', error);
    console.error('Full error:', error.stack || error);
    return false;
  }
}

// Run the test
testSQLiteWASM();
