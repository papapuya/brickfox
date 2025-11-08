import type { Express } from "express";
import { createServer, type Server } from "http";
import { supabase, supabaseAdmin } from './supabase';
import { supabaseStorage } from './supabase-storage';
import { createAdminUser, getSupabaseUser } from './supabase-auth';
import { registerUserSchema, loginUserSchema } from '@shared/schema';
// Services
import { ProductService } from './services/product-service';
import { ProjectService } from './services/project-service';
import { SupplierService } from './services/supplier-service';
import { cacheService } from './services/cache-service';
import { validate } from './middleware/validation';
import { logger } from './utils/logger';
import { defaultRateLimit, authRateLimit, apiRateLimit } from './middleware/rate-limit';
// Note: Drizzle ORM imports removed - using Supabase API via repositories instead
import Stripe from 'stripe';
import { 
  createCheckoutSession, 
  createPortalSession, 
  handleWebhookEvent, 
  getSubscriptionStatus,
  PLANS 
} from './stripe-service';
import multer from "multer";
import { analyzeCSV, generateProductDescription, convertTextToHTML, refineDescription, generateProductName, processProductWithNewWorkflow } from "./ai-service";
import { scrapeProduct, scrapeProductList, defaultSelectors, brickfoxSelectors, type ScraperSelectors, performLogin, testSelector } from "./scraper-service";
import { pixiService } from "./services/pixi-service";
import { parseTechnicalData } from "./services/parseTechnicalData";
import { mapProductsToBrickfox, brickfoxRowsToCSV } from "./services/brickfox-mapper";
import { enhanceProductsWithAI } from "./services/brickfox-ai-enhancer";
import { loadMappingsForSupplier, loadMappingsForProject } from "./services/brickfox-mapping-loader";
import Papa from "papaparse";
import { nanoid } from "nanoid";
import { createProjectSchema, createProductInProjectSchema, updateProductInProjectSchema, createSupplierSchema } from "@shared/schema";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'text/csv',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

import { apiKeyManager } from './api-key-manager';
import { emailService } from './services/email-service';
import webhooksRouter from './webhooks-supabase';
import mappingRouter from './routes-mapping';
import { pdfParserService } from './services/pdf-parser';

async function requireAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    console.log(`[requireAuth] No Authorization header or invalid format for ${req.method} ${req.path}`);
    console.log(`[requireAuth] Headers:`, Object.keys(req.headers));
    return res.status(401).json({ error: 'Nicht authentifiziert' });
  }

  const token = authHeader.split(' ')[1];
  if (!token || token.length < 10) {
    console.log(`[requireAuth] Invalid token format (too short or empty)`);
    return res.status(401).json({ error: 'Ungültiges Token' });
  }
  
  console.log(`[requireAuth] Validating token for request: ${req.method} ${req.path}`);
  console.log(`[requireAuth] Token (first 20 chars): ${token.substring(0, 20)}...`);
  console.log(`[requireAuth] Token length: ${token.length}`);
  
  try {
    const user = await getSupabaseUser(token);

    if (!user) {
      console.log(`[requireAuth] User validation failed for ${req.method} ${req.path} - returning 401`);
      console.log(`[requireAuth] Token validation returned null`);
      return res.status(401).json({ error: 'Ungültiges Token' });
    }
    
    console.log(`[requireAuth] User authenticated: ${user.email} (${user.id}) | isAdmin: ${user.isAdmin} | tenantId: ${user.tenantId || 'none'}`);

    req.user = user;
    req.userId = user.id;
    req.tenantId = user.tenantId || null;

    // CRITICAL: Set tenant_id on the ACTUAL Drizzle database connection for RLS
    // Only if user has tenantId and DB connection is available
    if (user.tenantId) {
    try {
      const { pool } = await import('./db');
      if (pool) {
        try {
          const jwtClaims = JSON.stringify({
            sub: user.id,
            tenant_id: user.tenantId,
            role: user.role || 'member',
            user_role: user.role || 'member'
          });
          
          // Set config on the PostgreSQL connection that Drizzle uses
          await pool.query("SELECT set_config('request.jwt.claims', $1, true)", [jwtClaims]);
          console.log(`[RLS] Set tenant context for user ${user.email}: tenant_id=${user.tenantId}`);
        } catch (dbError: any) {
          // If DB connection fails, log but continue - we'll use Supabase API only
          console.warn('[requireAuth] DB connection failed, continuing without RLS context (using Supabase API only):', dbError.message);
        }
      }
    } catch (error: any) {
      // If import fails or pool is null, continue without RLS context
      console.warn('[requireAuth] Could not set tenant context (DB not available), continuing with Supabase API only:', error.message);
    }
    }

    next();
  } catch (error: any) {
    console.error(`[requireAuth] Error during authentication:`, error.message || error);
    console.error(`[requireAuth] Error stack:`, error.stack);
    return res.status(500).json({ error: 'Authentifizierungsfehler' });
  }
}

async function requireAdmin(req: any, res: any, next: any) {
  await requireAuth(req, res, async () => {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: 'Admin-Zugriff erforderlich' });
    }
    next();
  });
}

// Super Admin check: Only for system-wide admin (sarahzerrer@icloud.com)
async function requireSuperAdmin(req: any, res: any, next: any) {
  await requireAuth(req, res, async () => {
    const isSuperAdmin = req.user?.email === 'sarahzerrer@icloud.com';
    if (!isSuperAdmin) {
      return res.status(403).json({ error: 'System-Admin-Zugriff erforderlich' });
    }
    next();
  });
}

// Middleware: Check if tenant has a specific feature enabled
// SIMPLIFIED: Admin users always have access, regular users need tenant check
function requireFeature(featureName: keyof NonNullable<import('@shared/schema').TenantSettings['features']>) {
  return async (req: any, res: any, next: any) => {
    // Admin users always have access to all features (no tenant check needed)
    if (req.user?.isAdmin) {
      console.log(`[requireFeature] ✅ Admin user ${req.user.email} - granting access to ${featureName}`);
      next();
      return;
    }

    // For non-admin users: If they have a tenantId, check tenant features
    // If no tenantId, grant access by default (simplified approach)
    if (!req.user?.tenantId) {
      console.log(`[requireFeature] ⚠️ User ${req.user?.email} has no tenantId - granting access by default`);
      next();
      return;
    }

    // Only check tenant features if tenantId exists
    try {
      const tenant = await supabaseStorage.getTenant(req.user.tenantId);
      if (!tenant) {
        console.log(`[requireFeature] ⚠️ Tenant ${req.user.tenantId} not found - granting access by default`);
        next();
        return;
      }

      const features = tenant.settings?.features || {};
      const isEnabled = features[featureName];

      // Default values: urlScraper, csvBulkImport, aiDescriptions are enabled by default
      const defaultEnabled = ['urlScraper', 'csvBulkImport', 'aiDescriptions'];
      const featureAllowed = defaultEnabled.includes(featureName) 
        ? isEnabled !== false  // Enabled unless explicitly disabled
        : isEnabled === true;  // Disabled unless explicitly enabled

      if (!featureAllowed) {
        console.log(`[requireFeature] ❌ Feature ${featureName} not allowed for tenant ${req.user.tenantId}`);
        return res.status(403).json({ 
          error: `Feature "${featureName}" ist für Ihren Account nicht freigeschaltet. Bitte upgraden Sie Ihr Abonnement.` 
        });
      }

      console.log(`[requireFeature] ✅ Feature ${featureName} allowed for user ${req.user.email}`);
      next();
    } catch (error: any) {
      console.error(`[requireFeature] Error checking tenant features:`, error.message);
      // On error, grant access by default (fail open)
      console.log(`[requireFeature] ⚠️ Error occurred, granting access by default`);
      next();
    }
  };
}

async function checkApiLimit(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Nicht authentifiziert' });
  }

  const user = await supabaseStorage.getUserById(req.user.id);
  
  if (!user) {
    return res.status(404).json({ error: 'Benutzer nicht gefunden' });
  }

  if (user.apiCallsUsed >= user.apiCallsLimit) {
    return res.status(429).json({ 
      error: 'API-Limit erreicht', 
      limit: user.apiCallsLimit,
      used: user.apiCallsUsed 
    });
  }

  next();
}

async function trackApiUsage(req: any, res: any, next: any) {
  if (req.user) {
    await supabaseStorage.incrementApiCalls(req.user.id);
  }
  next();
}

/**
 * Helper function to perform login if supplier has login credentials configured
 * Returns cookies to use for scraping requests
 */
