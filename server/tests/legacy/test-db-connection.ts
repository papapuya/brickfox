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

async function testConnection() {
  try {
    const dbUrl = process.env.DATABASE_URL;
    
    if (!dbUrl) {
      console.error('❌ DATABASE_URL not found');
      process.exit(1);
    }
    
    console.log('Testing database connection...');
    console.log('URL (masked):', dbUrl.replace(/:[^:@]+@/, ':***@'));
    
    const isSupabase = dbUrl.includes('supabase.co');
    const pool = new Pool({ 
      connectionString: dbUrl,
      ssl: isSupabase ? { rejectUnauthorized: false } : false
    });
    
    // Try a simple query directly with pool
    const result = await pool.query('SELECT 1 as test');
    
    console.log('✅ Database connection successful!');
    console.log('Test query result:', result.rows);
    
    await pool.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Database connection failed:');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testConnection();

