// debug-sqlite.js
async function debugSQLite() {
  try {
    console.log('Debugging SQLite WASM import...');
    
    // Try different import methods
    const module1 = await import('@sqlite.org/sqlite-wasm');
    console.log('Method 1 - Full module:', Object.keys(module1));
    
    // Try accessing default
    console.log('Method 1 - Has default?', 'default' in module1);
    if (module1.default) {
      console.log('Method 1 - Default type:', typeof module1.default);
    }
    
    // Try direct properties
    console.log('Method 1 - Direct version property?', 'version' in module1);
    console.log('Method 1 - Direct oo1 property?', 'oo1' in module1);
    
  } catch (error) {
    console.error('Debug error:', error);
  }
}

debugSQLite();
