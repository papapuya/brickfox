/**
 * API Version 1 Routes
 * All API endpoints are versioned for backward compatibility
 */

import { Express } from 'express';
import { registerRoutes } from './routes-supabase';

/**
 * Register versioned API routes
 * This allows for future API versions (v2, v3, etc.) without breaking existing clients
 */
export function registerVersionedRoutes(app: Express) {
  // Version 1 API (current)
  const v1Router = app;
  
  // Register all current routes as v1
  // In the future, we can add:
  // app.use('/api/v2', registerV2Routes());
  
  return registerRoutes(v1Router);
}

// For backward compatibility, also expose at /api/v1
export function setupApiVersioning(app: Express) {
  // Current routes are at /api/* (v1)
  // Future: app.use('/api/v1', v1Routes);
  // Future: app.use('/api/v2', v2Routes);
  
  // Health checks are not versioned
  // app.get('/health', ...) - stays at root
  
  logger.info('[API Versioning] API v1 available at /api/*');
}

