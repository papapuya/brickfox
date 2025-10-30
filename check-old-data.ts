import Database from 'better-sqlite3';

const db = new Database('local.db');

try {
  // Get all tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('📋 Tabellen in alter Datenbank:');
  tables.forEach((table: any) => console.log(`  - ${table.name}`));
  
  // Check suppliers
  try {
    const suppliers = db.prepare("SELECT * FROM suppliers").all();
    console.log(`\n🏢 Lieferanten gefunden: ${suppliers.length}`);
    if (suppliers.length > 0) {
      console.log('\nErste 3 Lieferanten:');
      suppliers.slice(0, 3).forEach((s: any) => {
        console.log(`  - ID: ${s.id}, Name: ${s.name}, Website: ${s.website || 'N/A'}`);
      });
    }
  } catch (e) {
    console.log('⚠️ Keine suppliers Tabelle gefunden');
  }
  
  // Check projects
  try {
    const projects = db.prepare("SELECT * FROM projects").all();
    console.log(`\n📁 Projekte gefunden: ${projects.length}`);
  } catch (e) {
    console.log('⚠️ Keine projects Tabelle gefunden');
  }
  
  // Check products
  try {
    const products = db.prepare("SELECT * FROM products_in_projects").all();
    console.log(`📦 Produkte gefunden: ${products.length}`);
  } catch (e) {
    console.log('⚠️ Keine products Tabelle gefunden');
  }
  
} catch (error: any) {
  console.error('❌ Fehler:', error.message);
} finally {
  db.close();
}
