const fs = require('fs');

// Test sqlite-wasm without TypeScript complications
async function testWasmSQLite() {
  try {
    console.log('Testing SQLite WASM...');
    
    // Dynamically import
    const sqlite3 = await import('@sqlite.org/sqlite-wasm');
    console.log('SQLite version:', sqlite3.version.libVersion);
    
    // Create in-memory database
    const db = new sqlite3.oo1.DB(':memory:');
    
    // Create a table
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
    
    // Insert data
    db.exec('INSERT INTO test (name) VALUES ("test1"), ("test2")');
    
    // Query data
    const results = db.exec('SELECT * FROM test', { returnValue: 'resultRows' });
    console.log('Query results:', results);
    
    // Cleanup
    db.close();
    
    console.log('✅ SQLite WASM test passed!');
    return true;
  } catch (error) {
    console.error('❌ SQLite WASM test failed:', error);
    return false;
  }
}

// Run test
testWasmSQLite();
