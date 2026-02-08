const Database = require('better-sqlite3');

try {
  const db = new Database(':memory:');
  const result = db.prepare('SELECT 1 + 1 as sum').get();
  console.log('✅ SQLite test passed:', result);
  db.close();
} catch (error) {
  console.error('❌ SQLite test failed:', error.message);
  console.error('Full error:', error);
}
