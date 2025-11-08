/**
 * Database Module
 * 
 * NOTE: This module is kept for backward compatibility but is no longer used.
 * All database operations now go through Supabase API via repositories.
 * 
 * The app uses Supabase API directly through repositories, which is more reliable
 * and doesn't require a direct database connection.
 */

import { logger } from './utils/logger';

// Legacy exports for backward compatibility
// These are no longer used - repositories use Supabase API directly
let db: any = null;
let pool: any = null;

logger.info('[Database] Using Supabase API for all database operations (no direct DB connection needed)');

export { db, pool };