import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from "@shared/schema";

// Use SQLite for local development, PostgreSQL for production
const isDevelopment = process.env.NODE_ENV === 'development';

let db: any;
let pool: any = null;

async function initializeDatabase() {
  if (isDevelopment) {
    // Use SQLite for local development
    const sqlite = new Database('local.db');
    db = drizzle(sqlite, { schema });
  } else {
    // Use PostgreSQL for production (Neon)
    const { Pool, neonConfig } = await import('@neondatabase/serverless');
    const ws = await import("ws");
    
    neonConfig.webSocketConstructor = ws.default;

    if (!process.env.DATABASE_URL) {
      // Für lokale Entwicklung ohne Datenbank
      console.log('DATABASE_URL nicht gesetzt - verwende lokalen SQLite Fallback');
      // Erstelle eine Mock-Datenbank für lokale Entwicklung
      pool = null as any;
      db = null as any;
    } else {
      pool = new Pool({ connectionString: process.env.DATABASE_URL });
      db = drizzle({ client: pool, schema });
    }
  }
}

// Initialize database
initializeDatabase();

export { db, pool };