import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import { analyzePDF, analyzeCSV, analyzeImage, generateProductDescription, convertTextToHTML, refineDescription, generateProductName, processProductWithNewWorkflow } from "./ai-service";
import { fetchWithFirecrawl, extractFromHtml } from "./firecrawl-service";
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
      const firecrawlKey = apiKeyManager.getApiKey('firecrawl');
      
      res.json({
        openai: openaiKey ? '***' + openaiKey.slice(-4) : null,
        firecrawl: firecrawlKey ? '***' + firecrawlKey.slice(-4) : null
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

  // Product Creator: Analyze uploaded files (PDF, CSV, Images)
  app.post('/api/analyze-files', upload.array('files'), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const results = await Promise.all(
        files.map(async (file) => {
          const fileType = file.mimetype;
          console.log(`Processing file: ${file.originalname}, type: ${fileType}`);
          let result;

          if (fileType === 'application/pdf') {
            try {
              console.log(`Analyzing PDF: ${file.originalname}`);
              result = await analyzePDF(file.buffer, file.originalname);
              console.log(`PDF analysis successful for ${file.originalname}`);
            } catch (error) {
              console.error(`PDF analysis error for ${file.originalname}:`, error);
              result = {
                fileName: file.originalname,
                fileType: 'pdf',
                extractedText: `Fehler bei der PDF-Analyse: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
                structuredData: {},
                confidence: 0.1,
              };
            }
          } else if (fileType === 'text/csv' || file.originalname.endsWith('.csv')) {
            const text = file.buffer.toString('utf-8');
            result = await analyzeCSV(text, file.originalname);
          } else if (fileType.startsWith('image/')) {
            const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
            try {
              console.log(`Analyzing image: ${file.originalname}`);
              result = await analyzeImage(base64, file.originalname);
              console.log(`Image analysis result:`, result);
            } catch (error) {
              console.error('Image analysis error:', error);
              result = {
                fileName: file.originalname,
                fileType: 'image',
                extractedText: `Fehler bei der Bildanalyse: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
                structuredData: {},
                confidence: 0.1,
              };
            }
          } else {
            throw new Error(`Unsupported file type: ${fileType}`);
          }

          // Convert FileAnalysisResult to ExtractedProductData
          return {
            id: nanoid(),
            fileName: result.fileName,
            fileType: result.fileType,
            extractedText: result.extractedText,
            productName: result.structuredData?.productName || 'Unbekanntes Produkt',
            description: result.extractedText.substring(0, 500) + (result.extractedText.length > 500 ? '...' : ''),
            dimensions: result.structuredData?.dimensions || '',
            weight: result.structuredData?.weight || '',
            voltage: result.structuredData?.voltage || '',
            capacity: result.structuredData?.capacity || '',
            power: result.structuredData?.power || '',
            technicalSpecs: result.structuredData || {},
            confidence: result.confidence || 0.5,
            createdAt: new Date().toISOString(),
          };
        })
      );

      res.json({ success: true, results });
    } catch (error) {
      console.error('File analysis error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'File analysis failed' 
      });
    }
  });

  // Test route for Firecrawl debugging
  app.post('/api/test-firecrawl', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      console.log(`Testing Firecrawl with URL: ${url}`);
      const html = await fetchWithFirecrawl(url);
      
      res.json({
        success: true,
        htmlLength: html.length,
        htmlPreview: html.substring(0, 500) + '...',
        message: 'Firecrawl test successful'
      });
    } catch (error) {
      console.error('Firecrawl test error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Product Creator: Scrape URL with Firecrawl
  app.post('/api/scrape-url', async (req, res) => {
    try {
      const { url } = req.body;

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
      }

      // Validate URL format
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
      }

      console.log(`Scraping URL: ${url}`);

      // Test with a simple URL first if Nitecore fails
      if (url.includes('nitecore.de')) {
        console.log('Testing with example.com first...');
        try {
          const testHtml = await fetchWithFirecrawl('https://example.com');
          console.log('Test URL successful, HTML length:', testHtml.length);
        } catch (testError) {
          console.error('Test URL failed:', testError);
        }
      }

      // Try multiple methods to fetch the website
      let html;
      let fetchMethod = 'unknown';
      
      // Method 1: Try Firecrawl first
      try {
        console.log('Trying Firecrawl...');
        html = await fetchWithFirecrawl(url);
        fetchMethod = 'firecrawl';
        console.log('Firecrawl successful');
      } catch (firecrawlError) {
        console.error('Firecrawl failed:', firecrawlError);
        
        // Method 2: Try direct fetch as fallback
        try {
          console.log('Trying direct fetch...');
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 30000
          });
          
          if (response.ok) {
            html = await response.text();
            fetchMethod = 'direct';
            console.log('Direct fetch successful');
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (directError) {
          console.error('Direct fetch failed:', directError);
          
          // Method 3: Try with different user agent
          try {
            console.log('Trying with different user agent...');
            const response = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
              },
              timeout: 30000
            });
            
            if (response.ok) {
              html = await response.text();
              fetchMethod = 'googlebot';
              console.log('Googlebot user agent successful');
            } else {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
          } catch (googlebotError) {
            console.error('All fetch methods failed:', {
              firecrawl: firecrawlError.message,
              direct: directError.message,
              googlebot: googlebotError.message
            });
            
            return res.status(500).json({ 
              error: `Website kann nicht erreicht werden. Alle Versuche fehlgeschlagen:\n- Firecrawl: ${firecrawlError.message}\n- Direkter Zugriff: ${directError.message}\n- Googlebot: ${googlebotError.message}\n\nMögliche Ursachen:\n- Website blockiert Bots\n- Firewall/Proxy blockiert Zugriff\n- Website ist offline\n- CORS-Richtlinien blockieren Zugriff` 
            });
          }
        }
      }
      
      if (!html || html.length < 100) {
        console.error('No HTML content received or content too short');
        return res.status(500).json({ 
          error: 'Keine Produktdaten gefunden. Die Website konnte nicht geladen werden oder enthält keine verwertbaren Inhalte.' 
        });
      }

      // Extract data from HTML
      const extractedData = extractFromHtml(html);

      // Debug: Log extracted data
      console.log('=== URL SCRAPING DEBUG ===');
      console.log('URL:', url);
      console.log('Fetch method used:', fetchMethod);
      console.log('HTML length:', html.length);
      console.log('HTML preview (first 500 chars):', html.substring(0, 500));
      console.log('Extracted title:', extractedData.title);
      console.log('Extracted bullets:', extractedData.bullets);
      console.log('Extracted tech data:', extractedData.tech);
      console.log('Full extracted data:', extractedData);

      // Check if we have valid product data
      if (!extractedData.title && (!extractedData.bullets || extractedData.bullets.length === 0) && 
          (!extractedData.tech || Object.keys(extractedData.tech).length === 0)) {
        return res.status(400).json({ 
          error: 'Keine Produktdaten gefunden. Die Website enthält keine verwertbaren Produktinformationen.' 
        });
      }

      // Use AI to generate description instead of template
      const renderedHtml = await generateProductDescription([{
        id: nanoid(),
        fileName: new URL(url).hostname,
        fileType: 'url',
        extractedText: extractedData.title || 'URL Content',
        productName: extractedData.title || 'Unbekanntes Produkt',
        description: '',
        dimensions: extractedData.tech.size || '',
        weight: extractedData.tech.weight || '',
        voltage: '',
        capacity: '',
        power: '',
        technicalSpecs: extractedData.tech,
        confidence: 0.9,
        createdAt: new Date().toISOString(),
        url: url,
        supplierTableHtml: extractedData.supplierTableHtml,
        bullets: extractedData.bullets,
      }]);

      // Convert to the same format as file analysis
      const result = {
        id: nanoid(),
        fileName: new URL(url).hostname,
        fileType: 'url',
        extractedText: extractedData.title || 'URL Content',
        productName: extractedData.title || 'Unbekanntes Produkt',
        description: renderedHtml,
        dimensions: extractedData.tech.size || '',
        weight: extractedData.tech.weight || '',
        voltage: '',
        capacity: '',
        power: '',
        technicalSpecs: extractedData.tech,
        confidence: 0.9, // URLs are more reliable than images
        createdAt: new Date().toISOString(),
        url: url,
        supplierTableHtml: extractedData.supplierTableHtml,
        bullets: extractedData.bullets,
      };

      res.json({ success: true, result });
    } catch (error) {
      console.error('URL scraping error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'URL scraping failed' 
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

      const validation = createProductInProjectSchema.safeParse(req.body);
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
      let firecrawlKey = '';
      
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const lines = envContent.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('OPENAI_API_KEY=')) {
            openaiKey = line.split('=')[1] || '';
          } else if (line.startsWith('FIRECRAWL_API_KEY=')) {
            firecrawlKey = line.split('=')[1] || '';
          }
        }
      }
      
      res.json({
        success: true,
        credentials: {
          openaiApiKey: openaiKey,
          firecrawlApiKey: firecrawlKey
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
    console.log('POST /api/saveKeys called');
    console.log('Request body:', req.body);
    const { openaiKey, firecrawlKey } = req.body;
    console.log('Extracted keys:', { 
      openai: openaiKey ? '***' + openaiKey.slice(-4) : 'empty',
      firecrawl: firecrawlKey ? '***' + firecrawlKey.slice(-4) : 'empty'
    });
    
    if (!openaiKey && !firecrawlKey) {
      console.log('No keys provided, returning error');
      return res.status(400).json({ success: false, message: "Keine Keys übergeben" });
    }

    // Speichern in .env Datei
    const envPath = path.join(process.cwd(), ".env");
    const envLines = [];
    if (openaiKey) envLines.push(`OPENAI_API_KEY=${openaiKey}`);
    if (firecrawlKey) envLines.push(`FIRECRAWL_API_KEY=${firecrawlKey}`);

    fs.writeFileSync(envPath, envLines.join("\n"));
    
    // Set environment variables for current session
    if (openaiKey) process.env.OPENAI_API_KEY = openaiKey;
    if (firecrawlKey) process.env.FIRECRAWL_API_KEY = firecrawlKey;
    
    res.json({ success: true, message: "Keys gespeichert" });
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
