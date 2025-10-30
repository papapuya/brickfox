import type { Express } from "express";
import { createServer, type Server } from "http";
import { supabase, supabaseAdmin } from './supabase';
import { supabaseStorage } from './supabase-storage';
import { createAdminUser, getSupabaseUser } from './supabase-auth';
import { registerUserSchema, loginUserSchema } from '@shared/schema';
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
import { scrapeProduct, scrapeProductList, defaultSelectors, type ScraperSelectors } from "./scraper-service";
import { pixiService } from "./services/pixi-service";
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

export async function registerRoutes(app: Express): Promise<Server> {
  app.post('/api/auth/register', async (req, res) => {
    try {
      const validatedData = registerUserSchema.parse(req.body);
      
      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Server-Konfigurationsfehler' });
      }

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: validatedData.email,
        password: validatedData.password,
        email_confirm: true,
        user_metadata: {
          username: validatedData.username || validatedData.email.split('@')[0],
        }
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      if (!data.user) {
        return res.status(400).json({ error: 'Registrierung fehlgeschlagen' });
      }

      const { data: akkushopOrg } = await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('slug', 'akkushop')
        .single();

      if (!akkushopOrg) {
        console.error('AkkuShop organization not found - creating it now');
        const { data: newOrg } = await supabaseAdmin
          .from('organizations')
          .insert({
            name: 'AkkuShop',
            slug: 'akkushop',
            settings: {
              default_categories: ['battery', 'charger', 'tool', 'gps', 'drone', 'camera'],
              mediamarkt_title_format: 'Kategorie + Artikelnummer'
            }
          })
          .select()
          .single();
        
        if (!newOrg) {
          return res.status(500).json({ error: 'Organization konnte nicht erstellt werden' });
        }
      }

      const orgId = akkushopOrg?.id || (await supabaseAdmin
        .from('organizations')
        .select('id')
        .eq('slug', 'akkushop')
        .single()).data?.id;

      const { error: insertError } = await supabaseAdmin
        .from('users')
        .upsert({
          id: data.user.id,
          email: validatedData.email,
          username: validatedData.username || validatedData.email.split('@')[0],
          is_admin: false,
          organization_id: orgId,
          role: 'member',
          subscription_status: 'trial',
          plan_id: 'trial',
          api_calls_limit: 3000, // 3000 GPT-4o-mini calls = same cost as 100 GPT-4o calls
          api_calls_used: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id'
        });

      if (insertError) {
        console.error('Failed to create user record:', insertError);
        return res.status(500).json({ error: 'Fehler beim Erstellen des Benutzerprofils' });
      }

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

  // Temporary: Update current user's API limit to 3000
  app.post('/api/auth/update-my-limit', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      
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
      const data = createProjectSchema.parse(req.body);
      const project = await supabaseStorage.createProject(req.user.id, data);
      res.json(project);
    } catch (error) {
      res.status(400).json({ error: 'Ungültige Projektdaten' });
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

  app.get('/api/suppliers', requireAuth, async (req: any, res) => {
    try {
      const suppliers = await supabaseStorage.getSuppliers(req.user.id);
      res.json({ success: true, suppliers });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Fehler beim Laden der Lieferanten' });
    }
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

      const parsedSelectors: ScraperSelectors = selectors ? JSON.parse(selectors) : defaultSelectors;
      const result = await scrapeProduct({ url, selectors: parsedSelectors });
      
      await trackApiUsage(req, res, () => {});
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Single product scraping is also FREE
  app.post('/api/scrape-product', requireAuth, async (req, res) => {
    try {
      const { url, selectors, userAgent, cookies } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: 'URL ist erforderlich' });
      }

      const product = await scrapeProduct({ 
        url, 
        selectors: selectors || defaultSelectors,
        userAgent,
        cookies
      });
      
      await trackApiUsage(req, res, () => {});
      res.json({ product });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/test-scrape-product', requireAuth, async (req, res) => {
    try {
      const { url, selectors, userAgent, cookies } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: 'URL ist erforderlich' });
      }

      const product = await scrapeProduct({ 
        url, 
        selectors: selectors || defaultSelectors,
        userAgent,
        cookies
      });
      
      res.json({ product });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Scraping is FREE - no API limit check
  app.post('/api/scrape-product-list', requireAuth, async (req, res) => {
    try {
      const { listUrl, productLinkSelector, maxProducts, selectors, userAgent, cookies } = req.body;
      
      if (!listUrl) {
        return res.status(400).json({ error: 'Listen-URL ist erforderlich' });
      }

      const result = await scrapeProductList(
        listUrl,
        productLinkSelector || 'a.product-link',
        maxProducts || 50,
        { selectors: selectors || defaultSelectors, userAgent, cookies }
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

      const description = await generateProductDescription(productData);
      const htmlCode = convertTextToHTML(description);
      
      await trackApiUsage(req, res, () => {});
      res.json({ description, htmlCode });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/generate-description', requireAuth, checkApiLimit, async (req, res) => {
    try {
      const { extractedData, customAttributes, autoExtractedDescription, technicalDataTable, safetyWarnings, pdfManualUrl, model } = req.body;

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
      const description = await generateProductDescription(
        enhancedData, 
        undefined, 
        {
          ...customAttributes,
          technicalDataTable, // Pass the original HTML table
          safetyWarnings, // Pass safety warnings for 1:1 rendering
          pdfManualUrl // Pass PDF URL for reference
        }, 
        aiModel
      );

      await trackApiUsage(req, res, () => {});
      res.json({ success: true, description });
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

  const httpServer = createServer(app);
  return httpServer;
}
