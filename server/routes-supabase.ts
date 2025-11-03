import type { Express } from "express";
import { createServer, type Server } from "http";
import { supabase, supabaseAdmin } from './supabase';
import { supabaseStorage } from './supabase-storage';
import { createAdminUser, getSupabaseUser } from './supabase-auth';
import { registerUserSchema, loginUserSchema } from '@shared/schema';
import { db as heliumDb } from './db';
import { sql, eq, and, isNotNull } from 'drizzle-orm';
import { 
  productsInProjects as productsInProjectsTable, 
  suppliers as suppliersTable,
  scrapeSession as scrapeSessionTable,
  users as usersTable
} from '@shared/schema';
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
import { mapProductsToBrickfox, brickfoxRowsToCSV } from "./services/brickfox-mapper";
import { enhanceProductsWithAI } from "./services/brickfox-ai-enhancer";
import { loadMappingsForSupplier, loadMappingsForProject } from "./services/brickfox-mapping-loader";
import Papa from "papaparse";
import { nanoid } from "nanoid";
import { createProjectSchema, createProductInProjectSchema, updateProductInProjectSchema } from "@shared/schema";

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
    return res.status(401).json({ error: 'Nicht authentifiziert' });
  }

  const token = authHeader.split(' ')[1];
  const user = await getSupabaseUser(token);

  if (!user) {
    return res.status(401).json({ error: 'Ungültiges Token' });
  }

  req.user = user;

  // CRITICAL: Set tenant_id on the ACTUAL Drizzle database connection for RLS
  if (user.tenantId) {
    try {
      const { pool } = await import('./db');
      if (pool) {
        const jwtClaims = JSON.stringify({
          sub: user.id,
          tenant_id: user.tenantId,
          role: user.role || 'member',
          user_role: user.role || 'member'
        });
        
        // Set config on the PostgreSQL connection that Drizzle uses
        await pool.query("SELECT set_config('request.jwt.claims', $1, true)", [jwtClaims]);
        console.log(`[RLS] Set tenant context for user ${user.email}: tenant_id=${user.tenantId}`);
      }
    } catch (error) {
      console.error('[requireAuth] CRITICAL: Failed to set tenant context on DB connection:', error);
      // Don't proceed without RLS context - this would allow cross-tenant access!
      return res.status(500).json({ error: 'Fehler beim Setzen des Tenant-Kontexts' });
    }
  }

  next();
}

