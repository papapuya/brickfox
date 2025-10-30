import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from './auth';
import { storage } from "./storage";
import { registerUserSchema, loginUserSchema } from '@shared/schema';
import Stripe from 'stripe';
import { 
  createCheckoutSession, 
  createPortalSession, 
  handleWebhookEvent, 
  getSubscriptionStatus,
  PLANS 
} from './stripe-service';
import { 
  requireAuth, 
  requireSubscription, 
  checkApiLimit, 
  trackApiUsage,
  requireAdmin
} from './middleware/subscription';
import multer from "multer";
import { analyzeCSV, generateProductDescription, convertTextToHTML, refineDescription, generateProductName, processProductWithNewWorkflow } from "./ai-service";
import { scrapeProduct, scrapeProductList, defaultSelectors, type ScraperSelectors } from "./scraper-service";
import { nanoid } from "nanoid";
import { createProjectSchema, createProductInProjectSchema, updateProductInProjectSchema } from "@shared/schema";
import fs from 'fs';
import path from 'path';


const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10, // Max 10 files per request
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication endpoints
  app.post('/api/auth/register', async (req, res) => {
    try {
      const validatedData = registerUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ error: 'E-Mail bereits registriert' });
      }
      
      const user = await storage.createUser(validatedData);
      
      // Set trial subscription for new users (100 free AI generations)
      await storage.updateUserSubscription(user.id, {
        subscriptionStatus: 'trial',
        planId: 'trial',
        apiCallsLimit: 100,
      });
      
      // Auto-login after registration
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ error: 'Fehler beim Login nach Registrierung' });
        }
        res.json({ user: { id: user.id, email: user.email, username: user.username, isAdmin: user.isAdmin || false } });
      });
    } catch (error) {
      res.status(400).json({ error: 'Ungültige Registrierungsdaten' });
    }
  });

  app.post('/api/auth/login', (req, res, next) => {
    try {
      loginUserSchema.parse(req.body);
    } catch (error) {
      return res.status(400).json({ error: 'Ungültige Login-Daten' });
    }

    passport.authenticate('local', (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ error: 'Server-Fehler' });
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || 'Ungültige Anmeldedaten' });
      }
      
      req.login(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ error: 'Fehler beim Login' });
        }
        res.json({ user: { id: user.id, email: user.email, username: user.username, isAdmin: user.isAdmin || false } });
      });
    })(req, res, next);
  });

  app.post('/api/auth/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: 'Fehler beim Logout' });
      }
      res.json({ success: true });
    });
  });

  app.get('/api/auth/user', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Nicht authentifiziert' });
    }
    const user = req.user as any;
    res.json({ 
      user: { 
        id: user.id, 
        email: user.email, 
        username: user.username,
        isAdmin: user.isAdmin || false,
        subscriptionStatus: user.subscriptionStatus,
        planId: user.planId,
        apiCallsUsed: user.apiCallsUsed,
        apiCallsLimit: user.apiCallsLimit
      } 
    });
  });

  // Stripe Subscription Endpoints
  app.get('/api/stripe/plans', (req, res) => {
    res.json({ plans: Object.values(PLANS) });
  });

  app.post('/api/stripe/create-checkout-session', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Nicht authentifiziert' });
      }

      const user = req.user as any;
      const { planId } = req.body;

      if (!planId || !['starter', 'pro', 'enterprise'].includes(planId)) {
        return res.status(400).json({ error: 'Ungültiger Plan' });
      }

      const origin = req.headers.origin || `http://localhost:${process.env.PORT || 5000}`;
      const session = await createCheckoutSession(
        user.id,
        user.email,
        planId,
        `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        `${origin}/pricing`
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error('Checkout session error:', error);
      res.status(500).json({ error: 'Fehler beim Erstellen der Checkout-Session' });
    }
  });

  app.post('/api/stripe/create-portal-session', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Nicht authentifiziert' });
      }

      const user = req.user as any;
      
      if (!user.stripeCustomerId) {
        return res.status(400).json({ error: 'Kein Stripe-Customer gefunden' });
      }

      const origin = req.headers.origin || `http://localhost:${process.env.PORT || 5000}`;
      const session = await createPortalSession(user.stripeCustomerId, `${origin}/account`);

      res.json({ url: session.url });
    } catch (error) {
      console.error('Portal session error:', error);
      res.status(500).json({ error: 'Fehler beim Erstellen der Portal-Session' });
    }
  });

  app.get('/api/subscription/status', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Nicht authentifiziert' });
      }

      const user = req.user as any;
      const status = await getSubscriptionStatus(user.id);

      res.json(status);
    } catch (error) {
      console.error('Subscription status error:', error);
      res.status(500).json({ error: 'Fehler beim Abrufen des Subscription-Status' });
    }
  });

  // Stripe Webhook (MUST be before other body parsers for raw body)
  app.post('/api/stripe/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      return res.status(400).send('Missing Stripe signature');
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).send('Webhook secret not configured');
    }

    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2025-10-29.clover',
      });

      const event = stripe.webhooks.constructEvent(
        req.rawBody as Buffer,
        sig,
        webhookSecret
      );

      await handleWebhookEvent(event);

      res.json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }
  });

  // Dashboard Routes
  
  // User Dashboard - Get personal stats
  app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      
      // Get user's projects
      const projects = await storage.getProjectsByUserId(user.id);
      
      // Count total products across all projects
      let totalProducts = 0;
      for (const project of projects) {
        const products = await storage.getProducts(project.id);
        totalProducts += products.length;
      }
      
      // Get user's current subscription info
      const freshUser = await storage.getUserById(user.id);
      
      res.json({
        success: true,
        stats: {
          projectCount: projects.length,
          productCount: totalProducts,
          apiCallsUsed: freshUser?.apiCallsUsed || 0,
          apiCallsLimit: freshUser?.apiCallsLimit || 500,
          planId: freshUser?.planId || 'trial',
          subscriptionStatus: freshUser?.subscriptionStatus || 'trial',
        },
        recentProjects: projects.slice(0, 5), // Last 5 projects
      });
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({ error: 'Fehler beim Laden der Dashboard-Daten' });
    }
  });
  
  // Admin Dashboard - Get all customers
  app.get('/api/admin/customers', requireAuth, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      
      // Get project count and product count for each user
      const customersWithStats = await Promise.all(
        users.map(async (user) => {
          const projects = await storage.getProjectsByUserId(user.id);
          let totalProducts = 0;
          for (const project of projects) {
            const products = await storage.getProducts(project.id);
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
  
  // API-Schlüssel-Verwaltung
  app.post('/api/encrypt-api-key', async (req, res) => {
    try {
      const { service, apiKey } = req.body;
      
      if (!service || !apiKey) {
        return res.status(400).json({ error: 'Service und API-Schlüssel sind erforderlich' });
      }
      
      apiKeyManager.setApiKey(service, apiKey);
      
      res.json({ 
        success: true, 
        message: `API-Schlüssel für ${service} wurde verschlüsselt gespeichert` 
      });
    } catch (error) {
      res.status(500).json({ 
        error: 'Fehler beim Verschlüsseln des API-Schlüssels',
        details: error instanceof Error ? error.message : 'Unbekannter Fehler'
      });
    }
  });
  
  app.get('/api/api-key-status', async (req, res) => {
    try {
      const openaiKey = apiKeyManager.getApiKey('openai');
      
      res.json({
        openai: openaiKey ? '***' + openaiKey.slice(-4) : null
      });
    } catch (error) {
      res.status(500).json({ 
        error: 'Fehler beim Abrufen des API-Schlüssel-Status',
        details: error instanceof Error ? error.message : 'Unbekannter Fehler'
      });
    }
  });
  
  app.delete('/api/clear-api-keys', async (req, res) => {
    try {
      apiKeyManager.clearAllKeys();
      res.json({ 
        success: true, 
        message: 'Alle API-Schlüssel wurden gelöscht' 
      });
    } catch (error) {
      res.status(500).json({ 
        error: 'Fehler beim Löschen der API-Schlüssel',
        details: error instanceof Error ? error.message : 'Unbekannter Fehler'
      });
    }
  });


  // Product Scraper: Test scrape with field status feedback
  app.post('/api/test-scrape-product', async (req, res) => {
    try {
      const { url, selectors, userAgent, cookies } = req.body;

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
      }

      // Validate URL format
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
      }

      console.log(`Test scraping product from URL: ${url}`);
      
      // Use provided selectors or default generic selectors
      const effectiveSelectors: ScraperSelectors = selectors || defaultSelectors.generic;

      // Scrape product data
      const scrapedProduct = await scrapeProduct({
        url,
        selectors: effectiveSelectors,
        userAgent,
        cookies,
        timeout: 15000
      });

      // Check which fields were found and build results array
      const results = [
        { 
          field: 'articleNumber', 
          selector: effectiveSelectors.articleNumber,
          found: !!scrapedProduct.articleNumber && scrapedProduct.articleNumber.length > 0, 
          value: scrapedProduct.articleNumber 
        },
        { 
          field: 'productName', 
          selector: effectiveSelectors.productName,
          found: !!scrapedProduct.productName && scrapedProduct.productName.length > 0, 
          value: scrapedProduct.productName 
        },
        { 
          field: 'ean', 
          selector: effectiveSelectors.ean,
          found: !!scrapedProduct.ean && scrapedProduct.ean.length > 0, 
          value: scrapedProduct.ean 
        },
        { 
          field: 'manufacturer', 
          selector: effectiveSelectors.manufacturer,
          found: !!scrapedProduct.manufacturer && scrapedProduct.manufacturer.length > 0, 
          value: scrapedProduct.manufacturer 
        },
        { 
          field: 'price', 
          selector: effectiveSelectors.price,
          found: !!scrapedProduct.price && scrapedProduct.price.length > 0, 
          value: scrapedProduct.price 
        },
        { 
          field: 'description', 
          selector: effectiveSelectors.description,
          found: !!scrapedProduct.description && scrapedProduct.description.length > 0, 
          value: scrapedProduct.description 
        },
        { 
          field: 'images', 
          selector: effectiveSelectors.images,
          found: scrapedProduct.images.length > 0, 
          value: scrapedProduct.images 
        },
        { 
          field: 'weight', 
          selector: effectiveSelectors.weight,
          found: !!scrapedProduct.weight && scrapedProduct.weight.length > 0, 
          value: scrapedProduct.weight 
        },
        { 
          field: 'category', 
          selector: effectiveSelectors.category,
          found: !!scrapedProduct.category && scrapedProduct.category.length > 0, 
          value: scrapedProduct.category 
        }
      ];

      // Return scraped data with field status
      res.json({
        success: true,
        product: scrapedProduct,
        results,
        selectorsUsed: effectiveSelectors
      });

    } catch (error) {
      console.error('Test scraping error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Product Scraper: Scrape single product with custom selectors (Cheerio-based)
  app.post('/api/scrape-product', requireAuth, requireSubscription, async (req, res) => {
    try {
      const { url, selectors, userAgent, cookies } = req.body;

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
      }

      // Validate URL format
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
      }

      console.log(`Scraping product from URL: ${url}`);
      
      // Use provided selectors or default generic selectors
      const effectiveSelectors: ScraperSelectors = selectors || defaultSelectors.generic;

      // Scrape product data
      const scrapedProduct = await scrapeProduct({
        url,
        selectors: effectiveSelectors,
        userAgent,
        cookies,
        timeout: 15000
      });

      // Return scraped data
      res.json({
        success: true,
        product: scrapedProduct,
        selectorsUsed: effectiveSelectors
      });

    } catch (error) {
      console.error('Product scraping error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Product Scraper: Get list of product URLs from listing page
  app.post('/api/scrape-product-list', requireAuth, requireSubscription, async (req, res) => {
    try {
      const { url, productLinkSelector, maxProducts, userAgent, cookies } = req.body;

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
      }

      // productLinkSelector is now optional - will use auto-detection if not provided
      console.log(`Scraping product list from: ${url}`);

      const productUrls = await scrapeProductList(
        url, 
        productLinkSelector || null, 
        maxProducts || 50,
        {
          userAgent,
          cookies,
          timeout: 15000
        }
      );

      res.json({
        success: true,
        productUrls,
        count: productUrls.length
      });

    } catch (error) {
      console.error('Product list scraping error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Product Scraper: Multi-page scraping with pagination (SSE for live progress)
  app.post('/api/scrape-all-pages', async (req, res) => {
    try {
      const { 
        url, 
        productLinkSelector, 
        paginationSelector,
        maxPages,
        maxProducts,
        userAgent, 
        cookies 
      } = req.body;

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
      }

      console.log(`Starting multi-page scraping from: ${url}`);
      console.log(`Pagination selector: ${paginationSelector || 'auto-detect'}`);
      console.log(`Max pages: ${maxPages || 10}, Max products: ${maxProducts || 500}`);

      // Set SSE headers for real-time progress
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

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
        url,
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

      // Send final result
      res.write(`data: ${JSON.stringify({ 
        type: 'complete',
        success: true,
        productUrls,
        count: productUrls.length,
        message: `✓ Fertig! ${productUrls.length} Produkte von mehreren Seiten gescraped`
      })}\n\n`);
      
      res.end();

    } catch (error) {
      console.error('Multi-page scraping error:', error);
      res.write(`data: ${JSON.stringify({ 
        type: 'error',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })}\n\n`);
      res.end();
    }
  });

  // Product Creator: Neuer 3-Stufen Workflow mit Fortschritt
  app.post('/api/process-with-new-workflow', requireAuth, requireSubscription, checkApiLimit, trackApiUsage, async (req, res) => {
    try {
      const { htmlOrText } = req.body;

      if (!htmlOrText || typeof htmlOrText !== 'string') {
        return res.status(400).json({ error: 'HTML oder Text ist erforderlich' });
      }

      console.log('=== NEUER WORKFLOW API AUFRUF ===');
      console.log('Input length:', htmlOrText.length);
      console.log('Input preview:', htmlOrText.substring(0, 200) + '...');

      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      const htmlDescription = await processProductWithNewWorkflow(htmlOrText, (step, message) => {
        res.write(`data: ${JSON.stringify({ step, message, progress: step })}\n\n`);
      });

      res.write(`data: ${JSON.stringify({ 
        step: 100, 
        message: 'Fertig!', 
        progress: 100, 
        description: htmlDescription,
        workflow: '3-stufen-workflow'
      })}\n\n`);
      
      res.end();
    } catch (error) {
      console.error('New workflow error:', error);
      res.write(`data: ${JSON.stringify({ 
        step: 0, 
        message: 'Fehler aufgetreten', 
        progress: 0, 
        error: error instanceof Error ? error.message : 'Workflow processing failed'
      })}\n\n`);
      res.end();
    }
  });

  // Product Creator: Generate product description with optional template
  app.post('/api/generate-description', requireAuth, requireSubscription, checkApiLimit, trackApiUsage, async (req, res) => {
    try {
      const { extractedData, customAttributes, autoExtractedDescription, technicalDataTable, model } = req.body;

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

      // COST OPTIMIZATION: Use GPT-4o-mini (30× cheaper) by default
      const aiModel = model || 'gpt-4o-mini';
      const description = await generateProductDescription(enhancedData, undefined, customAttributes, aiModel);

      res.json({ success: true, description });
    } catch (error) {
      console.error('Description generation error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Description generation failed' 
      });
    }
  });

  // Product Creator: Convert plain text to HTML
  app.post('/api/text-to-html', async (req, res) => {
    try {
      const { plainText, extractedData } = req.body;

      if (!plainText || typeof plainText !== 'string') {
        return res.status(400).json({ error: 'Invalid plain text' });
      }

      const html = await convertTextToHTML(plainText, extractedData);

      res.json({ success: true, html });
    } catch (error) {
      console.error('Text to HTML conversion error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Text to HTML conversion failed' 
      });
    }
  });

  // Product Creator: Refine description with custom prompt
  app.post('/api/refine-description', requireAuth, requireSubscription, checkApiLimit, trackApiUsage, async (req, res) => {
    try {
      const { currentDescription, userPrompt, extractedData } = req.body;

      if (!currentDescription || typeof currentDescription !== 'string') {
        return res.status(400).json({ error: 'Invalid current description' });
      }

      if (!userPrompt || typeof userPrompt !== 'string') {
        return res.status(400).json({ error: 'Invalid user prompt' });
      }

      const refinedDescription = await refineDescription(currentDescription, userPrompt, extractedData);

      res.json({ success: true, description: refinedDescription });
    } catch (error) {
      console.error('Description refinement error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Description refinement failed' 
      });
    }
  });

  // Product Creator: Generate product name from extracted data
  app.post('/api/generate-product-name', requireAuth, requireSubscription, checkApiLimit, trackApiUsage, async (req, res) => {
    try {
      const { extractedData } = req.body;

      if (!extractedData || !Array.isArray(extractedData)) {
        return res.status(400).json({ error: 'Invalid extracted data' });
      }

      const productName = await generateProductName(extractedData);

      res.json({ success: true, productName });
    } catch (error) {
      console.error('Product name generation error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Product name generation failed' 
      });
    }
  });

  // Project Management: Get all projects
  app.get('/api/projects', async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json({ success: true, projects });
    } catch (error) {
      console.error('Get projects error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get projects' 
      });
    }
  });

  // Project Management: Create new project
  app.post('/api/projects', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const validation = createProjectSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Invalid project data', details: validation.error });
      }

      const project = await storage.createProject(user.id, validation.data);
      res.json({ success: true, project });
    } catch (error) {
      console.error('Create project error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to create project' 
      });
    }
  });

  // Project Management: Get single project
  app.get('/api/projects/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);
      
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json({ success: true, project });
    } catch (error) {
      console.error('Get project error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get project' 
      });
    }
  });

  // Project Management: Delete project
  app.delete('/api/projects/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteProject(id);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Delete project error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to delete project' 
      });
    }
  });

  // Bulk save CSV products to project
  app.post('/api/bulk-save-to-project', requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const { projectName, products } = req.body;

      if (!projectName || !Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ error: 'Project name and products are required' });
      }

      // Create new project
      const project = await storage.createProject(user.id, { name: projectName });

      // Save all products to the project
      const savedProducts = [];
      for (const product of products) {
        const productData = {
          projectId: project.id,
          name: product.produktname || 'Unbekanntes Produkt',
          articleNumber: product.artikelnummer || '',
          htmlCode: product.produktbeschreibung || '',
          previewText: product.seo_beschreibung || product.kurzbeschreibung || '',
          exactProductName: product.mediamarktname_v1 || product.mediamarktname_v2 || product.produktname || '',
          customAttributes: [
            { key: 'mediamarktname_v1', value: product.mediamarktname_v1 || '', type: 'text' },
            { key: 'mediamarktname_v2', value: product.mediamarktname_v2 || '', type: 'text' },
            { key: 'seo_beschreibung', value: product.seo_beschreibung || '', type: 'text' },
            { key: 'kurzbeschreibung', value: product.kurzbeschreibung || '', type: 'text' },
            { key: 'ean', value: product.ean || '', type: 'text' },
            { key: 'hersteller', value: product.hersteller || '', type: 'text' },
            { key: 'preis', value: product.preis || '', type: 'text' },
            { key: 'gewicht', value: product.gewicht || '', type: 'text' },
            { key: 'kategorie', value: product.kategorie || '', type: 'text' },
            { key: 'source_url', value: product.source_url || '', type: 'text' },
          ].filter(attr => attr.value),
        };

        const savedProduct = await storage.createProduct(project.id, productData);
        savedProducts.push(savedProduct);
      }

      res.json({ 
        success: true, 
        project,
        productCount: savedProducts.length 
      });
    } catch (error) {
      console.error('Bulk save to project error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to save products to project' 
      });
    }
  });

  // Product Management: Get all products in a project
  app.get('/api/projects/:id/products', async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if project exists
      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const products = await storage.getProducts(id);
      res.json({ success: true, products });
    } catch (error) {
      console.error('Get products error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get products' 
      });
    }
  });

  // Product Management: Create new product in project
  app.post('/api/projects/:id/products', async (req, res) => {
    try {
      const { id: projectId } = req.params;
      
      // Check if project exists
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Add projectId to request body for validation
      const productData = { ...req.body, projectId };

      const validation = createProductInProjectSchema.safeParse(productData);
      if (!validation.success) {
        return res.status(400).json({ error: 'Invalid product data', details: validation.error });
      }

      const product = await storage.createProduct(projectId, validation.data);
      res.json({ success: true, product });
    } catch (error) {
      console.error('Create product error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to create product' 
      });
    }
  });

  // Product Management: Get single product
  app.get('/api/products/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const product = await storage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json({ success: true, product });
    } catch (error) {
      console.error('Get product error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get product' 
      });
    }
  });

  // Product Management: Update product
  app.patch('/api/products/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      const validation = updateProductInProjectSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Invalid product data', details: validation.error });
      }

      const product = await storage.updateProduct(id, validation.data);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json({ success: true, product });
    } catch (error) {
      console.error('Update product error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to update product' 
      });
    }
  });

  // Product Management: Delete product
  app.delete('/api/products/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteProduct(id);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Delete product error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to delete product' 
      });
    }
  });

  // Credentials Management: Get saved credentials
  app.get('/api/credentials', (req, res) => {
    try {
      const envPath = path.join(process.cwd(), ".env");
      let openaiKey = '';
      let pixiKey = '';
      let channelEngineKey = '';
      let brickfoxKey = '';
      
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('OPENAI_API_KEY=')) {
            openaiKey = line.split('=')[1] || '';
          } else if (line.startsWith('PIXI_API_KEY=')) {
            pixiKey = line.split('=')[1] || '';
          } else if (line.startsWith('CHANNEL_ENGINE_API_KEY=')) {
            channelEngineKey = line.split('=')[1] || '';
          } else if (line.startsWith('BRICKFOX_API_KEY=')) {
            brickfoxKey = line.split('=')[1] || '';
          }
        }
      }
      
      res.json({
        success: true,
        credentials: {
          openaiApiKey: openaiKey,
          pixiApiKey: pixiKey,
          channelEngineApiKey: channelEngineKey,
          brickfoxApiKey: brickfoxKey,
        }
      });
    } catch (error) {
      console.error('Error loading credentials:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to load credentials' 
      });
    }
  });

  // Credentials Management: Save credentials
  app.post('/api/saveKeys', (req, res) => {
    const { openaiKey, pixiKey, channelEngineKey, brickfoxKey } = req.body;
    
    // Build .env content
    let envContent = '';
    
    if (openaiKey) {
      envContent += `OPENAI_API_KEY=${openaiKey}\n`;
      process.env.OPENAI_API_KEY = openaiKey;
    }
    
    if (pixiKey) {
      envContent += `PIXI_API_KEY=${pixiKey}\n`;
      process.env.PIXI_API_KEY = pixiKey;
    }
    
    if (channelEngineKey) {
      envContent += `CHANNEL_ENGINE_API_KEY=${channelEngineKey}\n`;
      process.env.CHANNEL_ENGINE_API_KEY = channelEngineKey;
    }
    
    if (brickfoxKey) {
      envContent += `BRICKFOX_API_KEY=${brickfoxKey}\n`;
      process.env.BRICKFOX_API_KEY = brickfoxKey;
    }

    // Save to .env file
    const envPath = path.join(process.cwd(), ".env");
    
    // Read existing .env and preserve other variables
    let existingEnv = '';
    if (fs.existsSync(envPath)) {
      existingEnv = fs.readFileSync(envPath, 'utf8');
    }
    
    // Remove old credential entries
    const filteredLines = existingEnv.split('\n').filter(line => 
      !line.startsWith('OPENAI_API_KEY=') &&
      !line.startsWith('PIXI_API_KEY=') &&
      !line.startsWith('CHANNEL_ENGINE_API_KEY=') &&
      !line.startsWith('BRICKFOX_API_KEY=')
    );
    
    // Combine with new credentials
    const finalContent = filteredLines.join('\n') + '\n' + envContent;
    fs.writeFileSync(envPath, finalContent);
    
    res.json({ success: true, message: "API-Schlüssel gespeichert" });
  });


  // Template Management: Get all templates
  app.get('/api/templates', async (req, res) => {
    try {
      const templates = await storage.getTemplates();
      res.json({ success: true, templates });
    } catch (error) {
      console.error('Get templates error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get templates' 
      });
    }
  });

  // Template Management: Create new template
  app.post('/api/templates', async (req, res) => {
    try {
      const { name, content, isDefault } = req.body;
      
      if (!name || !content) {
        return res.status(400).json({ error: 'Name and content are required' });
      }

      const template = await storage.createTemplate(name, content, isDefault);
      res.json({ success: true, template });
    } catch (error) {
      console.error('Create template error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to create template' 
      });
    }
  });

  // Template Management: Get single template
  app.get('/api/templates/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const template = await storage.getTemplate(id);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      res.json({ success: true, template });
    } catch (error) {
      console.error('Get template error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get template' 
      });
    }
  });

  // Template Management: Delete template
  app.delete('/api/templates/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteTemplate(id);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Template not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Delete template error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to delete template' 
      });
    }
  });

  // Supplier Management: Get all suppliers
  app.get('/api/suppliers', async (req, res) => {
    try {
      const suppliers = await storage.getSuppliers();
      res.json({ success: true, suppliers });
    } catch (error) {
      console.error('Get suppliers error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get suppliers' 
      });
    }
  });

  // Supplier Management: Create supplier
  app.post('/api/suppliers', async (req, res) => {
    try {
      const { createSupplierSchema } = await import('@shared/schema');
      const validation = createSupplierSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: 'Invalid supplier data', details: validation.error });
      }

      const supplier = await storage.createSupplier(validation.data);
      res.json({ success: true, supplier });
    } catch (error) {
      console.error('Create supplier error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to create supplier' 
      });
    }
  });

  // Supplier Management: Get single supplier
  app.get('/api/suppliers/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const supplier = await storage.getSupplier(id);
      
      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      res.json({ success: true, supplier });
    } catch (error) {
      console.error('Get supplier error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get supplier' 
      });
    }
  });

  // Supplier Management: Update supplier
  app.put('/api/suppliers/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { updateSupplierSchema } = await import('@shared/schema');
      const validation = updateSupplierSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ error: 'Invalid supplier data', details: validation.error });
      }

      const supplier = await storage.updateSupplier(id, validation.data);
      
      if (!supplier) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      res.json({ success: true, supplier });
    } catch (error) {
      console.error('Update supplier error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to update supplier' 
      });
    }
  });

  // Supplier Management: Delete supplier
  app.delete('/api/suppliers/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteSupplier(id);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Supplier not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Delete supplier error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to delete supplier' 
      });
    }
  });


  const httpServer = createServer(app);

  return httpServer;
}
