import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from "@shared/schema";

// Always use PostgreSQL (Supabase) - no more SQLite
neonConfig.webSocketConstructor = ws;

let db: any;
let pool: any = null;

async function initializeDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle({ client: pool, schema });
  
  console.log('✅ PostgreSQL database initialized (Supabase)');
}

// Initialize database
initializeDatabase();

export { db, pool };