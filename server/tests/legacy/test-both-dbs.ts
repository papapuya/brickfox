import pg from 'pg';
const { Pool } = pg;
import fs from 'fs';
import path from 'path';

// Load .env file
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  for (const line of lines) {
    if (line.trim() && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        process.env[key.trim()] = value;
      }
    }
  }
}

async function testConnection(connectionString: string, name: string) {
  try {
    console.log(`\n🔍 Testing ${name}...`);
    console.log(`URL (masked): ${connectionString.replace(/:[^:@]+@/, ':***@')}`);
    
    const isSupabase = connectionString.includes('supabase.co');
    const pool = new Pool({ 
      connectionString: connectionString,
      ssl: isSupabase ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 5000, // 5 second timeout
    });
    
    const result = await pool.query('SELECT 1 as test');
    
    console.log(`✅ ${name} connection successful!`);
    console.log(`   Test query result:`, result.rows[0]);
    
    // Try to get database name
    const dbResult = await pool.query('SELECT current_database() as db_name, version() as version');
    console.log(`   Database: ${dbResult.rows[0].db_name}`);
    console.log(`   Version: ${dbResult.rows[0].version.split(' ')[0]} ${dbResult.rows[0].version.split(' ')[1]}`);
    
    await pool.end();
    return true;
  } catch (error: any) {
    console.error(`❌ ${name} connection failed:`);
    console.error(`   Error code: ${error.code}`);
    console.error(`   Error message: ${error.message}`);
    
    if (error.code === 'ETIMEDOUT') {
      console.error(`   ⚠️  Connection timeout - Port may be blocked by firewall`);
    } else if (error.code === 'ENOTFOUND') {
      console.error(`   ⚠️  Host not found - DNS resolution failed`);
    } else if (error.code === 'ECONNREFUSED') {
      console.error(`   ⚠️  Connection refused - Server may be down or port closed`);
    }
    
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('DATABASE CONNECTION TEST');
  console.log('='.repeat(60));
  
  // Test 1: Current DATABASE_URL from .env
  const currentDbUrl = process.env.DATABASE_URL;
  if (currentDbUrl) {
    await testConnection(currentDbUrl, 'Current DATABASE_URL (.env)');
  } else {
    console.log('\n⚠️  No DATABASE_URL found in environment');
  }
  
  // Test 2: Helium DB (from .replit)
  const heliumDbUrl = 'postgresql://postgres:password@helium/heliumdb?sslmode=disable';
  await testConnection(heliumDbUrl, 'Helium DB (Development)');
  
  // Test 3: Supabase direct connection (port 5432 instead of 6543)
  if (currentDbUrl && currentDbUrl.includes('supabase.co')) {
    const supabaseDirect = currentDbUrl.replace(':6543', ':5432');
    await testConnection(supabaseDirect, 'Supabase Direct (port 5432)');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('RECOMMENDATIONS:');
  console.log('='.repeat(60));
  console.log('1. If Helium DB works: Use it for development');
  console.log('2. If Supabase works: Use it for production');
  console.log('3. If both fail: Check firewall/network settings');
  console.log('4. For Supabase: Try port 5432 instead of 6543');
  
  process.exit(0);
}

main();
