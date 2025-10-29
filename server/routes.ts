import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
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


  // Product Scraper: Scrape single product with custom selectors (Cheerio-based)
  app.post('/api/scrape-product', async (req, res) => {
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
  app.post('/api/scrape-product-list', async (req, res) => {
    try {
      const { url, productLinkSelector, maxProducts } = req.body;

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
      }

      // productLinkSelector is now optional - will use auto-detection if not provided
      console.log(`Scraping product list from: ${url}`);

      const productUrls = await scrapeProductList(
        url, 
        productLinkSelector || null, 
        maxProducts || 50
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



  // Product Creator: Neuer 3-Stufen Workflow mit Fortschritt
  app.post('/api/process-with-new-workflow', async (req, res) => {
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
  app.post('/api/generate-description', async (req, res) => {
    try {
      const { extractedData, customAttributes } = req.body;

      if (!extractedData || !Array.isArray(extractedData)) {
        return res.status(400).json({ error: 'Invalid extracted data' });
      }

      const description = await generateProductDescription(extractedData, undefined, customAttributes);

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
  app.post('/api/refine-description', async (req, res) => {
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
  app.post('/api/generate-product-name', async (req, res) => {
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
  app.post('/api/projects', async (req, res) => {
    try {
      const validation = createProjectSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: 'Invalid project data', details: validation.error });
      }

      const project = await storage.createProject(validation.data);
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
  app.post('/api/bulk-save-to-project', async (req, res) => {
    try {
      const { projectName, products } = req.body;

      if (!projectName || !Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ error: 'Project name and products are required' });
      }

      // Create new project
      const project = await storage.createProject({ name: projectName });

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
      
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('OPENAI_API_KEY=')) {
            openaiKey = line.split('=')[1] || '';
          }
        }
      }
      
      res.json({
        success: true,
        credentials: {
          openaiApiKey: openaiKey
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
    const { openaiKey } = req.body;
    
    if (!openaiKey) {
      return res.status(400).json({ success: false, message: "OpenAI API-Schlüssel erforderlich" });
    }

    // Speichern in .env Datei
    const envPath = path.join(process.cwd(), ".env");
    fs.writeFileSync(envPath, `OPENAI_API_KEY=${openaiKey}\n`);
    
    // Set environment variable for current session
    process.env.OPENAI_API_KEY = openaiKey;
    
    res.json({ success: true, message: "OpenAI API-Schlüssel gespeichert" });
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


  const httpServer = createServer(app);

  return httpServer;
}
