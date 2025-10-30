import { Client } from 'pg';
import * as fs from 'fs';

async function runMigration() {
  // Direct PostgreSQL connection to Supabase
  const connectionString = `postgresql://postgres.lxemqwvdaxzeldpjmxoc:${process.env.SUPABASE_SERVICE_ROLE_KEY?.split('.')[2]}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;
  
  // Try alternative connection method
  const client = new Client({
    host: 'aws-0-eu-central-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.lxemqwvdaxzeldpjmxoc',
    password: process.env.SUPABASE_DB_PASSWORD || 'AkkuShop2024!Secure',
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('✅ Connected!\n');

    // Read migration
    const sql = fs.readFileSync('server/migrations/001_add_organizations.sql', 'utf-8');
    
    console.log('📝 Running migration...\n');
    await client.query(sql);
    console.log('✅ Migration completed!\n');

    // Setup organization
    const akkushopOrgId = '16fcf886-e17c-46f0-96f9-56f4aedf7707';
    await client.query(`
      INSERT INTO organizations (id, name, slug, settings)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET name = $2, slug = $3, settings = $4
    `, [akkushopOrgId, 'AkkuShop', 'akkushop', JSON.stringify({
      default_categories: ['battery', 'charger', 'tool'],
      mediamarkt_title_format: 'Kategorie + Artikelnummer'
    })]);
    console.log('✅ AkkuShop organization created\n');

    // Assign user
    const userId = 'f1289d69-1fdf-4501-8a38-5b0d8b4d23cd';
    await client.query(`
      UPDATE users 
      SET organization_id = $1, role = $2, updated_at = NOW()
      WHERE id = $3
    `, [akkushopOrgId, 'admin', userId]);
    console.log('✅ User assigned to organization\n');

    // Verify
    const result = await client.query(
      'SELECT id, email, organization_id, role FROM users WHERE id = $1',
      [userId]
    );
    console.log('✅ Verification:');
    console.log(JSON.stringify(result.rows[0], null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