async function getScrapingCookies(supplierId?: string, providedCookies?: string): Promise<string> {
  // If cookies are already provided, use them
  if (providedCookies) {
    console.log('[getScrapingCookies] Using provided cookies');
    return providedCookies;
  }

  // If no supplier ID, return empty cookies
  if (!supplierId) {
    console.log('[getScrapingCookies] No supplier ID, returning empty cookies');
    return '';
  }

  console.log(`[getScrapingCookies] Looking for supplier with ID: ${supplierId}`);

  // SECURITY: Fetch supplier data with decrypted credentials (internal use only)
  const supplier = await supabaseStorage.getSupplierWithCredentials(supplierId);
  if (!supplier) {
    console.log(`[getScrapingCookies] Supplier not found for ID: ${supplierId}`);
    return '';
  }
  
  console.log(`[getScrapingCookies] Found supplier: ${supplier.name}`);

  // Check if supplier has login credentials configured
  if (!supplier.loginUrl || !supplier.loginUsernameField || !supplier.loginPasswordField || 
      !supplier.loginUsername || !supplier.loginPassword) {
    console.log('[getScrapingCookies] Supplier has no login credentials configured');
    return supplier.sessionCookies || '';
  }

  // Perform login and get cookies
  try {
    console.log(`[getScrapingCookies] Performing login for supplier ${supplier.name}`);
    const cookies = await performLogin({
      loginUrl: supplier.loginUrl,
      usernameField: supplier.loginUsernameField,
      passwordField: supplier.loginPasswordField,
      username: supplier.loginUsername,
      password: supplier.loginPassword,
      userAgent: supplier.userAgent
    });

    // Optionally update supplier with session cookies for future use
    if (cookies) {
      await supabaseStorage.updateSupplier(supplierId, { sessionCookies: cookies });
      console.log(`[getScrapingCookies] Updated supplier session cookies`);
    }

    return cookies;
  } catch (error) {
    console.error('[getScrapingCookies] Login failed:', error);
    // Fallback to stored session cookies if login fails
    return supplier.sessionCookies || '';
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ===== HEALTH CHECK ENDPOINTS (for Load Balancer & Kubernetes) =====
  
  // Health check endpoint (basic liveness)
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
    });
  });

  // Readiness check endpoint (checks dependencies)
  app.get('/ready', async (req, res) => {
    try {
      const checks: Record<string, string> = {};
      
      // Check Supabase connection
      if (supabaseAdmin) {
        try {
          const { error } = await supabaseAdmin.from('users').select('id').limit(1);
          checks.database = error ? 'unavailable' : 'connected';
        } catch (err: any) {
          checks.database = 'error';
        }
      } else {
        checks.database = 'not_configured';
      }

      const allHealthy = Object.values(checks).every(status => status === 'connected');
      
      if (allHealthy) {
        res.status(200).json({
          status: 'ready',
          timestamp: new Date().toISOString(),
          services: checks,
        });
      } else {
        res.status(503).json({
          status: 'not ready',
          timestamp: new Date().toISOString(),
          services: checks,
        });
      }
    } catch (error: any) {
      res.status(503).json({
        status: 'not ready',
        reason: 'service_unavailable',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Liveness check endpoint (for Kubernetes)
  app.get('/live', (req, res) => {
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
    });
  });

  // Apply default rate limiting to all API routes
  app.use('/api', defaultRateLimit);

  // OpenAPI/Swagger Documentation
  const { serveOpenApiSpec, serveSwaggerUI } = await import('./middleware/openapi');
  app.get('/api/docs/openapi.json', serveOpenApiSpec);
  app.get('/api/docs', serveSwaggerUI);

  // Contact Form Endpoint
  app.post('/api/contact', async (req, res) => {
    try {
      const { name, company, email, phone, message } = req.body;

      if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, E-Mail und Nachricht sind erforderlich' });
      }

      // Send email to support/admin
      const smtpFrom = process.env.SMTP_FROM || 'noreply@pimpilot.com';
      const adminEmail = process.env.SMTP_USER; // Admin gets the contact form

      if (!adminEmail) {
        console.warn('⚠️ SMTP_USER not configured, cannot send contact form email');
        return res.status(500).json({ error: 'E-Mail-Service nicht konfiguriert' });
      }

      // Prepare email body
      const emailBody = `
Neue Kontaktanfrage von PIMPilot Website
==========================================

Name: ${name}
${company ? `Firma: ${company}` : ''}
E-Mail: ${email}
${phone ? `Telefon: ${phone}` : ''}

Nachricht:
${message}

==========================================
Gesendet am: ${new Date().toLocaleString('de-DE')}
`;

      // Use the email service's transporter directly
      const transporter = (emailService as any).transporter;
      
      if (!transporter) {
        return res.status(500).json({ error: 'E-Mail-Service nicht verfügbar' });
      }

      await transporter.sendMail({
        from: smtpFrom,
        to: adminEmail,
        replyTo: email,
        subject: `PIMPilot Kontaktanfrage von ${name}`,
        text: emailBody,
      });

      console.log(`✅ Contact form submitted by ${name} (${email})`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('❌ Contact form error:', error);
      res.status(500).json({ error: error.message || 'Fehler beim Senden der Nachricht' });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const validatedData = registerUserSchema.parse(req.body);
      
      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Server-Konfigurationsfehler' });
      }

      // Step 1: Create new tenant for this company
      // Generate slug with proper German umlaut handling
      let tenantSlug = validatedData.companyName
        .toLowerCase()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .normalize('NFD') // Decompose remaining combined characters
        .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
        .replace(/[^a-z0-9]+/g, '-') // Replace special chars with dashes
        .replace(/^-+|-+$/g, '') // Remove leading/trailing dashes
        .replace(/--+/g, '-'); // Collapse multiple dashes

      // Ensure non-empty slug (fallback to "company" if empty)
      if (!tenantSlug || tenantSlug.length === 0) {
        tenantSlug = 'company';
      }

      // Handle slug collisions by appending a number
      let finalSlug = tenantSlug;
      let counter = 2;
      let slugExists = true;
      
      while (slugExists) {
        const existing = await supabaseStorage.getTenantBySlug(finalSlug);
        if (!existing) {
          slugExists = false;
        } else {
          finalSlug = `${tenantSlug}-${counter}`;
          counter++;
        }
      }

      console.log(`[Register] Creating tenant: ${validatedData.companyName} (slug: ${finalSlug})`);

      const newTenant = await supabaseStorage.createTenant({
        name: validatedData.companyName,
        slug: finalSlug,
        settings: {
          default_categories: ['battery', 'charger', 'tool', 'gps', 'drone', 'camera'],
          mediamarkt_title_format: 'Kategorie + Artikelnummer'
        }
      });

      console.log(`[Register] Tenant created: ${newTenant.id}`);

      // Step 2: Create user in Supabase Auth with tenant_id in metadata
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: validatedData.email,
        password: validatedData.password,
        email_confirm: true,
        user_metadata: {
          username: validatedData.username || validatedData.email.split('@')[0],
          tenant_id: newTenant.id,
          company_name: validatedData.companyName,
        }
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      if (!data.user) {
        return res.status(400).json({ error: 'Registrierung fehlgeschlagen' });
      }

      // User created successfully in Supabase Auth
      console.log(`[Register] User created in Supabase Auth: ${validatedData.email}`);
      console.log(`[Register] User assigned to tenant: ${newTenant.id} (${validatedData.companyName})`);
      
      // User will be created in Supabase users table via webhook
      // First user of tenant becomes admin (handled by webhook)
      console.log(`✅ [Register] User ${validatedData.email} will be created in Supabase via webhook`);

      const { data: sessionData } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      });

      const user = await supabaseStorage.getUserById(data.user.id);

      res.json({ 
        user, 
        session: sessionData.session,
        access_token: sessionData.session?.access_token 
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Ungültige Registrierungsdaten' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      // Validate request body
      try {
        loginUserSchema.parse(req.body);
      } catch (validationError: any) {
        console.error(`[LOGIN] Validation error:`, validationError.errors);
        return res.status(400).json({ 
          error: 'Ungültige Login-Daten', 
          details: validationError.errors?.[0]?.message || validationError.message 
        });
      }
      
      let emailToUse = req.body.email;
      
      console.log(`[LOGIN] Input: "${emailToUse}", contains @: ${emailToUse.includes('@')}`);
      
      if (!emailToUse.includes('@')) {
        console.log(`[LOGIN] Looking up username: "${emailToUse}"`);
        try {
          const userByUsername = await supabaseStorage.getUserByUsername(emailToUse);
          console.log(`[LOGIN] Username lookup result:`, userByUsername ? `Found: ${userByUsername.email}` : 'Not found');
          if (userByUsername) {
            emailToUse = userByUsername.email;
          } else {
            console.log(`[LOGIN] ⚠️ Username "${emailToUse}" not found in database`);
          }
        } catch (usernameError: any) {
          console.error(`[LOGIN] Error looking up username:`, usernameError.message);
          // Continue with original emailToUse if username lookup fails
        }
      }
      
      console.log(`[LOGIN] Attempting Supabase auth with email: "${emailToUse}"`);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: req.body.password,
      });

      if (error || !data.user) {
        console.log(`[LOGIN] ❌ Supabase auth failed:`, error?.message || 'No user returned');
        console.log(`[LOGIN] Error details:`, JSON.stringify(error, null, 2));
        return res.status(401).json({ error: 'Ungültiger Benutzername/E-Mail oder Passwort' });
      }

      // PRIORITY: Get user from Supabase users table directly (works even if Helium DB is down)
      let user = null;
      if (supabaseAdmin) {
        try {
          const { data: userData, error: userError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .single();
          
          if (!userError && userData) {
            console.log(`[LOGIN] Found user in Supabase users table`);
            user = {
              id: userData.id,
              email: userData.email,
              username: userData.username || undefined,
              isAdmin: userData.is_admin || false,
              tenantId: userData.tenant_id || undefined,
              role: userData.role || 'member',
              subscriptionStatus: userData.subscription_status || undefined,
              planId: userData.plan_id || undefined,
              apiCallsUsed: userData.api_calls_used || 0,
              apiCallsLimit: userData.api_calls_limit || 50,
              createdAt: userData.created_at,
              updatedAt: userData.updated_at,
            };
          }
        } catch (supabaseError: any) {
          console.error(`[LOGIN] Error getting user from Supabase:`, supabaseError.message);
        }
      }
      
      // FALLBACK: Try Helium DB if Supabase lookup failed
      if (!user) {
        try {
          user = await supabaseStorage.getUserById(data.user.id);
          if (user) {
            console.log(`[LOGIN] Found user in Helium DB`);
          }
        } catch (dbError: any) {
          console.error(`[LOGIN] Error getting user from Helium DB:`, dbError.message);
          // Continue - we'll create user if needed
        }
      }

      // AUTO-FIX: If user doesn't exist, create it
      if (!user && data.user.email) {
        console.log(`🔧 [LOGIN AUTO-FIX] User ${data.user.email} exists in Supabase Auth but not in Helium DB. Creating...`);
        
        // Get or create AkkuShop tenant (fallback for legacy users)
        const { data: akkushopTenant } = await supabaseAdmin!
          .from('tenants')
          .select('id')
          .eq('slug', 'akkushop')
          .single();
        
        if (akkushopTenant) {
          const { error: insertError } = await supabaseAdmin!
            .from('users')
            .insert({
              id: data.user.id,
              email: data.user.email,
              username: data.user.email.split('@')[0],
              is_admin: false, // Regular user
              role: 'member',
              tenant_id: akkushopTenant.id,
              subscription_status: 'trial',
              plan_id: 'trial',
              api_calls_limit: 50,
              api_calls_used: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          
          if (insertError) {
            console.error(`❌ Failed to create user in Helium DB:`, insertError);
          } else {
            console.log(`✅ User ${data.user.email} created in Helium DB`);
            user = await supabaseStorage.getUserById(data.user.id);
          }
        }
      }

      // AUTO-FIX: Update old limit to new standard (50 calls)
      if (user && user.apiCallsLimit < 50) {
        console.log(`🔄 Auto-updating ${user.email} to 50 credits (Trial Standard)`);
        await supabaseAdmin!
          .from('users')
          .update({ api_calls_limit: 50 })
          .eq('id', user.id);
        
        // Refresh user data
        user = await supabaseStorage.getUserById(data.user.id);
      }

      res.json({ 
        user,
        session: data.session,
        access_token: data.session?.access_token
      });
    } catch (error: any) {
      console.error(`[LOGIN] ❌ Unexpected error:`, error);
      console.error(`[LOGIN] Error message:`, error.message);
      console.error(`[LOGIN] Error stack:`, error.stack);
      console.error(`[LOGIN] Error name:`, error.name);
      console.error(`[LOGIN] Full error:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      res.status(400).json({ 
        error: 'Ungültige Login-Daten', 
        details: error.message,
        type: error.name || 'UnknownError'
      });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      await supabase.auth.signOut();
    }
    res.json({ success: true });
  });

  app.get('/api/auth/user', async (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }

    const token = authHeader.split(' ')[1];
    const user = await getSupabaseUser(token);

    if (!user) {
      return res.status(401).json({ error: 'Ungültige Session' });
    }

    res.json({ user });
  });

  // Get current user's tenant (for both admins and regular users)
  app.get('/api/user/tenant', requireAuth, async (req: any, res) => {
    try {
      if (!req.user.tenantId) {
        return res.json({ tenant: null });
      }

      const tenant = await supabaseStorage.getTenant(req.user.tenantId);
      
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant nicht gefunden' });
      }

      const stats = await supabaseStorage.getTenantStats(tenant.id);
      
      res.json({
        tenant: {
          ...tenant,
          ...stats,
        },
      });
    } catch (error: any) {
      console.error('Get user tenant error:', error);
      res.status(500).json({ error: error.message || 'Fehler beim Laden des Tenants' });
    }
  });

  // Temporary: Update current user's API limit to 3000
  app.post('/api/auth/update-my-limit', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      
      const { error } = await supabaseAdmin!
        .from('users')
        .update({ 
          api_calls_limit: 50,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      console.log(`✅ Updated user ${user.email} limit from 100 to 3000`);
      
      res.json({ 
        success: true, 
        message: 'Dein API-Limit wurde auf 3.000 erhöht (GPT-4o-mini)',
        oldLimit: 100,
        newLimit: 3000
      });
    } catch (error: any) {
      console.error('Update limit error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/dashboard/stats', requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      
      const projects = await supabaseStorage.getProjectsByUserId(user.id);
      
      let totalProducts = 0;
      for (const project of projects) {
        const products = await supabaseStorage.getProducts(project.id);
        totalProducts += products.length;
      }
      
      const freshUser = await supabaseStorage.getUserById(user.id);
      
      res.json({
        success: true,
        stats: {
          projectCount: projects.length,
          productCount: totalProducts,
          apiCallsUsed: freshUser?.apiCallsUsed || 0,
          apiCallsLimit: freshUser?.apiCallsLimit || 50,
          planId: freshUser?.planId || 'trial',
          subscriptionStatus: freshUser?.subscriptionStatus || 'trial',
        },
        recentProjects: projects.slice(0, 5),
      });
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({ error: 'Fehler beim Laden der Dashboard-Daten' });
    }
  });

  app.get('/api/admin/customers', requireSuperAdmin, async (req, res) => {
    try {
      const users = await supabaseStorage.getAllUsers();
      
      const customersWithStats = await Promise.all(
        users.map(async (user) => {
          const projects = await supabaseStorage.getProjectsByUserId(user.id);
          let totalProducts = 0;
          for (const project of projects) {
            const products = await supabaseStorage.getProducts(project.id);
            totalProducts += products.length;
          }
          
          return {
            ...user,
            projectCount: projects.length,
            productCount: totalProducts,
          };
        })
      );
      
      res.json({
        success: true,
        customers: customersWithStats,
      });
    } catch (error) {
      console.error('Admin customers error:', error);
      res.status(500).json({ error: 'Fehler beim Laden der Kundendaten' });
    }
  });

  app.get('/api/admin/users', requireSuperAdmin, async (req, res) => {
    try {
      const users = await supabaseStorage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: 'Fehler beim Laden der Benutzer' });
    }
  });

  // Initial Admin Setup - nur wenn noch KEIN Admin existiert
  app.post('/api/admin/initial-setup', async (req, res) => {
    try {
      const { email, password, username } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
      }

      // Check if any admin already exists (using Supabase API)
      if (!supabaseAdmin) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
      }
      
      const { data: existingAdmins, error: adminCheckError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('is_admin', true)
        .limit(1);
      
      if (adminCheckError) {
        throw new Error(`Failed to check for existing admins: ${adminCheckError.message}`);
      }

      if (existingAdmins.length > 0) {
        return res.status(403).json({ error: 'Admin-Benutzer existiert bereits' });
      }

      // Create the first admin user with custom username
      if (!supabaseAdmin) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
      }

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (error) throw error;

      const { data: akkushopTenant } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('slug', 'akkushop')
        .single();

      if (!akkushopTenant) {
        console.error('AkkuShop tenant not found for admin user');
      }

      const { error: insertError } = await supabaseAdmin
        .from('users')
        .upsert({
          id: data.user.id,
          email: email,
          username: username || 'Admin',
          is_admin: true,
          role: 'admin',
          tenant_id: akkushopTenant?.id,
          subscription_status: 'trial',
          plan_id: 'trial',
          api_calls_limit: 999999, // Admin: unlimited
          api_calls_used: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id'
        });

      if (insertError) {
        throw new Error(`Failed to create user record: ${insertError.message}`);
      }

      console.log(`✅ Initial Admin user created: ${email} (Username: ${username || 'Admin'})`);
      res.json({ success: true, message: `Admin-Benutzer erstellt: ${username || 'Admin'}` });
    } catch (error: any) {
      console.error('Initial admin setup error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/admin/create-admin', requireSuperAdmin, async (req, res) => {
    try {
      const { email, password, username } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
      }

      await createAdminUser(email, password, username);
      res.json({ 
        success: true, 
        message: 'Admin-Benutzer erstellt',
        email,
        username: username || 'Admin'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Tenant Management Endpoints (Admin only)
  // Get user's own tenant (for regular customers)
  app.get('/api/user/tenant', requireAuth, async (req: any, res) => {
    try {
      const user = req.user; // Already set by requireAuth middleware
      if (!user || !user.tenantId) {
        return res.status(401).json({ error: 'Nicht authentifiziert' });
      }

      const tenant = await supabaseStorage.getTenant(user.tenantId);
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant nicht gefunden' });
      }

      const stats = await supabaseStorage.getTenantStats(tenant.id);

      res.json({
        success: true,
        tenant: {
          ...tenant,
          ...stats,
        },
      });
    } catch (error) {
      console.error('Get user tenant error:', error);
      res.status(500).json({ error: 'Fehler beim Laden des Tenants' });
    }
  });

  app.get('/api/admin/tenants', requireSuperAdmin, async (req, res) => {
    try {
      const tenants = await supabaseStorage.getAllTenants();
      
      // Get stats for each tenant
      const tenantsWithStats = await Promise.all(
        tenants.map(async (tenant) => {
          const stats = await supabaseStorage.getTenantStats(tenant.id);
          return {
            ...tenant,
            ...stats,
          };
        })
      );
      
      res.json({
        success: true,
        tenants: tenantsWithStats,
      });
    } catch (error) {
      console.error('Admin tenants error:', error);
      res.status(500).json({ error: 'Fehler beim Laden der Tenants' });
    }
  });

  app.post('/api/admin/tenants', requireSuperAdmin, async (req, res) => {
    try {
      const { name, settings } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Tenant-Name erforderlich' });
      }

      const tenant = await supabaseStorage.createTenant({ name, settings });
      const stats = await supabaseStorage.getTenantStats(tenant.id);
      
      res.json({
        success: true,
        tenant: {
          ...tenant,
          ...stats,
        },
      });
    } catch (error: any) {
      console.error('Create tenant error:', error);
      res.status(500).json({ error: error.message || 'Fehler beim Erstellen des Tenants' });
    }
  });

  // Bulk delete selected tenants (MUST be before /:id route!)
  app.delete('/api/admin/tenants/bulk-delete', requireSuperAdmin, async (req, res) => {
    try {
      const currentUser = (req as any).user;
      if (!currentUser) {
        return res.status(401).json({ error: 'Nicht authentifiziert' });
      }

      const { tenantIds } = req.body;

      if (!tenantIds || !Array.isArray(tenantIds) || tenantIds.length === 0) {
        return res.status(400).json({ error: 'Keine Tenant-IDs angegeben' });
      }

      // Prevent deleting super-admin's own tenant
      const tenantsToDelete = tenantIds.filter(id => id !== currentUser.tenant_id);

      let deletedCount = 0;
      for (const tenantId of tenantsToDelete) {
        const success = await supabaseStorage.deleteTenant(tenantId);
        if (success) {
          deletedCount++;
        }
      }

      res.json({
        success: true,
        deletedCount,
        message: `${deletedCount} Kunden wurden gelöscht`,
      });
    } catch (error: any) {
      console.error('Bulk delete tenants error:', error);
      res.status(500).json({ error: error.message || 'Fehler beim Löschen der Tenants' });
    }
  });

  app.delete('/api/admin/tenants/:id', requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const success = await supabaseStorage.deleteTenant(id);
      
      if (!success) {
        return res.status(404).json({ error: 'Tenant nicht gefunden oder konnte nicht gelöscht werden' });
      }
      
      res.json({
        success: true,
        message: 'Tenant erfolgreich gelöscht',
      });
    } catch (error: any) {
      console.error('Delete tenant error:', error);
      res.status(500).json({ error: error.message || 'Fehler beim Löschen des Tenants' });
    }
  });

  app.patch('/api/admin/tenants/:id', requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, settings } = req.body;
      
      const tenant = await supabaseStorage.updateTenant(id, { name, settings });
      
      if (!tenant) {
        return res.status(404).json({ error: 'Tenant nicht gefunden' });
      }

      const stats = await supabaseStorage.getTenantStats(tenant.id);
      
      res.json({
        success: true,
        tenant: {
          ...tenant,
          ...stats,
        },
      });
    } catch (error: any) {
      console.error('Update tenant error:', error);
      res.status(500).json({ error: error.message || 'Fehler beim Aktualisieren des Tenants' });
    }
  });

  // Admin KPIs Dashboard Endpoint
  app.get('/api/admin/kpis', requireSuperAdmin, async (req, res, next) => {
    try {
      const { AdminService } = await import('./services/admin-service');
      const adminService = new AdminService();
      const tenantId = req.query.tenantId as string | undefined;
      
      const kpis = await adminService.getKPIs(tenantId);
      
      res.json({
        success: true,
        kpis,
      });
    } catch (error) {
      next(error);
    }
  });

  // Initialize services
  const projectService = new ProjectService();
  const productService = new ProductService();
  const supplierService = new SupplierService();

  app.get('/api/projects', requireAuth, async (req: any, res, next) => {
    try {
      const cacheKey = cacheService.key('projects', req.user.id, req.user.tenantId);
      const projects = await cacheService.get(
        cacheKey,
        () => projectService.getProjects(req.user),
        300 // 5 Minuten
      );
      res.json({ success: true, projects });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/projects', requireAuth, validate({ body: createProjectSchema }), async (req: any, res, next) => {
    try {
      logger.info('[POST /api/projects] Creating project', { userId: req.user.id });
      const project = await projectService.createProject(req.body, req.user);
      // Invalidate cache
      cacheService.delete(cacheService.key('projects', req.user.id, req.user.tenantId));
      res.json(project);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/projects/:id', requireAuth, async (req: any, res, next) => {
    try {
      const cacheKey = cacheService.key('project', req.params.id, req.user.tenantId);
      const project = await cacheService.get(
        cacheKey,
        () => projectService.getProjectById(req.params.id, req.user),
        300
      );
      res.json(project);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/projects/:id', requireAuth, async (req: any, res, next) => {
    try {
      await projectService.deleteProject(req.params.id, req.user);
      // Invalidate cache
      cacheService.delete(cacheService.key('projects', req.user.id, req.user.tenantId));
      cacheService.delete(cacheService.key('project', req.params.id, req.user.tenantId));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/projects/:projectId/products', requireAuth, async (req: any, res, next) => {
    try {
      const cacheKey = cacheService.key('products', req.params.projectId, req.user.tenantId);
      const products = await cacheService.get(
        cacheKey,
        () => productService.getProductsByProject(req.params.projectId, req.user),
        300
      );
      logger.info(`[GET /products] Project ${req.params.projectId}: Found ${products.length} products`);
      res.json({ success: true, products });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/projects/:projectId/products', requireAuth, checkApiLimit, validate({ body: createProductInProjectSchema }), async (req: any, res, next) => {
    try {
      logger.info('[POST /products] Creating product', { projectId: req.params.projectId, userId: req.user.id });
      const data = { ...req.body, projectId: req.params.projectId };
      const product = await productService.createProduct(data, req.user);
      await trackApiUsage(req, res, () => {});
      // Invalidate cache
      cacheService.delete(cacheService.key('products', req.params.projectId, req.user.tenantId));
      res.json(product);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/products/:id', requireAuth, async (req: any, res, next) => {
    try {
      await productService.deleteProduct(req.params.id, req.user);
      // Invalidate cache (we don't know projectId, so clear all product caches for this tenant)
      // In production, you might want to track product->projectId mapping
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/bulk-save-to-project', requireAuth, requireFeature('csvBulkImport'), checkApiLimit, async (req: any, res) => {
    try {
      const { projectName, products } = req.body;

      if (!projectName || !Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ error: 'Projektname und Produkte sind erforderlich' });
      }

      console.log(`[BULK-SAVE] Saving ${products.length} products to project "${projectName}"`);

      const project = await supabaseStorage.createProject(req.user.id, { name: projectName });

      const savedProducts = [];
      for (const product of products) {
        // Use extractedData from request if provided, otherwise build from individual fields
        const extractedData = product.extractedData && Array.isArray(product.extractedData) 
          ? product.extractedData 
          : [
              product.ean ? { key: 'ean', value: product.ean, type: 'text' } : null,
              product.hersteller ? { key: 'hersteller', value: product.hersteller, type: 'text' } : null,
              product.preis ? { key: 'preis', value: product.preis, type: 'text' } : null,
              product.gewicht ? { key: 'gewicht', value: product.gewicht, type: 'text' } : null,
              product.laenge ? { key: 'laenge', value: product.laenge, type: 'text' } : null,
              product.breite ? { key: 'breite', value: product.breite, type: 'text' } : null,
              product.hoehe ? { key: 'hoehe', value: product.hoehe, type: 'text' } : null,
              product.nominalkapazitaet ? { key: 'nominalkapazitaet', value: product.nominalkapazitaet, type: 'text' } : null,
              product.kategorie ? { key: 'kategorie', value: product.kategorie, type: 'text' } : null,
              product.source_url ? { key: 'source_url', value: product.source_url, type: 'text' } : null,
            ].filter((item): item is { key: string; value: string; type: string } => item !== null);

        const productData = {
          projectId: project.id,
          name: product.produktname || 'Unbekanntes Produkt',
          articleNumber: product.artikelnummer || '',
          htmlCode: product.produktbeschreibung || '',
          previewText: product.seo_beschreibung || product.kurzbeschreibung || '',
          exactProductName: product.mediamarktname_v1 || product.mediamarktname_v2 || product.produktname || '',
          extractedData: extractedData,
          customAttributes: [
            { key: 'mediamarktname_v1', value: product.mediamarktname_v1 || '', type: 'text' },
            { key: 'mediamarktname_v2', value: product.mediamarktname_v2 || '', type: 'text' },
            { key: 'seo_titel', value: product.seo_titel || '', type: 'text' },
            { key: 'seo_beschreibung', value: product.seo_beschreibung || '', type: 'text' },
            { key: 'kurzbeschreibung', value: product.kurzbeschreibung || '', type: 'text' },
          ].filter(attr => attr.value),
        };

        const savedProduct = await supabaseStorage.createProduct(project.id, productData, req.user.id);
        savedProducts.push(savedProduct);
      }

      await trackApiUsage(req, res, () => {});

      console.log(`[BULK-SAVE] Successfully saved ${savedProducts.length} products`);
      
      res.json({ 
        success: true, 
        project,
        productCount: savedProducts.length 
      });
    } catch (error: any) {
      console.error('[BULK-SAVE] Error:', error);
      res.status(500).json({ 
        error: error.message || 'Fehler beim Speichern der Produkte' 
      });
    }
  });

  app.get('/api/suppliers', requireAuth, async (req: any, res, next) => {
    try {
      logger.info('[API /api/suppliers GET] Loading suppliers', { userId: req.user.id, isAdmin: req.user.isAdmin });
      const cacheKey = cacheService.key('suppliers', req.user.id, req.user.tenantId);
      const suppliers = await cacheService.get(
        cacheKey,
        () => supplierService.getSuppliers(req.user),
        300
      );
      logger.info('[API /api/suppliers GET] Returning suppliers', { count: suppliers.length });
      res.json({ success: true, suppliers });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/suppliers/:id', requireAuth, async (req: any, res, next) => {
    try {
      const cacheKey = cacheService.key('supplier', req.params.id, req.user.tenantId);
      const supplier = await cacheService.get(
        cacheKey,
        () => supplierService.getSupplierById(req.params.id, req.user),
        300
      );
      res.json({ success: true, supplier });
    } catch (error) {
      next(error);
    }
  });

  // Get Brickfox-optimized selector template
  app.get('/api/selectors/brickfox', requireAuth, (req: any, res) => {
    res.json({ success: true, selectors: brickfoxSelectors });
  });

  app.post('/api/suppliers', requireAuth, validate({ body: createSupplierSchema }), async (req: any, res, next) => {
    try {
      logger.info('[API /api/suppliers POST] Creating supplier', { userId: req.user.id });
      const supplier = await supplierService.createSupplier(req.body, req.user);
      // Invalidate cache
      cacheService.delete(cacheService.key('suppliers', req.user.id, req.user.tenantId));
      logger.info('[API /api/suppliers POST] Supplier created successfully', { supplierId: supplier.id });
      res.json({ success: true, supplier });
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/suppliers/:id', requireAuth, async (req: any, res, next) => {
    try {
      logger.info('[API /api/suppliers PUT] Updating supplier', { supplierId: req.params.id });
      const supplier = await supplierService.updateSupplier(req.params.id, req.body, req.user);
      // Invalidate cache
      cacheService.delete(cacheService.key('suppliers', req.user.id, req.user.tenantId));
      cacheService.delete(cacheService.key('supplier', req.params.id, req.user.tenantId));
      logger.info('[API /api/suppliers PUT] Supplier updated successfully', { supplierId: supplier.id });
      res.json({ success: true, supplier });
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/suppliers/:id', requireAuth, async (req: any, res, next) => {
    try {
      await supplierService.deleteSupplier(req.params.id, req.user);
      // Invalidate cache
      cacheService.delete(cacheService.key('suppliers', req.user.id, req.user.tenantId));
      cacheService.delete(cacheService.key('supplier', req.params.id, req.user.tenantId));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/scrape', requireAuth, requireFeature('urlScraper'), checkApiLimit, upload.none(), async (req, res) => {
    try {
      const { url, selectors } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: 'URL ist erforderlich' });
      }

      const parsedSelectors: ScraperSelectors = selectors ? JSON.parse(selectors) : defaultSelectors.generic;
      const result = await scrapeProduct({ url, selectors: parsedSelectors });
      
      // AI-Farbanalyse: Wenn Bilder vorhanden sind, analysiere das erste Bild
      if (result.images && result.images.length > 0) {
        const firstImageUrl = result.images[0];
        console.log('[Scraper] Starte AI-Farbanalyse für Produktbild...');
        
        try {
          const { analyzeProductImageColor } = await import('./ai-service');
          const aiDetectedColor = await analyzeProductImageColor(firstImageUrl);
          
          if (aiDetectedColor) {
            console.log(`[Scraper] AI erkannte Farbe: ${aiDetectedColor} (Original: ${(result as any).farbe || 'keine'})`);
            (result as any).farbe = aiDetectedColor;
            (result as any).colorDetectedByAI = true; // Flag für Frontend-Anzeige
          }
        } catch (error) {
          console.error('[Scraper] Fehler bei AI-Farbanalyse:', error);
          // Continue ohne Farbanalyse bei Fehler
        }
      }
      
      await trackApiUsage(req, res, () => {});
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Single product scraping is also FREE
  // TEMPORARY: requireFeature removed for debugging - will add back once auth works
  app.post('/api/scrape-product', requireAuth, async (req, res) => {
    const startTime = Date.now();
    const { url, selectors, userAgent, cookies, supplierId } = req.body;
    
    try {
      console.log(`[SCRAPE START] ${url} | supplierId: ${supplierId || 'none'} | selectors: ${selectors ? Object.keys(selectors).length : 'default'}`);
      
      if (!url) {
        console.error("[SCRAPE FAIL]", url || "NO_URL", 400, "URL ist erforderlich");
        return res.status(400).json({ error: 'URL ist erforderlich' });
      }

      // Get cookies from login if supplier has credentials configured
      const effectiveCookies = await getScrapingCookies(supplierId, cookies);
      if (effectiveCookies) {
        console.log(`[SCRAPE] Using cookies for supplier: ${supplierId}`);
      }

      // Load supplier selectors from database if supplierId is provided and no selectors are passed
      let effectiveSelectors = selectors;
      if (supplierId && !selectors) {
        const supplier = await supabaseStorage.getSupplier(supplierId);
        if (supplier && supplier.selectors) {
          effectiveSelectors = supplier.selectors as ScraperSelectors;
          console.log(`[SCRAPE] Loaded ${Object.keys(effectiveSelectors).length} selectors from supplier: ${supplier.name}`);
        }
      }

      const product = await scrapeProduct({ 
        url, 
        selectors: effectiveSelectors || defaultSelectors.generic,
        userAgent,
        cookies: effectiveCookies,
        supplierId: supplierId, // Pass supplierId for PHP scraper auto-detection
        usePhpScraper: true // Enable PHP scraper if available for this supplier
      });
      
      // AI-Farbanalyse: Wenn Bilder vorhanden sind, analysiere das erste Bild
      if (product.images && product.images.length > 0) {
        const firstImageUrl = product.images[0];
        console.log('[Scraper] Starte AI-Farbanalyse für Produktbild...');
        
        try {
          const { analyzeProductImageColor } = await import('./ai-service');
          const aiDetectedColor = await analyzeProductImageColor(firstImageUrl);
          
          if (aiDetectedColor) {
            console.log(`[Scraper] AI erkannte Farbe: ${aiDetectedColor} (Original: ${(product as any).farbe || 'keine'})`);
            (product as any).farbe = aiDetectedColor;
            (product as any).colorDetectedByAI = true; // Flag für Frontend-Anzeige
          }
        } catch (error) {
          console.error('[Scraper] Fehler bei AI-Farbanalyse:', error);
          // Continue ohne Farbanalyse bei Fehler
        }
      }
      
      // Bilder herunterladen: Alle Produktbilder lokal speichern
      if (product.images && product.images.length > 0 && product.articleNumber) {
        console.log(`[Image Download] Starte Download von ${product.images.length} Bildern für ${product.articleNumber}...`);
        
        try {
          const { downloadProductImages } = await import('./image-download-service');
          const downloadedImages = await downloadProductImages(product.images, product.articleNumber);
          
          // Add local image paths as URLs to product data
          (product as any).localImagePaths = downloadedImages.map(img => 
            img.localPath.replace('attached_assets/product_images/', '/product-images/')
          );
          (product as any).downloadedImages = downloadedImages;
          
          console.log(`[Image Download] ✅ ${downloadedImages.length} Bilder erfolgreich heruntergeladen`);
          console.log(`[Image Download] 🔍 downloadedImages Array Length: ${downloadedImages.length}`);
          console.log(`[Image Download] 📂 Lokale Pfade Array Length: ${(product as any).localImagePaths.length}`);
          console.log(`[Image Download] 📂 Lokale Pfade:`, (product as any).localImagePaths);
        } catch (error) {
          console.error('[Image Download] ❌ Fehler beim Herunterladen der Bilder:', error);
          // Continue ohne lokale Bilder bei Fehler
          (product as any).localImagePaths = [];
        }
      } else {
        (product as any).localImagePaths = [];
      }
      
      // DEBUG: Log all product fields to see what's being returned
      const duration = Date.now() - startTime;
      console.log("[SCRAPE OK]", url, product?.productName || product?.articleNumber || 'Unknown', `(${duration}ms)`);
      console.log('📦 [BACKEND] Product fields being returned:', Object.keys(product));
      console.log('📦 [BACKEND] Technical data fields:', {
        nominalspannung: (product as any).nominalspannung || 'EMPTY',
        nominalkapazitaet: (product as any).nominalkapazitaet || 'EMPTY',
        zellenchemie: (product as any).zellenchemie || 'EMPTY',
        zellengroesse: (product as any).zellengroesse || 'EMPTY',
        laenge: (product as any).laenge || 'EMPTY',
        breite: (product as any).breite || 'EMPTY',
        hoehe: (product as any).hoehe || 'EMPTY',
        gewicht: (product as any).gewicht || 'EMPTY',
        energie: (product as any).energie || 'EMPTY',
      });
      console.log('📦 [BACKEND] Nitecore fields:', {
        length: product.length,
        bodyDiameter: product.bodyDiameter,
        led1: product.led1,
        led2: product.led2,
        maxLuminosity: product.maxLuminosity,
        spotIntensity: product.spotIntensity
      });
      
      await trackApiUsage(req, res, () => {});
      res.json({ product });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const statusCode = error.status || error.statusCode || 500;
      const errorMessage = error.message || "Unknown error";
      console.error("[SCRAPE FAIL]", url, statusCode, errorMessage, `(${duration}ms)`);
      console.error("[SCRAPE FAIL] Stack:", error.stack);
      res.status(statusCode).json({ error: errorMessage });
    }
  });

  // API-Endpoint für automatische Selektor-Erkennung
  app.post('/api/auto-detect-selectors', requireAuth, async (req, res) => {
    try {
      const { url, userAgent, cookies } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: 'URL ist erforderlich' });
      }
      
      const { autoDetectSelectors } = await import('./services/auto-detect-selectors');
      const detectedSelectors = await autoDetectSelectors(url, userAgent, cookies);
      
      res.json({ selectors: detectedSelectors });
    } catch (error: any) {
      console.error('[API] Fehler bei automatischer Selektor-Erkennung:', error);
      res.status(500).json({ error: error.message || 'Fehler bei Selektor-Erkennung' });
    }
  });

  // API-Endpoint für strukturierten Produktdaten-Parser
  app.post('/api/parse-technical-data', requireAuth, async (req, res) => {
    try {
      const { scrapedData } = req.body;
      
      if (!scrapedData) {
        return res.status(400).json({ error: 'scrapedData ist erforderlich' });
      }

      // Debug: Zeige rawHtml preview
      if (scrapedData.rawHtml) {
        console.log('[API] rawHtml preview:', scrapedData.rawHtml.slice(0, 500));
      }

      const structuredData = await parseTechnicalData(scrapedData);
      
      res.json({ structuredData });
    } catch (error: any) {
      console.error('[API] Fehler beim Parsen technischer Daten:', error);
      res.status(500).json({ error: error.message || 'Fehler beim Parsen' });
    }
  });

  app.post('/api/test-scrape-product', requireAuth, async (req, res) => {
    try {
      const { url, selectors, userAgent, cookies, supplierId } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: 'URL ist erforderlich' });
      }

      // Get cookies from login if supplier has credentials configured
      const effectiveCookies = await getScrapingCookies(supplierId, cookies);

      const product = await scrapeProduct({ 
        url, 
        selectors: selectors || defaultSelectors.generic,
        userAgent,
        cookies: effectiveCookies
      });
      
      res.json({ product });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Test a single CSS selector (for supplier configuration verification)
  app.post('/api/scraper/test-selector', requireAuth, requireFeature('urlScraper'), async (req, res) => {
    try {
      const { url, selector, userAgent, cookies, supplierId } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: 'URL ist erforderlich' });
      }

      if (!selector) {
        return res.status(400).json({ error: 'CSS-Selektor ist erforderlich' });
      }

      // Get cookies from login if supplier has credentials configured
      const effectiveCookies = await getScrapingCookies(supplierId, cookies);

      const result = await testSelector({ 
        url, 
        selector,
        userAgent,
        cookies: effectiveCookies
      });
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Scraping is FREE - no API limit check
  app.post('/api/scrape-product-list', requireAuth, requireFeature('urlScraper'), async (req, res) => {
    try {
      const { listUrl, productLinkSelector, maxProducts, selectors, userAgent, cookies, supplierId } = req.body;
      
      if (!listUrl) {
        return res.status(400).json({ error: 'Listen-URL ist erforderlich' });
      }

      // Get cookies from login if supplier has credentials configured
      const effectiveCookies = await getScrapingCookies(supplierId, cookies);

      const result = await scrapeProductList(
        listUrl,
        productLinkSelector || 'a.product-link',
        maxProducts || 50,
        { 
          selectors: selectors || defaultSelectors.generic, 
          userAgent, 
          cookies: effectiveCookies,
          supplierId: supplierId, // Pass supplierId for PHP category scraper
          usePhpScraper: true // Enable PHP scraper if available
        }
      );
      
      // No usage tracking for scraping (it's free)
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Scraping is FREE - no API limit check (only AI generation costs credits)
  app.post('/api/scrape-all-pages', requireAuth, requireFeature('urlScraper'), async (req, res) => {
    try {
      const { url, listUrl, productLinkSelector, paginationSelector, maxPages, maxProducts, selectors, userAgent, cookies, supplierId } = req.body;
      
      // Support both 'url' and 'listUrl' for backwards compatibility
      const targetUrl = url || listUrl;
      
      if (!targetUrl) {
        return res.status(400).json({ error: 'URL ist erforderlich' });
      }

      // Set headers for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      console.log(`[SCRAPE-ALL-PAGES] Starting multi-page scraping from: ${targetUrl}`);
      console.log(`[SCRAPE-ALL-PAGES] Max pages: ${maxPages || 10}, Max products: ${maxProducts || 500}`);
      if (supplierId) {
        console.log(`[SCRAPE-ALL-PAGES] Supplier ID: ${supplierId} - will use PHP category scraper if available`);
      }

      // Get cookies from login if supplier has credentials configured
      const effectiveCookies = await getScrapingCookies(supplierId, cookies);

      // Import scrapeAllPages function
      const { scrapeAllPages } = await import('./scraper-service.js');

      // Progress callback to send updates
      const progressCallback = (currentPage: number, totalProducts: number) => {
        res.write(`data: ${JSON.stringify({ 
          type: 'progress',
          currentPage, 
          totalProducts,
          message: `📄 Seite ${currentPage} gescraped - ${totalProducts} Produkte gefunden`
        })}\n\n`);
      };

      const productUrls = await scrapeAllPages(
        targetUrl,
        productLinkSelector || null,
        paginationSelector || null,
        maxPages || 10,
        maxProducts || 500,
        {
          userAgent,
          cookies: effectiveCookies,
          timeout: 15000,
          supplierId: supplierId, // Pass supplierId for PHP category scraper
          usePhpScraper: true // Enable PHP scraper if available
        },
        progressCallback
      );
      
      // No usage tracking for scraping (it's free)
      
      // Send final result
      res.write(`data: ${JSON.stringify({ 
        type: 'complete',
        success: true,
        productUrls,
        count: productUrls.length,
        message: `✓ Fertig! ${productUrls.length} Produkte von mehreren Seiten gescraped`
      })}\n\n`);
      res.end();
    } catch (error: any) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  });

  app.post('/api/generate', requireAuth, requireFeature('aiDescriptions'), checkApiLimit, async (req, res) => {
    try {
      const { productData, template } = req.body;
      
      if (!productData) {
        return res.status(400).json({ error: 'Produktdaten fehlen' });
      }

      const { html: description } = await generateProductDescription(productData);
      const htmlCode = convertTextToHTML(description);
      
      await trackApiUsage(req, res, () => {});
      res.json({ description, htmlCode });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/generate-description', requireAuth, requireFeature('aiDescriptions'), checkApiLimit, async (req, res) => {
    try {
      const { extractedData, structuredData, customAttributes, autoExtractedDescription, technicalDataTable, safetyWarnings, pdfManualUrl, model } = req.body;

      if (!extractedData || !Array.isArray(extractedData)) {
        return res.status(400).json({ error: 'Invalid extracted data' });
      }

      // SMART AUTO-EXTRACTION: Combine manual extracted data with auto-extracted data
      const enhancedData = [...extractedData];
      
      if (autoExtractedDescription) {
        enhancedData.push(`Produktbeschreibung:\n${autoExtractedDescription}`);
      }
      
      if (technicalDataTable) {
        enhancedData.push(`Technische Daten (HTML-Tabelle):\n${technicalDataTable}`);
      }

      if (safetyWarnings) {
        enhancedData.push(`Sicherheitshinweise:\n${safetyWarnings}`);
      }

      if (pdfManualUrl) {
        enhancedData.push(`Bedienungsanleitung verfügbar: ${pdfManualUrl}`);
      }

      // COST OPTIMIZATION: Use GPT-4o-mini (30× cheaper) by default
      const aiModel = model || 'gpt-4o-mini';
      const { html: description, categoryId: detectedCategory, enrichedProductData } = await generateProductDescription(
        enhancedData, 
        undefined, 
        {
          ...customAttributes,
          structuredData, // WICHTIG: Strukturierte Daten übertragen (length, bodyDiameter, led1, etc.)
          technicalDataTable, // Pass the original HTML table
          safetyWarnings, // Pass safety warnings for 1:1 rendering
          pdfManualUrl // Pass PDF URL for reference
        }, 
        aiModel
      );

      // Extract SEO fields from product data
      const firstData = extractedData[0] || {};
      const productName = customAttributes?.exactProductName || firstData.productName || firstData.product_name || '';
      const manufacturer = firstData.manufacturer || firstData.Hersteller || '';
      const category = detectedCategory; // Use AI-detected category instead of scraped category
      const articleNumber = firstData.articleNumber || firstData.artikel_nr || '';
      
      console.log(`[SEO] Using detected category "${detectedCategory}" for SEO generation`);
      
      // Collect technical specs for SEO context
      const technicalSpecs: string[] = [];
      if (firstData.nominalspannung) technicalSpecs.push(`${firstData.nominalspannung}V`);
      if (firstData.nominalkapazitaet) technicalSpecs.push(`${firstData.nominalkapazitaet}mAh`);
      if (firstData.gewicht) technicalSpecs.push(firstData.gewicht);
      
      // Generate AI-powered SEO metadata
      const { generateSEOMetadata, generateSEOKeywords } = await import('./ai-service.js');
      const seoMetadata = await generateSEOMetadata({
        productName,
        manufacturer,
        category,
        articleNumber,
        description: autoExtractedDescription || description.replace(/<[^>]*>/g, '').substring(0, 300),
        technicalSpecs,
        nominalkapazitaet: enrichedProductData.nominalkapazitaet || firstData.nominalkapazitaet || structuredData?.nominalkapazitaet,
        zellenchemie: enrichedProductData.zellenchemie || firstData.zellenchemie || structuredData?.zellenchemie
      }, aiModel);
      
      const { seoTitle, seoDescription } = seoMetadata;
      
      // Generate AI-powered SEO Keywords (structured)
      const descriptionText = autoExtractedDescription || description.replace(/<[^>]*>/g, '').substring(0, 500);
      const seoKeywordsStructured = await generateSEOKeywords(
        productName,
        descriptionText,
        12, // max 12 keywords per category
        aiModel
      );
      
      // Combine all keywords into a comma-separated string for backward compatibility
      const allKeywords = [
        ...seoKeywordsStructured.hauptkeywords,
        ...seoKeywordsStructured.longtail_keywords,
        ...seoKeywordsStructured.brand_keywords,
        ...seoKeywordsStructured.intent_keywords
      ].slice(0, 20); // Limit to top 20 keywords
      const seoKeywords = allKeywords.join(', ');

      await trackApiUsage(req, res, () => {});
      res.json({ 
        success: true, 
        description,
        seoTitle,
        seoDescription,
        seoKeywords,
        seoKeywordsStructured // Return structured keywords for advanced use
      });
    } catch (error) {
      console.error('Description generation error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Description generation failed' 
      });
    }
  });

  app.post('/api/pixi/compare', requireAuth, requireFeature('pixiIntegration'), upload.single('csvFile'), async (req: any, res) => {
    try {
      const { supplNr } = req.body;
      const file = req.file;

      if (!supplNr) {
        return res.status(400).json({ 
          success: false,
          error: 'Supplier number (supplNr) is required' 
        });
      }

      if (!file) {
        return res.status(400).json({ 
          success: false,
          error: 'CSV file is required' 
        });
      }

      console.log(`[Pixi Compare] Processing CSV for supplier ${supplNr}, file size: ${file.size} bytes`);

      // Try to detect encoding - first try UTF-8, then Windows-1252
      let csvContent = file.buffer.toString('utf-8');
      
      // Check if content contains replacement characters (�), indicating wrong encoding
      if (csvContent.includes('�')) {
        console.log('[Pixi Compare] UTF-8 decoding produced replacement characters, trying Windows-1252');
        csvContent = file.buffer.toString('latin1');
      }

      const parseResult = await new Promise<any>((resolve, reject) => {
        Papa.parse(csvContent, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim(), // Remove leading/trailing spaces from headers
          complete: (results) => resolve(results),
          error: (error) => reject(error),
        });
      });

      if (!parseResult.data || parseResult.data.length === 0) {
        return res.status(400).json({ 
          success: false,
          error: 'CSV file is empty or invalid' 
        });
      }

      console.log(`[Pixi Compare] Parsed ${parseResult.data.length} products from CSV`);

      // Fix scientific notation in EAN fields FIRST (e.g., "4,01E+12" -> "4013674012345")
      parseResult.data.forEach((product: any) => {
        // Try to fix EAN field
        ['v_ean', 'ean', 'EAN'].forEach(key => {
          if (product[key]) {
            const eanStr = String(product[key]);
            // Check if it's in scientific notation (e.g., "4,01E+12" or "4.01E+12")
            if (eanStr.match(/[0-9],[0-9]+E\+[0-9]+/i) || eanStr.match(/[0-9]\.[0-9]+E\+[0-9]+/i)) {
              // Parse as number and convert back to string without scientific notation
              const eanNum = parseFloat(eanStr.replace(',', '.'));
              if (!isNaN(eanNum)) {
                product[key] = Math.round(eanNum).toString();
                console.log(`[Pixi Compare] Fixed EAN scientific notation: ${eanStr} -> ${product[key]}`);
              }
            }
          }
        });
      });

      // Filter out empty rows (where important fields are all empty)
      const products = parseResult.data.filter((row: any) => {
        // Check if at least one of the key fields has data
        const keyFields = [
          row.p_item_number, row.v_manufacturers_item_number, 
          row['p_name[de]'], row.v_ean, row.p_brand
        ];
        const hasKeyData = keyFields.some(val => 
          val !== null && val !== undefined && String(val).trim() !== ''
        );
        return hasKeyData;
      });

      console.log(`[Pixi Compare] After filtering: ${products.length} valid products`);

      const comparisonResult = await pixiService.compareProducts(products, supplNr);

      console.log(
        `[Pixi Compare] Comparison complete: ${comparisonResult.summary.total} total, ` +
        `${comparisonResult.summary.neu} new, ${comparisonResult.summary.vorhanden} existing`
      );

      res.json(comparisonResult);
    } catch (error: any) {
      console.error('[Pixi Compare] Error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message || 'Failed to compare products with Pixi API' 
      });
    }
  });

  app.post('/api/pixi/compare-json', requireAuth, requireFeature('pixiIntegration'), async (req: any, res) => {
    try {
      const { products, supplNr } = req.body;

      if (!supplNr) {
        return res.status(400).json({ 
          success: false,
          error: 'Supplier number (supplNr) is required' 
        });
      }

      if (!products || !Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ 
          success: false,
          error: 'Products array is required and must not be empty' 
        });
      }

      console.log(`[Pixi Compare JSON] Processing ${products.length} products for supplier ${supplNr}`);

      const comparisonResult = await pixiService.compareProducts(products, supplNr);

      console.log(
        `[Pixi Compare JSON] Comparison complete: ${comparisonResult.summary.total} total, ` +
        `${comparisonResult.summary.neu} new, ${comparisonResult.summary.vorhanden} existing`
      );

      res.json(comparisonResult);
    } catch (error: any) {
      console.error('[Pixi Compare JSON] Error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message || 'Failed to compare products with Pixi API' 
      });
    }
  });

  // Direct comparison from PDF-Scraper (alias for compare-json)
  app.post('/api/pixi/compare-direct', requireAuth, requireFeature('pixiIntegration'), async (req: any, res) => {
    try {
      const { products, supplNr } = req.body;

      if (!supplNr) {
        return res.status(400).json({ 
          success: false,
          error: 'Supplier number (supplNr) is required' 
        });
      }

      if (!products || !Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ 
          success: false,
          error: 'Products array is required and must not be empty' 
        });
      }

      console.log(`[Pixi Compare Direct] Processing ${products.length} products from PDF-Scraper for supplier ${supplNr}`);

      const comparisonResult = await pixiService.compareProducts(products, supplNr);

      console.log(
        `[Pixi Compare Direct] Comparison complete: ${comparisonResult.summary.total} total, ` +
        `${comparisonResult.summary.neu} new, ${comparisonResult.summary.vorhanden} existing`
      );

      res.json(comparisonResult);
    } catch (error: any) {
      console.error('[Pixi Compare Direct] Error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message || 'Failed to compare products with Pixi API' 
      });
    }
  });

  app.delete('/api/pixi/cache', requireAuth, async (req: any, res) => {
    try {
      pixiService.clearCache();
      res.json({ success: true, message: 'Pixi cache cleared' });
    } catch (error: any) {
      res.status(500).json({ 
        success: false,
        error: error.message || 'Failed to clear cache' 
      });
    }
  });

  // Brickfox CSV Preview - Preview Brickfox data before export
  app.post('/api/brickfox/preview', requireAuth, async (req: any, res) => {
    try {
      const { projectId, supplierId } = req.body;

      if (!projectId) {
        return res.status(400).json({ 
          success: false,
          error: 'Project ID is required' 
        });
      }

      console.log(`[Brickfox Preview] Generating preview for project ${projectId}`);

      // Get all products in project
      const products = await supabaseStorage.getProducts(projectId, req.user.id);
      
      if (!products || products.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No products found in project'
        });
      }

      // Get supplier name and load custom mappings
      let supplierName = undefined;
      let customMapping = undefined;
      const user = await supabaseStorage.getUserById(req.user.id);
      
      if (supplierId && user?.tenantId) {
        const supplier = await supabaseStorage.getSupplier(supplierId);
        supplierName = supplier?.name;
        
        // Load custom field mappings for this supplier (URL scraper)
        customMapping = await loadMappingsForSupplier(supplierId, user.tenantId, 'url_scraper');
        console.log(`[Brickfox Preview] Loaded custom URL scraper mappings for supplier ${supplierId}`);
      } else if (projectId && user?.tenantId) {
        // Load custom field mappings for this project (CSV)
        customMapping = await loadMappingsForProject(projectId, user.tenantId, 'csv');
        console.log(`[Brickfox Preview] Loaded custom CSV mappings for project ${projectId}`);
      }

      // Load mappingRules.json for fixed values and auto-generate rules
      let fixedValues = undefined;
      let autoGenerateRules = undefined;
      
      try {
        const { loadMappingRules } = await import('./services/mapping-rules-loader');
        const mappingRules = loadMappingRules();
        fixedValues = mappingRules.fixedValues;
        autoGenerateRules = mappingRules.autoGenerate;
        console.log(`[Brickfox Preview] Loaded mappingRules.json with ${Object.keys(fixedValues).length} fixed values`);
      } catch (error: any) {
        console.warn(`[Brickfox Preview] Could not load mappingRules.json: ${error.message}`);
      }

      // Transform to Brickfox format (without AI enhancement for faster preview)
      const brickfoxRows = mapProductsToBrickfox(products, {
        supplierName: supplierName || 'Unbekannt',
        customMapping,
        fixedValues,
        autoGenerateRules,
        enableAI: false // Disable AI for preview to speed up
      });

      console.log(`[Brickfox Preview] Generated preview with ${brickfoxRows.length} rows`);
      
      res.json({
        success: true,
        rows: brickfoxRows,
        totalRows: brickfoxRows.length
      });
    } catch (error: any) {
      console.error('[Brickfox Preview] Error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message || 'Failed to generate Brickfox preview' 
      });
    }
  });

  // Brickfox CSV Export - Export project products as Brickfox-formatted CSV
  app.post('/api/brickfox/export', requireAuth, async (req: any, res) => {
    try {
      const { projectId, supplierId } = req.body;

      if (!projectId) {
        return res.status(400).json({ 
          success: false,
          error: 'Project ID is required' 
        });
      }

      console.log(`[Brickfox Export] Exporting project ${projectId}`);

      // Get all products in project
      const products = await supabaseStorage.getProducts(projectId, req.user.id);
      
      if (!products || products.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No products found in project'
        });
      }

      // Get supplier name and load custom mappings
      let supplierName = undefined;
      let customMapping = undefined;
      const user = await supabaseStorage.getUserById(req.user.id);
      
      if (supplierId && user?.tenantId) {
        const supplier = await supabaseStorage.getSupplier(supplierId);
        supplierName = supplier?.name;
        
        // Load custom field mappings for this supplier (URL scraper)
        customMapping = await loadMappingsForSupplier(supplierId, user.tenantId, 'url_scraper');
        console.log(`[Brickfox Export] Loaded custom URL scraper mappings for supplier ${supplierId}`);
      } else if (projectId && user?.tenantId) {
        // Load custom field mappings for this project (CSV)
        customMapping = await loadMappingsForProject(projectId, user.tenantId, 'csv');
        console.log(`[Brickfox Export] Loaded custom CSV mappings for project ${projectId}`);
      }

      // AI Enhancement: Generate missing fields
      console.log(`[Brickfox Export] Running AI enhancement for ${products.length} products...`);
      const aiEnhancements = await enhanceProductsWithAI(products);
      console.log(`[Brickfox Export] AI enhancement complete: ${aiEnhancements.size} products enhanced`);

      // Merge AI enhancements into products
      products.forEach(product => {
        const enhancement = aiEnhancements.get(product.id);
        if (enhancement) {
          // Add AI data to customAttributes
          if (!product.customAttributes) product.customAttributes = [];
          
          if (enhancement.customs_tariff_number) {
            product.customAttributes.push({ 
              key: 'ai_customs_tariff_number', 
              value: enhancement.customs_tariff_number,
              type: 'string'
            });
          }
          if (enhancement.customs_tariff_text) {
            product.customAttributes.push({ 
              key: 'ai_customs_tariff_text', 
              value: enhancement.customs_tariff_text,
              type: 'string'
            });
          }
          if (enhancement.optimized_description) {
            product.customAttributes.push({ 
              key: 'ai_description', 
              value: enhancement.optimized_description,
              type: 'string'
            });
          }
        }
      });

      // Load mappingRules.json for fixed values and auto-generate rules
      let fixedValues = undefined;
      let autoGenerateRules = undefined;
      
      try {
        const { loadMappingRules } = await import('./services/mapping-rules-loader');
        const mappingRules = loadMappingRules();
        fixedValues = mappingRules.fixedValues;
        autoGenerateRules = mappingRules.autoGenerate;
        console.log(`[Brickfox Export] Loaded mappingRules.json with ${Object.keys(fixedValues).length} fixed values`);
      } catch (error: any) {
        console.warn(`[Brickfox Export] Could not load mappingRules.json: ${error.message}`);
      }

      // Transform to Brickfox format
      const brickfoxRows = mapProductsToBrickfox(products, {
        supplierName: supplierName || 'Unbekannt',
        customMapping,
        fixedValues,
        autoGenerateRules,
        enableAI: true
      });

      // Convert to CSV
      const csv = brickfoxRowsToCSV(brickfoxRows);

      // Set headers for file download
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="brickfox-export-${projectId}.csv"`);
      
      console.log(`[Brickfox Export] Generated CSV with ${brickfoxRows.length} rows`);
      
      res.send(csv);
    } catch (error: any) {
      console.error('[Brickfox Export] Error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message || 'Failed to export Brickfox CSV' 
      });
    }
  });

  // Pixi Supabase Integration - Compare project products with Pixi ERP
  app.post('/api/pixi/compare-project', requireAuth, requireFeature('pixiIntegration'), async (req: any, res) => {
    try {
      const { projectId, supplierId, supplNr } = req.body;

      if (!projectId) {
        return res.status(400).json({ 
          success: false,
          error: 'Project ID is required' 
        });
      }

      if (!supplierId && !supplNr) {
        return res.status(400).json({ 
          success: false,
          error: 'Either supplier ID or supplier number (supplNr) is required' 
        });
      }

      console.log(
        `[Pixi Compare Project] Starting comparison for project ${projectId} ` +
        `with ${supplierId ? `supplier ${supplierId}` : `supplNr ${supplNr}`}`
      );

      const supplierIdOrSupplNr = supplierId || supplNr;
      const comparisonResult = await pixiService.compareProductsFromSupabase(
        projectId,
        supabaseStorage,
        supplierIdOrSupplNr
      );

      console.log(
        `[Pixi Compare Project] Comparison complete: ${comparisonResult.summary.total} total, ` +
        `${comparisonResult.summary.neu} new, ${comparisonResult.summary.vorhanden} existing`
      );

      res.json(comparisonResult);
    } catch (error: any) {
      console.error('[Pixi Compare Project] Error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message || 'Failed to compare products with Pixi API' 
      });
    }
  });

  // PDF Preview - Extract URLs without scraping (no automatic scraping)
  app.post('/api/pdf/preview', requireAuth, upload.single('pdf'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          error: 'Keine PDF-Datei hochgeladen' 
        });
      }

      console.log(`[PDF Preview] Processing PDF: ${req.file.originalname}`);

      // Extract products WITH and WITHOUT URLs
      const parseResult = await pdfParserService.extractProductsWithSeparation(req.file.buffer);

      console.log(`[PDF Preview] Found ${parseResult.withURL.length} products WITH URLs`);
      console.log(`[PDF Preview] Found ${parseResult.withoutURL.length} products WITHOUT URLs`);

      res.json({
        success: true,
        totalProducts: parseResult.totalProducts,
        withURL: parseResult.withURL,
        withoutURL: parseResult.withoutURL,
        // Legacy field for backwards compatibility
        products: parseResult.withURL,
      });
    } catch (error: any) {
      console.error('[PDF Preview] Error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Fehler beim Verarbeiten der PDF' 
      });
    }
  });

  // Send Email - Request URLs from supplier for products without URLs
  app.post('/api/email/request-urls', requireAuth, async (req, res) => {
    try {
      const { to, subject, message, eanCodes } = req.body;

      if (!to || !subject || !message || !eanCodes || !Array.isArray(eanCodes)) {
        return res.status(400).json({
          success: false,
          error: 'Fehlende Parameter: to, subject, message, eanCodes erforderlich',
        });
      }

      console.log(`[Email Service] Sending URL request to ${to} for ${eanCodes.length} products`);

      const result = await emailService.sendSupplierUrlRequest({
        to,
        subject,
        message,
        eanCodes,
      });

      if (result.success) {
        res.json({
          success: true,
          message: 'E-Mail erfolgreich versendet',
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Fehler beim Senden der E-Mail',
        });
      }
    } catch (error: any) {
      console.error('[Email Service] Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Fehler beim Senden der E-Mail',
      });
    }
  });

  // ===== SCRAPE SESSION MANAGEMENT =====
  // GET current scrape session for user (persists data between page navigation)
  app.get('/api/scrape-session', requireAuth, async (req: any, res, next) => {
    try {
      const session = await scrapeSessionService.getSession(req.user);
      
      if (!session) {
        return res.json({ success: true, session: null });
      }
      
      res.json({
        success: true,
        session: {
          id: session.id,
          scrapedProducts: session.scrapedProducts,
          scrapedProduct: session.scrapedProduct,
          generatedDescription: session.generatedDescription,
          updatedAt: session.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // PUT/UPDATE scrape session (auto-save during scraping)
  app.put('/api/scrape-session', requireAuth, async (req: any, res, next) => {
    try {
      const { urlScraper, pdfScraper, generatedDescription } = req.body;
      
      const session = await scrapeSessionService.createOrUpdateSession({
        urlScraper,
        pdfScraper,
        generatedDescription,
      }, req.user);
      
      logger.info('[Scrape Session] Session saved', { 
        sessionId: session.id, 
        userId: req.user.id,
        hasUrlScraper: !!urlScraper,
        hasPdfScraper: !!pdfScraper,
      });
      
      res.json({ success: true, session });
    } catch (error) {
      next(error);
    }
  });

  // DELETE scrape session (when user saves to project)
  app.delete('/api/scrape-session', requireAuth, async (req: any, res, next) => {
    try {
      await scrapeSessionService.deleteSession(req.user);
      logger.info('[Scrape Session] Session deleted', { userId: req.user.id });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // ===== BACKUP SYSTEM API ENDPOINTS =====
  
  // Create manual backup (supports incremental)
  app.post('/api/backups', requireAuth, async (req: any, res, next) => {
    try {
      const userId = req.userId;
      const tenantId = req.tenantId;
      const { backupType = 'manual', incremental = false, lastBackupId } = req.body;
      
      const { backupService } = await import('./services/backup-service');
      
      const backup = await backupService.createBackup({
        tenantId,
        userId,
        backupType,
        expiresInDays: 30,
        incremental,
        lastBackupId,
      });
      
      logger.info('[Backup API] Backup created', { 
        backupId: (backup as any).id || (backup as any).backupId, 
        incremental,
        tenantId 
      });
      
      res.json({ success: true, backup });
    } catch (error: any) {
      logger.error('[Backup API] Create failed:', error);
      next(error);
    }
  });
  
  // List all backups for tenant
  app.get('/api/backups', requireAuth, async (req, res) => {
    try {
      const tenantId = (req as any).tenantId;
      
      const { backupService } = await import('./services/backup-service');
      const backupsList = await backupService.listBackups(tenantId);
      
      res.json({ success: true, backups: backupsList });
    } catch (error: any) {
      console.error('[Backup API] List failed:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Restore from backup
  app.post('/api/backups/:id/restore', requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const tenantId = (req as any).tenantId;
      const { id } = req.params;
      
      const { backupService } = await import('./services/backup-service');
      const result = await backupService.restoreBackup({
        backupId: id,
        tenantId,
        userId,
      });
      
      res.json({ ...result, success: true });
    } catch (error: any) {
      console.error('[Backup API] Restore failed:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Delete backup
  app.delete('/api/backups/:id', requireAuth, async (req, res) => {
    try {
      const tenantId = (req as any).tenantId;
      const { id } = req.params;
      
      const { backupService } = await import('./services/backup-service');
      await backupService.deleteBackup(id, tenantId);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Backup API] Delete failed:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Get audit logs (Admin only)
  app.get('/api/audit-logs', requireSuperAdmin, async (req, res) => {
    try {
      const { limit = 100, offset = 0, resourceType, userId } = req.query;
      
      // Get audit logs using Supabase API
      if (!supabaseAdmin) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
      }
      
      let query = supabaseAdmin
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(Number(limit))
        .range(Number(offset), Number(offset) + Number(limit) - 1);
      
      if (resourceType) {
        query = query.eq('resource_type', String(resourceType));
      }
      
      if (userId) {
        query = query.eq('user_id', String(userId));
      }
      
      const { data: logs, error: logsError } = await query;
      
      if (logsError) {
        throw new Error(`Failed to get audit logs: ${logsError.message}`);
      }
      
      res.json({ success: true, logs: logs || [] });
    } catch (error: any) {
      console.error('[Audit API] List failed:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ===== PERMISSION SYSTEM API ENDPOINTS =====
  
  // Grant permission to user
  app.post('/api/permissions', requireSuperAdmin, async (req, res) => {
    try {
      const { userId, resource, action, scope, conditions } = req.body;
      const tenantId = (req as any).tenantId;
      
      const { permissionService } = await import('./services/permission-service');
      
      const permission = await permissionService.grantPermission({
        userId,
        tenantId,
        resource,
        action,
        scope,
        conditions,
      });
      
      res.json({ success: true, permission });
    } catch (error: any) {
      console.error('[Permission API] Grant failed:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // List user permissions
  app.get('/api/permissions/:userId', requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      const requestingUserId = (req as any).userId;
      const isAdmin = (req as any).user?.isAdmin;
      
      if (!isAdmin && requestingUserId !== userId) {
        return res.status(403).json({ 
          success: false, 
          error: 'Sie können nur Ihre eigenen Berechtigungen einsehen.' 
        });
      }
      
      const { permissionService } = await import('./services/permission-service');
      const userPermissions = await permissionService.listUserPermissions(userId);
      
      res.json({ success: true, permissions: userPermissions });
    } catch (error: any) {
      console.error('[Permission API] List failed:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Revoke permission
  app.delete('/api/permissions/:id', requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const { permissionService } = await import('./services/permission-service');
      await permissionService.revokePermission(id);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Permission API] Revoke failed:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Update user role
  app.put('/api/users/:userId/role', requireSuperAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      
      const allowedRoles = ['admin', 'editor', 'viewer', 'project_manager', 'member'];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ 
          success: false, 
          error: `Ungültige Rolle. Erlaubt: ${allowedRoles.join(', ')}` 
        });
      }
      
      const { permissionService } = await import('./services/permission-service');
      const user = await permissionService.updateUserRole(userId, role);
      
      res.json({ success: true, user });
    } catch (error: any) {
      console.error('[Permission API] Role update failed:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Mount webhook routes
  app.use('/api/webhooks', webhooksRouter);

  // Mount mapping routes
  app.use('/api', mappingRouter);

  const httpServer = createServer(app);
  return httpServer;
}