async function requireAdmin(req: any, res: any, next: any) {
  await requireAuth(req, res, async () => {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: 'Admin-Zugriff erforderlich' });
    }
    next();
  });
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
      
      // Insert user directly into Helium DB (don't wait for webhook)
      // First user of tenant becomes admin
      await heliumDb.insert(usersTable).values({
        id: data.user.id,
        email: validatedData.email,
        username: validatedData.username || validatedData.email.split('@')[0],
        tenantId: newTenant.id,
        isAdmin: true, // First user is always admin
        role: 'admin',
        subscriptionStatus: 'trial',
        planId: 'trial',
        apiCallsLimit: 3000,
        apiCallsUsed: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      console.log(`✅ [Register] User ${validatedData.email} created in Helium DB (admin role)`);

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
      loginUserSchema.parse(req.body);
      
      let emailToUse = req.body.email;
      
      if (!emailToUse.includes('@')) {
        const userByUsername = await supabaseStorage.getUserByUsername(emailToUse);
        if (userByUsername) {
          emailToUse = userByUsername.email;
        }
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: req.body.password,
      });

      if (error || !data.user) {
        return res.status(401).json({ error: 'Ungültiger Benutzername/E-Mail oder Passwort' });
      }

      let user = await supabaseStorage.getUserById(data.user.id);

      // AUTO-FIX: Update old 100 limit to new 3000 (GPT-4o-mini adjustment)
      if (user && user.apiCallsLimit === 100) {
        console.log(`🔄 Auto-updating ${user.email} from 100 to 3000 credits (GPT-4o-mini)`);
        await supabaseAdmin!
          .from('users')
          .update({ api_calls_limit: 3000 })
          .eq('id', user.id);
        
        // Refresh user data
        user = await supabaseStorage.getUserById(data.user.id);
      }

      res.json({ 
        user,
        session: data.session,
        access_token: data.session?.access_token
      });
    } catch (error) {
      res.status(400).json({ error: 'Ungültige Login-Daten' });
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
          api_calls_limit: 3000,
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
          apiCallsLimit: freshUser?.apiCallsLimit || 3000, // Updated for GPT-4o-mini
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

  app.get('/api/admin/customers', requireAdmin, async (req, res) => {
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

  app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
      const users = await supabaseStorage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: 'Fehler beim Laden der Benutzer' });
    }
  });

  app.post('/api/admin/create-admin', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
      }

      await createAdminUser(email, password);
      res.json({ success: true, message: 'Admin-Benutzer erstellt' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Tenant Management Endpoints (Admin only)
  app.get('/api/admin/tenants', requireAdmin, async (req, res) => {
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

  app.post('/api/admin/tenants', requireAdmin, async (req, res) => {
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

  app.delete('/api/admin/tenants/:id', requireAdmin, async (req, res) => {
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

  app.patch('/api/admin/tenants/:id', requireAdmin, async (req, res) => {
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

  app.delete('/api/admin/tenants/:id', requireAdmin, async (req, res) => {
    try {
      const { id} = req.params;
      const success = await supabaseStorage.deleteTenant(id);
      
      if (!success) {
        return res.status(404).json({ error: 'Tenant nicht gefunden' });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Delete tenant error:', error);
      res.status(500).json({ error: error.message || 'Fehler beim Löschen des Tenants' });
    }
  });

  // Admin KPIs Dashboard Endpoint
  app.get('/api/admin/kpis', requireAdmin, async (req, res) => {
    try {
      const tenantId = req.query.tenantId as string | undefined;
      
      // Get total products (mandantenübergreifend or filtered)
      const productsQuery = heliumDb
        .select({ count: sql<number>`count(*)::int` })
        .from(productsInProjectsTable);
      
      if (tenantId) {
        productsQuery.where(eq(productsInProjectsTable.tenantId, tenantId));
      }
      
      const [{ count: totalProducts }] = await productsQuery;
      
      // Get data completeness (Produkte mit allen Pflichtfeldern)
      const completeProductsQuery = heliumDb
        .select({ count: sql<number>`count(*)::int` })
        .from(productsInProjectsTable)
        .where(
          and(
            isNotNull(productsInProjectsTable.name),
            isNotNull(productsInProjectsTable.articleNumber),
            isNotNull(productsInProjectsTable.extractedData),
            tenantId ? eq(productsInProjectsTable.tenantId, tenantId) : undefined
          )
        );
      
      const [{ count: completeProducts }] = await completeProductsQuery;
      const completenessPercentage = totalProducts > 0 
        ? Math.round((completeProducts / totalProducts) * 100) 
        : 0;
      
      // Get supplier stats
      const suppliersQuery = heliumDb
        .select({
          id: suppliersTable.id,
          name: suppliersTable.name,
          lastVerifiedAt: suppliersTable.lastVerifiedAt,
        })
        .from(suppliersTable);
      
      if (tenantId) {
        suppliersQuery.where(eq(suppliersTable.tenantId, tenantId));
      }
      
      const suppliers = await suppliersQuery;
      const activeSuppliers = suppliers.length;
      const successfulSuppliers = suppliers.filter((s: any) => s.lastVerifiedAt).length;
      const errorSuppliers = activeSuppliers - successfulSuppliers;
      
      // Get last Pixi sync (mock for now - you can implement real sync tracking later)
      const lastPixiSync = new Date(); // TODO: Implement real Pixi sync tracking
      
      // Get AI texts generated today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const aiTextsQuery = heliumDb
        .select({ count: sql<number>`count(*)::int` })
        .from(scrapeSessionTable)
        .where(
          and(
            isNotNull(scrapeSessionTable.generatedDescription),
            sql`${scrapeSessionTable.createdAt} >= ${today}`,
            tenantId ? eq(scrapeSessionTable.tenantId, tenantId) : undefined
          )
        );
      
      const [{ count: aiTextsToday }] = await aiTextsQuery;
      
      res.json({
        success: true,
        kpis: {
          totalProducts,
          completenessPercentage,
          suppliers: {
            active: activeSuppliers,
            successful: successfulSuppliers,
            error: errorSuppliers,
          },
          lastPixiSync: lastPixiSync.toISOString(),
          aiTextsToday,
        },
      });
    } catch (error: any) {
      console.error('Admin KPIs error:', error);
      res.status(500).json({ error: error.message || 'Fehler beim Laden der KPIs' });
    }
  });

  app.get('/api/projects', requireAuth, async (req: any, res) => {
    try {
      const projects = await supabaseStorage.getProjectsByUserId(req.user.id);
      res.json({ success: true, projects });
    } catch (error) {
      res.status(500).json({ error: 'Fehler beim Laden der Projekte' });
    }
  });

  app.post('/api/projects', requireAuth, async (req: any, res) => {
    try {
      console.log('[POST /api/projects] Request body:', JSON.stringify(req.body, null, 2));
      const data = createProjectSchema.parse(req.body);
      const project = await supabaseStorage.createProject(req.user.id, data);
      res.json(project);
    } catch (error: any) {
      console.error('[POST /api/projects] Error:', error);
      res.status(400).json({ error: 'Ungültige Projektdaten', details: error.message });
    }
  });

  app.get('/api/projects/:id', requireAuth, async (req: any, res) => {
    try {
      const project = await supabaseStorage.getProject(req.params.id, req.user.id);
      if (!project) {
        return res.status(404).json({ error: 'Projekt nicht gefunden' });
      }
      res.json(project);
    } catch (error) {
      res.status(500).json({ error: 'Fehler beim Laden des Projekts' });
    }
  });

  app.delete('/api/projects/:id', requireAuth, async (req: any, res) => {
    try {
      const success = await supabaseStorage.deleteProject(req.params.id, req.user.id);
      if (!success) {
        return res.status(404).json({ error: 'Projekt nicht gefunden' });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Fehler beim Löschen des Projekts' });
    }
  });

  app.get('/api/projects/:projectId/products', requireAuth, async (req: any, res) => {
    try {
      const products = await supabaseStorage.getProducts(req.params.projectId, req.user.id);
      console.log(`[GET /products] Project ${req.params.projectId}: Found ${products.length} products`);
      res.json({ success: true, products });
    } catch (error) {
      res.status(500).json({ error: 'Fehler beim Laden der Produkte' });
    }
  });

  app.post('/api/projects/:projectId/products', requireAuth, checkApiLimit, async (req: any, res) => {
    try {
      console.log('[POST /products] Request body:', JSON.stringify(req.body, null, 2));
      const data = createProductInProjectSchema.parse(req.body);
      const product = await supabaseStorage.createProduct(req.params.projectId, data, req.user.id);
      await trackApiUsage(req, res, () => {});
      res.json(product);
    } catch (error: any) {
      console.error('[POST /products] Validation error:', error);
      res.status(400).json({ error: error.message || 'Ungültige Produktdaten' });
    }
  });

  app.delete('/api/products/:id', requireAuth, async (req: any, res) => {
    try {
      const success = await supabaseStorage.deleteProduct(req.params.id, req.user.id);
      if (!success) {
        return res.status(404).json({ error: 'Produkt nicht gefunden oder keine Berechtigung' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('[DELETE /products] Error:', error);
      res.status(500).json({ error: 'Fehler beim Löschen des Produkts' });
    }
  });

  app.post('/api/bulk-save-to-project', requireAuth, checkApiLimit, async (req: any, res) => {
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

  app.get('/api/suppliers', requireAuth, async (req: any, res) => {
    try {
      const suppliers = await supabaseStorage.getSuppliers(req.user.id);
      res.json({ success: true, suppliers });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Fehler beim Laden der Lieferanten' });
    }
  });

  app.get('/api/suppliers/:id', requireAuth, async (req: any, res) => {
    try {
      const supplier = await supabaseStorage.getSupplier(req.params.id);
      if (!supplier) {
        return res.status(404).json({ success: false, error: 'Lieferant nicht gefunden' });
      }
      res.json({ success: true, supplier });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Fehler beim Laden des Lieferanten' });
    }
  });

  // Get Brickfox-optimized selector template
  app.get('/api/selectors/brickfox', requireAuth, (req: any, res) => {
    res.json({ success: true, selectors: brickfoxSelectors });
  });

  app.post('/api/suppliers', requireAuth, async (req: any, res) => {
    try {
      const supplier = await supabaseStorage.createSupplier(req.user.id, req.body);
      res.json({ success: true, supplier });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Fehler beim Erstellen des Lieferanten' });
    }
  });

  app.put('/api/suppliers/:id', requireAuth, async (req: any, res) => {
    try {
      const supplier = await supabaseStorage.updateSupplier(req.params.id, req.body);
      res.json({ success: true, supplier });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Fehler beim Aktualisieren des Lieferanten' });
    }
  });

  app.delete('/api/suppliers/:id', requireAuth, async (req: any, res) => {
    try {
      await supabaseStorage.deleteSupplier(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Fehler beim Löschen des Lieferanten' });
    }
  });

  app.post('/api/scrape', requireAuth, checkApiLimit, upload.none(), async (req, res) => {
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
  app.post('/api/scrape-product', requireAuth, async (req, res) => {
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
        } catch (error) {
          console.error('[Image Download] ❌ Fehler beim Herunterladen der Bilder:', error);
          // Continue ohne lokale Bilder bei Fehler
          (product as any).localImagePaths = [];
        }
      } else {
        (product as any).localImagePaths = [];
      }
      
      // DEBUG: Log all product fields to see what's being returned
      console.log('📦 [BACKEND] Product fields being returned:', Object.keys(product));
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
      res.status(500).json({ error: error.message });
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
  app.post('/api/scraper/test-selector', requireAuth, async (req, res) => {
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
  app.post('/api/scrape-product-list', requireAuth, async (req, res) => {
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
        { selectors: selectors || defaultSelectors.generic, userAgent, cookies: effectiveCookies }
      );
      
      // No usage tracking for scraping (it's free)
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Scraping is FREE - no API limit check (only AI generation costs credits)
  app.post('/api/scrape-all-pages', requireAuth, async (req, res) => {
    try {
      const { url, listUrl, productLinkSelector, paginationSelector, maxPages, maxProducts, selectors, userAgent, cookies } = req.body;
      
      // Support both 'url' and 'listUrl' for backwards compatibility
      const targetUrl = url || listUrl;
      
      if (!targetUrl) {
        return res.status(400).json({ error: 'URL ist erforderlich' });
      }

      // Set headers for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      console.log(`Starting multi-page scraping from: ${targetUrl}`);
      console.log(`Max pages: ${maxPages || 10}, Max products: ${maxProducts || 500}`);

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
          cookies,
          timeout: 15000
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

  app.post('/api/generate', requireAuth, checkApiLimit, async (req, res) => {
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

  app.post('/api/generate-description', requireAuth, checkApiLimit, async (req, res) => {
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

  app.post('/api/pixi/compare', requireAuth, upload.single('csvFile'), async (req: any, res) => {
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

      const csvContent = file.buffer.toString('utf-8');

      const parseResult = await new Promise<any>((resolve, reject) => {
        Papa.parse(csvContent, {
          header: true,
          skipEmptyLines: true,
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

      const comparisonResult = await pixiService.compareProducts(parseResult.data, supplNr);

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

  app.post('/api/pixi/compare-json', requireAuth, async (req: any, res) => {
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

      // Transform to Brickfox format (without AI enhancement for faster preview)
      const brickfoxRows = mapProductsToBrickfox(products, {
        supplierName: supplierName || 'Unbekannt',
        customMapping,
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

      // Transform to Brickfox format
      const brickfoxRows = mapProductsToBrickfox(products, {
        supplierName: supplierName || 'Unbekannt',
        customMapping,
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
  app.post('/api/pixi/compare-project', requireAuth, async (req: any, res) => {
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

  // Mount webhook routes
  app.use('/api/webhooks', webhooksRouter);

  // Mount mapping routes
  app.use('/api', mappingRouter);

  const httpServer = createServer(app);
  return httpServer;
}
