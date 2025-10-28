import OpenAI from 'openai';
import { createRequire } from 'node:module';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
// Template-System entfernt für Stabilität

// pdf-parse is a CommonJS module - use the PDFParse function directly
const require = createRequire(import.meta.url);
const pdfParseLib = require('pdf-parse');
// The module exports PDFParse as the main function - use new operator
const PDFParse = typeof pdfParseLib === 'function' ? pdfParseLib : pdfParseLib.PDFParse;

// Helper function to clean HTML responses from markdown code blocks
function cleanHTMLResponse(content: string): string {
  // Remove markdown code blocks (```html, ```, etc.) - more comprehensive cleaning
  let cleaned = content.replace(/^```(?:html|HTML)?\s*\n?/gm, '');
  cleaned = cleaned.replace(/\n?```\s*$/gm, '');
  
  // Remove any remaining ```html at the beginning
  cleaned = cleaned.replace(/^```html\s*\n?/gm, '');
  cleaned = cleaned.replace(/^```\s*\n?/gm, '');
  
  // KRITISCH: Entferne ✅ Icons aus Überschriften
  cleaned = cleaned.replace(/<h[1-6]>✅\s*([^<]+)<\/h[1-6]>/g, '<h3>$1</h3>');
  cleaned = cleaned.replace(/<h[1-6]>\s*✅\s*([^<]+)<\/h[1-6]>/g, '<h3>$1</h3>');
  
  // Remove unwanted accessibility USPs
  const unwantedPatterns = [
    /<p>✅\s*Drücken Sie die Eingabetaste.*?<\/p>/gi,
    /<p>✅\s*Barrierefreiheit.*?<\/p>/gi,
    /<p>✅\s*Screenreader.*?<\/p>/gi,
    /<p>✅\s*Menü.*?<\/p>/gi,
    /<p>✅\s*Eingabetaste.*?<\/p>/gi,
    /<p>✅\s*Blinde.*?<\/p>/gi
  ];
  
  unwantedPatterns.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  // Count remaining USPs and add fallback USPs if needed
  const uspMatches = cleaned.match(/<p>✅.*?<\/p>/g);
  const uspCount = uspMatches ? uspMatches.length : 0;
  
  if (uspCount < 5) {
    const fallbackUSPs = [
      '<p>✅ Hochwertige Verarbeitung</p>',
      '<p>✅ Langlebige Konstruktion</p>',
      '<p>✅ Einfache Bedienung</p>',
      '<p>✅ Zuverlässige Leistung</p>',
      '<p>✅ Gutes Preis-Leistungs-Verhältnis</p>'
    ];
    
    // Find the Vorteile section and replace it
    const vorteileSection = cleaned.match(/<h4>Vorteile & Eigenschaften:<\/h4>[\s\S]*?(?=<h4>|$)/);
    if (vorteileSection) {
      const newVorteileSection = '<h4>Vorteile & Eigenschaften:</h4>\n' + fallbackUSPs.join('\n');
      cleaned = cleaned.replace(vorteileSection[0], newVorteileSection);
    }
  }
  
  // Remove any remaining markdown formatting
  cleaned = cleaned.trim();
  
  return cleaned;
}

// Helper functions to convert units
function convertWeightToGrams(weightStr: string): string {
  // Convert kg to g
  const kgMatch = weightStr.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (kgMatch) {
    const kgValue = parseFloat(kgMatch[1].replace(',', '.'));
    const grams = Math.round(kgValue * 1000);
    return weightStr.replace(kgMatch[0], `${grams} g`);
  }
  
  // If already in grams, return as is
  return weightStr;
}

function convertDimensionsToMm(dimensionsStr: string): string {
  // Convert cm to mm
  const cmMatch = dimensionsStr.match(/(\d+(?:[.,]\d+)?)\s*×\s*(\d+(?:[.,]\d+)?)\s*×\s*(\d+(?:[.,]\d+)?)\s*cm/i);
  if (cmMatch) {
    const dim1 = Math.round(parseFloat(cmMatch[1].replace(',', '.')) * 10);
    const dim2 = Math.round(parseFloat(cmMatch[2].replace(',', '.')) * 10);
    const dim3 = Math.round(parseFloat(cmMatch[3].replace(',', '.')) * 10);
    return dimensionsStr.replace(cmMatch[0], `${dim1} × ${dim2} × ${dim3} mm`);
  }
  
  // If already in mm, return as is
  return dimensionsStr;
}

// Helper function to convert units in extracted text
function convertUnitsInText(text: string): string {
  let convertedText = text;
  
  // Convert weight from kg to g
  convertedText = convertedText.replace(/(\d+(?:[.,]\d+)?)\s*kg/gi, (match, value) => {
    const kgValue = parseFloat(value.replace(',', '.'));
    const grams = Math.round(kgValue * 1000);
    return `${grams} g`;
  });
  
  // Convert dimensions from cm to mm
  convertedText = convertedText.replace(/(\d+(?:[.,]\d+)?)\s*×\s*(\d+(?:[.,]\d+)?)\s*×\s*(\d+(?:[.,]\d+)?)\s*cm/gi, (match, dim1, dim2, dim3) => {
    const d1 = Math.round(parseFloat(dim1.replace(',', '.')) * 10);
    const d2 = Math.round(parseFloat(dim2.replace(',', '.')) * 10);
    const d3 = Math.round(parseFloat(dim3.replace(',', '.')) * 10);
    return `${d1} × ${d2} × ${d3} mm`;
  });
  
  return convertedText;
}

// Helper function to clean extracted text from markdown formatting
function cleanExtractedText(content: string): string {
  // Remove markdown code blocks (```plaintext, ```, etc.)
  let cleaned = content.replace(/^```(?:plaintext|html|HTML)?\s*\n?/gm, '');
  cleaned = cleaned.replace(/\n?```\s*$/gm, '');
  
  // Remove ALL occurrences of markdown bold indicators (**)
  cleaned = cleaned.replace(/\*\*/g, '');
  
  // Remove ALL occurrences of markdown italic indicators (*)
  cleaned = cleaned.replace(/\*/g, '');
  
  // Remove any remaining markdown formatting
  cleaned = cleaned.trim();
  
  // Convert units in the cleaned text
  cleaned = convertUnitsInText(cleaned);
  
  return cleaned;
}

// Initialize OpenAI with API key from config or environment
let openai: OpenAI | null = null;

import { getSecureOpenAIKey } from './api-key-manager';

// Function to get current API key from secure manager
function getOpenAIKey(): string | null {
  return getSecureOpenAIKey();
}

function getOpenAIBaseUrl(): string | undefined {
  return process.env.OPENAI_BASE_URL || process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
}

// Initialize OpenAI with current API key
const apiKey = getOpenAIKey();
const baseUrl = getOpenAIBaseUrl();

if (apiKey && apiKey !== 'dein-api-schlüssel-hier') {
  openai = new OpenAI({
    apiKey: apiKey,
    baseURL: baseUrl,
  });
}

export interface FileAnalysisResult {
  fileName: string;
  fileType: 'pdf' | 'csv' | 'image';
  extractedText: string;
  structuredData?: Record<string, any>;
  confidence?: number;
}

export async function analyzePDF(buffer: Buffer, fileName: string): Promise<FileAnalysisResult> {
  try {
    console.log(`Analyzing PDF: ${fileName}, buffer size: ${buffer.length}`);
    const data = await new PDFParse(buffer);
    
    // Check if data and text exist
    if (!data || typeof data.text !== 'string') {
      console.error(`PDF analysis failed for ${fileName}: No text extracted`);
      throw new Error(`PDF analysis failed: No text could be extracted from the PDF`);
    }
    
    const extractedText = data.text;
    console.log(`PDF analysis successful for ${fileName}, extracted ${extractedText.length} characters`);

    return {
      fileName,
      fileType: 'pdf',
      extractedText: cleanExtractedText(extractedText),
      confidence: 0.9,
    };
  } catch (error) {
    console.error(`PDF analysis failed for ${fileName}:`, error);
    throw new Error(`PDF analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function analyzeCSV(text: string, fileName: string): Promise<FileAnalysisResult> {
  const lines = text.split('\n').filter(line => line.trim());
  const headers = lines[0]?.split(/[,;\t]/).map(h => h.trim()) || [];
  const rows = lines.slice(1).map(line => {
    const values = line.split(/[,;\t]/).map(v => v.trim());
    return headers.reduce((obj, header, index) => {
      obj[header] = values[index] || '';
      return obj;
    }, {} as Record<string, string>);
  });

  return {
    fileName,
    fileType: 'csv',
    extractedText: cleanExtractedText(text),
    structuredData: { headers, rows },
    confidence: 1.0,
  };
}

export async function analyzeImage(base64Image: string, fileName: string): Promise<FileAnalysisResult> {
  try {
    console.log('Starting image analysis for:', fileName);
    
    // Use GPT Vision directly - it's much better than OCR
    console.log('Using GPT Vision for image analysis');
    return await analyzeImageWithGPT(base64Image, fileName);
    
  } catch (error) {
    console.error('Image analysis completely failed:', error);
    throw new Error(`Image analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function performOCR(base64Image: string): Promise<{text: string, confidence: number}> {
  console.log('Starting OCR process...');
  
  let worker;
  try {
    worker = await createWorker('deu+eng'); // German and English
    console.log('OCR worker created');
    
    // Configure OCR for better table recognition
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;()[]{}°%+-/\\|_ ',
      tessedit_ocr_engine_mode: '1', // Neural nets LSTM engine only
      preserve_interword_spaces: '1', // Preserve spaces between words
      tessedit_create_hocr: '0', // Don't create hOCR
      tessedit_create_tsv: '0', // Don't create TSV
    } as any);
    console.log('OCR parameters set');
    
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Image.split(',')[1], 'base64');
    console.log('Image buffer created, size:', imageBuffer.length);
    
    // Preprocess image with Sharp for better OCR - much more aggressive preprocessing
    const processedImage = await sharp(imageBuffer)
      .resize(4000, 4000, { fit: 'inside', withoutEnlargement: false })
      .sharpen({ sigma: 3.0, m1: 0.5, m2: 3.0 })
      .normalize()
      .greyscale()
      .modulate({ brightness: 1.2 })
      .png()
      .toBuffer();
    console.log('Image processed, new size:', processedImage.length);
    
    // Perform OCR
    console.log('Performing OCR...');
    const { data: { text, confidence } } = await worker.recognize(processedImage);
    
    console.log('OCR Raw Text length:', text.length);
    console.log('OCR Raw Text preview:', text.substring(0, 200) + '...');
    console.log('OCR Confidence:', confidence);
    
    // Parse table data from OCR text
    const tableData = parseTableFromOCR(text);
    console.log('Parsed Table Data length:', tableData.length);
    console.log('Parsed Table Data preview:', tableData.substring(0, 200) + '...');
    
    return {
      text: tableData,
      confidence: confidence / 100
    };
  } catch (error) {
    console.error('OCR process failed:', error);
    throw error;
  } finally {
    if (worker) {
      try {
        await worker.terminate();
        console.log('OCR worker terminated');
      } catch (terminateError) {
        console.error('Error terminating OCR worker:', terminateError);
      }
    }
  }
}

function parseTableFromOCR(text: string): string {
  const lines = text.split('\n').filter(line => line.trim());
  const tableLines: string[] = [];
  
  // Look for structured data patterns
  for (const line of lines) {
    // Pattern 1: "Beschriftung: Wert" or "Beschriftung\tWert"
    const colonMatch = line.match(/^(.+?)[:\t]\s*(.+)$/);
    if (colonMatch) {
      const [, label, value] = colonMatch;
      if (label.trim() && value.trim() && label.length < 50) {
        let convertedValue = value.trim();
        
        // Konvertiere Einheiten basierend auf dem Label
        const labelLower = label.trim().toLowerCase();
        if (labelLower.includes('gewicht') || labelLower.includes('weight')) {
          convertedValue = convertWeightToGrams(value.trim());
        } else if (labelLower.includes('abmessung') || labelLower.includes('dimension') || 
                   labelLower.includes('größe') || labelLower.includes('size')) {
          convertedValue = convertDimensionsToMm(value.trim());
        }
        
        tableLines.push(`- ${label.trim()}: ${convertedValue}`);
        continue;
      }
    }
    
    // Pattern 2: "Beschriftung Wert" (space separated)
    const spaceMatch = line.match(/^(.+?)\s+(.+)$/);
    if (spaceMatch) {
      const [, label, value] = spaceMatch;
      // Check if it looks like a label-value pair
      if (label.length < 30 && value.length > 0 && 
          !value.includes(' ') && 
          (value.includes('mAh') || value.includes('V') || value.includes('A') || 
           value.includes('mm') || value.includes('g') || value.includes('Wh') ||
           /^\d+/.test(value) || /^\d+[,.]\d+/.test(value))) {
        
        let convertedValue = value.trim();
        
        // Konvertiere Einheiten basierend auf dem Label
        const labelLower = label.trim().toLowerCase();
        if (labelLower.includes('gewicht') || labelLower.includes('weight')) {
          convertedValue = convertWeightToGrams(value.trim());
        } else if (labelLower.includes('abmessung') || labelLower.includes('dimension') || 
                   labelLower.includes('größe') || labelLower.includes('size')) {
          convertedValue = convertDimensionsToMm(value.trim());
        }
        
        tableLines.push(`- ${label.trim()}: ${convertedValue}`);
        continue;
      }
    }
    
    // Pattern 3: Look for technical specifications in the text
    const techSpecs = extractTechnicalSpecs(line);
    if (techSpecs.length > 0) {
      tableLines.push(...techSpecs);
    }
  }
  
  return tableLines.join('\n');
}

function extractTechnicalSpecs(line: string): string[] {
  const specs: string[] = [];
  
  // Common technical specification patterns
  const patterns = [
    { regex: /Modell[:\s]+([^\n]+)/i, label: 'Modell' },
    { regex: /Typ[:\s]+([^\n]+)/i, label: 'Typ' },
    { regex: /Kapazität[:\s]+([^\n]+)/i, label: 'Kapazität' },
    { regex: /Energieinhalt[:\s]+([^\n]+)/i, label: 'Energieinhalt' },
    { regex: /Nennspannung[:\s]+([^\n]+)/i, label: 'Nennspannung' },
    { regex: /Spannung[:\s]+([^\n]+)/i, label: 'Spannung' },
    { regex: /Max\.?\s*Entladestrom[:\s]+([^\n]+)/i, label: 'Max. Entladestrom' },
    { regex: /Entladestrom[:\s]+([^\n]+)/i, label: 'Entladestrom' },
    { regex: /Ladeverfahren[:\s]+([^\n]+)/i, label: 'Ladeverfahren' },
    { regex: /Abmessungen[:\s]+([^\n]+)/i, label: 'Abmessungen' },
    { regex: /Gewicht[:\s]+([^\n]+)/i, label: 'Gewicht' },
    { regex: /Durchmesser[:\s]+([^\n]+)/i, label: 'Durchmesser' },
    { regex: /Länge[:\s]+([^\n]+)/i, label: 'Länge' },
    { regex: /Breite[:\s]+([^\n]+)/i, label: 'Breite' },
    { regex: /Höhe[:\s]+([^\n]+)/i, label: 'Höhe' },
  ];
  
  for (const pattern of patterns) {
    const match = line.match(pattern.regex);
    if (match) {
      let value = match[1].trim();
      
      // Konvertiere Einheiten basierend auf dem Label
      if (pattern.label === 'Gewicht' || pattern.label === 'Abmessungen' || 
          pattern.label === 'Durchmesser' || pattern.label === 'Länge' || 
          pattern.label === 'Breite' || pattern.label === 'Höhe') {
        if (pattern.label === 'Gewicht') {
          value = convertWeightToGrams(value);
        } else {
          value = convertDimensionsToMm(value);
        }
      }
      
      if (value && value.length < 100) {
        specs.push(`- ${pattern.label}: ${value}`);
      }
    }
  }
  
  return specs;
}

async function analyzeImageWithGPT(base64Image: string, fileName: string): Promise<FileAnalysisResult> {
  console.log('Starting GPT Vision analysis for:', fileName);
  
  // Get current API key
  const currentApiKey = getOpenAIKey();
  const currentBaseUrl = getOpenAIBaseUrl();
  
  if (!currentApiKey || currentApiKey === 'dein-api-schlüssel-hier') {
    console.log('OpenAI API key not configured. Returning fallback data.');
    return {
      fileName,
      fileType: 'image',
      extractedText: 'OpenAI API key nicht konfiguriert. Bitte konfigurieren Sie den API-Schlüssel.',
      structuredData: {},
      confidence: 0.1,
    };
  }
  
  // Create OpenAI instance with current key
  const currentOpenai = new OpenAI({
    apiKey: currentApiKey,
    baseURL: currentBaseUrl,
  });
  
  try {
    console.log('Sending request to GPT Vision...');
    const response = await currentOpenai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Du siehst ein Bild mit Produktinformationen. Extrahiere alle sichtbaren Produktdaten und verwende das folgende Format:

- Modell: [was du siehst]
- Typ: [was du siehst]  
- Spannung: [was du siehst]
- Kapazität: [was du siehst]
- Eingang: [was du siehst]
- Ausgang: [was du siehst]
- Besonderheiten: [was du siehst]

WICHTIG für Einheiten:
- Gewicht: Konvertiere kg zu g (z.B. "0.102 kg" → "102 g")
- Abmessungen: Konvertiere cm zu mm (z.B. "5.7 × 2 × 6.9 cm" → "57 × 20 × 69 mm")

Extrahiere alle technischen Daten, die du im Bild siehst. Schreibe auch unvollständige Wörter auf, wenn du sie teilweise erkennen kannst.`
            },
            {
              type: 'image_url',
              image_url: {
                url: base64Image,
                detail: 'high' // Höchste Auflösung für bessere Erkennung
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
    });

    const extractedText = response.choices[0]?.message?.content || '';
    console.log('GPT Vision response length:', extractedText.length);
    console.log('GPT Vision response preview:', extractedText.substring(0, 200) + '...');

    // If GPT Vision gives up, try a different approach
    if (extractedText.includes('kann den Text nicht') || extractedText.includes('kann nicht lesen') || extractedText.includes('nicht erkennen') || extractedText.includes('Bildqualität') || extractedText.includes('nicht lesen') || extractedText.includes('höher aufgelöstes') || extractedText.includes('unable to provide') || extractedText.includes('cannot read') || extractedText.includes('unable to') || extractedText.includes('cannot see') || extractedText.includes('not readable')) {
      console.log('GPT Vision gave up, trying alternative approach...');
      
      const alternativeResponse = await currentOpenai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Schaue dir dieses Bild sehr genau an. Es zeigt eine Produktseite mit technischen Daten. Beschreibe mir ALLES was du siehst, besonders die technischen Spezifikationen. Verwende das Format:

- Modell: [was du siehst]
- Typ: [was du siehst]  
- Spannung: [was du siehst]
- Kapazität: [was du siehst]
- Eingang: [was du siehst]
- Ausgang: [was du siehst]
- Besonderheiten: [was du siehst]

Versuche alle Zahlen, Maße und technischen Daten zu erkennen.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: base64Image,
                  detail: 'high'
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      });

      const alternativeText = alternativeResponse.choices[0]?.message?.content || '';
      console.log('Alternative GPT Vision response length:', alternativeText.length);
      console.log('Alternative GPT Vision response preview:', alternativeText.substring(0, 200) + '...');
      
      return {
        fileName,
        fileType: 'image',
        extractedText: cleanExtractedText(alternativeText),
        confidence: 0.85,
      };
    }

    return {
      fileName,
      fileType: 'image',
      extractedText: cleanExtractedText(extractedText),
      confidence: 0.85,
    };
  } catch (error) {
    console.error('GPT Vision failed:', error);
    throw error;
  }
}

// Diese Funktion wurde durch generateAkkushopDescription ersetzt
export async function generateProductDescription(
  extractedData: any[],
  template?: string,
  customAttributes?: {
    exactProductName?: string;
    articleNumber?: string;
    customAttributes?: Array<{key: string, value: string, type: string}>;
  },
  onProgress?: (step: number, message: string) => void
): Promise<string> {
  console.log('=== USING AI-BASED GENERATION ===');
  
  // Verwende die AI-basierte Generierung für dynamische Struktur basierend auf Lieferantendaten
  return await generateAkkushopDescription(extractedData);
}

export async function convertTextToHTML(
  plainText: string,
  extractedData?: string[]
): Promise<string> {
  try {
    // Get current API key
    const currentApiKey = getOpenAIKey();
    const currentBaseUrl = getOpenAIBaseUrl();
    
    if (!currentApiKey || currentApiKey === 'dein-api-schlüssel-hier') {
      console.log('OpenAI API key not configured. Returning fallback description.');
      return 'OpenAI API key nicht konfiguriert. Bitte konfigurieren Sie den API-Schlüssel.';
    }
    
    // Create OpenAI instance with current key
    const currentOpenai = new OpenAI({
      apiKey: currentApiKey,
      baseURL: currentBaseUrl,
    });
    
    const dataContext = extractedData?.length 
      ? `\n\nZusätzliche Produktdaten:\n${extractedData.join('\n\n---\n\n')}`
      : '';

    const response = await currentOpenai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Du bist ein Experte für Produktbeschreibungen. Konvertiere den gegebenen Fließtext in eine professionelle HTML-Beschreibung.

WICHTIG: Erstelle KEINE feste Struktur! Passe die Struktur an die verfügbaren Daten an.

REGELN:
- Verwende strukturierte HTML-Tags (<h2>, <h4>, <p>, <table>, <tr>, <td>)
- Erstelle IMMER GENAU 5 grüne Bulletpoints mit ✅ für Vorteile (Überschrift OHNE Icon)
- VERBOTEN: Keine UI-Anweisungen, keine Barrierefreiheits-Hinweise
- FOKUS: Nur echte Produktvorteile aus den technischen Daten ableiten
- Erstelle eine logische, verkaufsfördernde Struktur ohne feste Vorlage
- Passe die Struktur an die verfügbaren Daten an
- KEINE festen Sektionen - nur das was Daten hat

Gib NUR den reinen HTML-Code zurück, OHNE \`\`\`html am Anfang oder \`\`\` am Ende.`,
        },
        {
          role: 'user',
          content: `Konvertiere diesen Text in HTML:\n\n${plainText}${dataContext}`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.5,
    });

    const generatedContent = response.choices[0]?.message?.content || '';
    
    // Clean up the response to remove markdown code blocks
    return cleanHTMLResponse(generatedContent);
  } catch (error) {
    throw new Error(`Text to HTML conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function refineDescription(
  currentDescription: string,
  userPrompt: string,
  extractedData?: string[]
): Promise<string> {
  try {
    // Get current API key
    const currentApiKey = getOpenAIKey();
    const currentBaseUrl = getOpenAIBaseUrl();
    
    if (!currentApiKey || currentApiKey === 'dein-api-schlüssel-hier') {
      console.log('OpenAI API key not configured. Returning fallback description.');
      return 'OpenAI API key nicht konfiguriert. Bitte konfigurieren Sie den API-Schlüssel.';
    }
    
    // Create OpenAI instance with current key
    const currentOpenai = new OpenAI({
      apiKey: currentApiKey,
      baseURL: currentBaseUrl,
    });
    
    const dataContext = extractedData?.length 
      ? `\n\nVerfügbare Produktdaten:\n${extractedData.join('\n\n---\n\n')}`
      : '';

    const response = await currentOpenai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Du bist ein Experte für E-Commerce-Produktbeschreibungen. 
Verfeinere die bestehende HTML-Produktbeschreibung basierend auf den Anweisungen des Users.

WICHTIG: Erstelle KEINE feste Struktur! Passe die Struktur an die verfügbaren Daten an.

Wichtig:
- Behalte die HTML-Struktur bei
- Setze die Änderungen präzise um
- Gib NUR den reinen HTML-Code zurück, OHNE \`\`\`html am Anfang oder \`\`\` am Ende
- Verwende KEINE Markdown-Codeblöcke oder zusätzliche Erklärungen
- Für technische Daten in Tabellen: Abmessungen in mm, Gewicht in g
- KEINE festen Sektionen - nur das was Daten hat
- Passe die Struktur an die verfügbaren Daten an`,
        },
        {
          role: 'user',
          content: `Aktuelle Produktbeschreibung:\n\n${currentDescription}\n\nÄnderungswunsch: ${userPrompt}${dataContext}`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const generatedContent = response.choices[0]?.message?.content || '';
    
    // Clean up the response to remove markdown code blocks
    return cleanHTMLResponse(generatedContent);
  } catch (error) {
    throw new Error(`Description refinement failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function generateProductName(
  extractedData: string[]
): Promise<string> {
  try {
    // Get current API key
    const currentApiKey = getOpenAIKey();
    const currentBaseUrl = getOpenAIBaseUrl();
    
    if (!currentApiKey || currentApiKey === 'dein-api-schlüssel-hier') {
      console.log('OpenAI API key not configured. Returning fallback description.');
      return 'OpenAI API key nicht konfiguriert. Bitte konfigurieren Sie den API-Schlüssel.';
    }
    
    // Create OpenAI instance with current key
    const currentOpenai = new OpenAI({
      apiKey: currentApiKey,
      baseURL: currentBaseUrl,
    });
    
    const combinedData = extractedData.join('\n\n---\n\n');

    const response = await currentOpenai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Du bist ein Experte für E-Commerce-Produktnamen. 
Generiere einen kurzen, prägnanten Produktnamen basierend auf den extrahierten Produktdaten.

Der Produktname sollte:
- Maximal 60 Zeichen lang sein
- Den wichtigsten Produkttyp und die Marke enthalten
- Klar und professionell formuliert sein
- Ohne Anführungszeichen oder Sonderformatierung sein
- Im Format: "Marke Produkttyp Modell/Variante" (z.B. "Varta Wiederaufladbare AA-Batterie USB")

Gib NUR den Produktnamen zurück, ohne zusätzliche Erklärungen oder Formatierung.`,
        },
        {
          role: 'user',
          content: `Extrahierte Produktdaten:\n\n${combinedData}`,
        },
      ],
      max_tokens: 100,
      temperature: 0.5,
    });

    let productName = response.choices[0]?.message?.content || '';
    
    // Clean up the product name
    productName = productName.replace(/^["']|["']$/g, '').trim();
    
    return productName;
  } catch (error) {
    throw new Error(`Product name generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ===== NEUER 3-STUFEN WORKFLOW =====

// ===== SCHRITT 1: DATENEXTRAKTION =====
export async function extractProductData(htmlOrText: string): Promise<any> {
  try {
    const currentApiKey = getOpenAIKey();
    const currentBaseUrl = getOpenAIBaseUrl();
    
    if (!currentApiKey || currentApiKey === 'dein-api-schlüssel-hier') {
      throw new Error('OpenAI API key nicht konfiguriert');
    }
    
    const openai = new OpenAI({
      apiKey: currentApiKey,
      baseURL: currentBaseUrl,
    });
    
    const systemPrompt = `Du bist ein Datenextraktions-Agent für Produktseiten.

⚙️ Wichtige Regeln:
1. Ignoriere jegliche vorherige Inhalte, Zwischenspeicher oder temporäre Variablen.  
   Erstelle die Ausgabe **ausschließlich basierend auf der aktuellen Eingabe (input)**.  
   Verwende keine Daten aus Cache, Memory, Session oder Response-Historie.
2. Verarbeite jede Anfrage als **vollständig neuen Kontext**.
3. Deine Ausgabe muss **ausschließlich valides JSON** sein — keine Markdown-Zeichen, keine Code-Blöcke.
4. Der JSON-Code beginnt immer mit { und endet mit }.
5. Wenn du alten oder fehlerhaften Inhalt erkennst, **überschreibe den gesamten Inhalt neu**.

Analysiere den folgenden HTML- oder Textinhalt einer Lieferantenseite und extrahiere nur die relevanten Produktinformationen.

Liefere das Ergebnis ausschließlich als gültiges JSON im folgenden Format:

{
  "product_name": "",
  "short_intro": "",
  "features": [],
  "performance": {
    "flutlicht": {},
    "spotlicht": {},
    "mix": {}
  },
  "technical_data": {},
  "use_cases": [],
  "safety_notes": "",
  "package_contents": ""
}

Regeln:
- Extrahiere nur das Hauptprodukt (keine Zubehörartikel oder Alternativen).
- Falls ein Wert fehlt, lasse das Feld leer ("").
- Werte aus Tabellen oder Stichpunkten korrekt übernehmen.
- Leistungsdaten (Lumen, Stunden, Modi etc.) sollen als Key-Value-Paare übernommen werden.
- Entferne HTML-Tags, behalte nur reinen Text.
- Achte auf Sonderzeichen (ä, ö, ü) in Unicode (nicht als Entities).

Beispielausgabe:
{
  "product_name": "Nitecore P40 - LEP-Laser Lampe, 2000 Lumen",
  "short_intro": "Leistungsstarke LEP-Taschenlampe mit 2000 Lumen und 2900 m Reichweite.",
  "features": [
    "Bis zu 2000 Lumen Lichtleistung",
    "Drei Lichtmodi: Spot-, Flut- und Mixbetrieb",
    "HAIII eloxiertes Aluminiumgehäuse, IP68",
    "USB-C Schnellladefunktion"
  ],
  "performance": {
    "flutlicht": {
      "high": "800 Lumen – 2h30min",
      "mid": "400 Lumen – 4h",
      "low": "100 Lumen – 20h"
    },
    "spotlicht": {
      "turbo": "2000 Lumen – 1h",
      "high": "400 Lumen – 2h30min",
      "mid": "200 Lumen – 3h45min",
      "low": "50 Lumen – 20h"
    }
  },
  "technical_data": {
    "Leuchtweite": "2900 m",
    "Gewicht": "186 g",
    "Akku": "21700 Li-Ion 5500 mAh",
    "Wasserschutz": "IP68"
  },
  "use_cases": ["Outdoor", "Polizei", "Jagd"],
  "safety_notes": "Nur mit geeigneten Akkus betreiben, nicht in Augen leuchten.",
  "package_contents": "Lampe, Akku, Holster, USB-C-Kabel, Ersatzringe"
}

Die Ausgabe ist valides JSON.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: htmlOrText }
      ],
      temperature: 0.1,
    });

    const jsonString = response.choices[0]?.message?.content?.trim() || '{}';
    
    // Parse JSON und validieren
    try {
      // Clean JSON response - remove markdown code blocks
      let cleanedContent = jsonString;
      cleanedContent = cleanedContent.replace(/^```json\s*\n?/gm, '');
      cleanedContent = cleanedContent.replace(/\n?```\s*$/gm, '');
      cleanedContent = cleanedContent.replace(/^```\s*\n?/gm, '');
      cleanedContent = cleanedContent.trim();
      
      console.log('Cleaned JSON:', cleanedContent);
      
      return JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      console.error('Raw response:', jsonString);
      throw new Error('KI konnte keine gültigen JSON-Daten extrahieren');
    }
    
  } catch (error) {
    console.error('ExtractProductData error:', error);
    throw error;
  }
}

// ===== SCHRITT 2: VALIDIERUNG & NORMALISIERUNG =====
export function normalizeProductData(input: any): any {
  const data = typeof input === "string" ? JSON.parse(input) : input;

  // Konvertiere Gewicht zu Gramm
  const convertWeightToGrams = (weightStr: string): string => {
    if (!weightStr || weightStr === 'Nicht angegeben') return 'Nicht angegeben';
    
    const weight = parseFloat(weightStr.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (isNaN(weight)) return weightStr;
    
    if (weightStr.toLowerCase().includes('kg')) {
      return `${Math.round(weight * 1000)} g`;
    } else if (weightStr.toLowerCase().includes('g')) {
      return `${Math.round(weight)} g`;
    } else {
      return `${Math.round(weight)} g`;
    }
  };
  
  // Konvertiere Abmessungen zu mm
  const convertDimensionsToMm = (dimStr: string): string => {
    if (!dimStr || dimStr === 'Nicht angegeben') return 'Nicht angegeben';
    
    // Wenn bereits mm enthalten, zurückgeben
    if (dimStr.toLowerCase().includes('mm')) return dimStr;
    
    // Wenn cm enthalten, zu mm konvertieren
    if (dimStr.toLowerCase().includes('cm')) {
      const numbers = dimStr.match(/[\d.,]+/g);
      if (numbers) {
        const converted = numbers.map(num => {
          const val = parseFloat(num.replace(',', '.'));
          return isNaN(val) ? num : Math.round(val * 10);
        });
        // Ersetze Zahlen und entferne "cm", füge "mm" hinzu
        return dimStr.replace(/[\d.,]+/g, (match, index) => converted[index]).replace(/cm/gi, '') + ' mm';
      }
    }
    
    return dimStr;
  };

  // Konvertiere Gewicht und Abmessungen
  if (data.weight) {
    data.weight = convertWeightToGrams(data.weight);
  }
  if (data.size) {
    data.size = convertDimensionsToMm(data.size);
  }
  if (data.abmessungen) {
    data.abmessungen = convertDimensionsToMm(data.abmessungen);
  }
  if (data.gewicht) {
    data.gewicht = convertWeightToGrams(data.gewicht);
  }

  // Standardwerte ergänzen
  if (!data.safety_notes) {
    data.safety_notes = "Bitte beachten Sie die Sicherheitsanweisungen des Herstellers zur sicheren Verwendung des Produkts.";
  }

  if (!data.package_contents) {
    data.package_contents = "Lieferumfang: Produkt wie beschrieben.";
  }

  if (!data.use_cases || data.use_cases.length === 0) {
    data.use_cases = ["Haushalt", "Werkstatt", "Outdoor"];
  }

  // Einheitliche Reihenfolge erzwingen
  const ordered = {
    product_name: data.product_name || "",
    short_intro: data.short_intro || "",
    features: data.features || [],
    performance: data.performance || {},
    technical_data: data.technical_data || {},
    use_cases: data.use_cases || [],
    safety_notes: data.safety_notes || "",
    package_contents: data.package_contents || "",
    // Füge konvertierte Werte hinzu
    leistung: data.leistung || data.power || 'Nicht angegeben',
    spannung: data.spannung || data.voltage || 'Nicht angegeben',
    gewicht: data.gewicht || data.weight || 'Nicht angegeben',
    abmessungen: data.abmessungen || data.size || 'Nicht angegeben',
    material: data.material || 'Nicht angegeben',
    feature_1: data.feature_1 || 'Hochwertige Verarbeitung',
    feature_2: data.feature_2 || 'Zuverlässige Leistung',
    feature_3: data.feature_3 || 'Benutzerfreundliches Design',
    feature_4: data.feature_4 || 'Langlebige Qualität',
    feature_5: data.feature_5 || 'Optimales Preis-Leistungs-Verhältnis'
  };

  return ordered;
}

// ===== SCHRITT 3: HTML-GENERIERUNG =====
export async function generateAkkushopDescription(normalizedData: any): Promise<string> {
  try {
    const currentApiKey = getOpenAIKey();
    const currentBaseUrl = getOpenAIBaseUrl();
    
    if (!currentApiKey || currentApiKey === 'dein-api-schlüssel-hier') {
      throw new Error('OpenAI API key nicht konfiguriert');
    }
    
    const openai = new OpenAI({
      apiKey: currentApiKey,
      baseURL: currentBaseUrl,
    });
    
    const systemPrompt = `Du bist ein spezialisierter Produkttext-Agent für den Onlineshop Akkushop.de.

ERSTELLE IMMER DIESE EXAKTE STRUKTUR:

<ul>
<li>
<h2>PRODUKTNAME</h2>
<p>Detaillierte Produktbeschreibung (4-5 Sätze)<br /><br />
✅ Feature 1 (NUR aus bullets, KEINE technischen Daten)<br />
✅ Feature 2 (NUR aus bullets, KEINE technischen Daten)<br />
✅ Feature 3 (NUR aus bullets, KEINE technischen Daten)<br />
✅ Feature 4 (NUR aus bullets, KEINE technischen Daten)<br />
✅ Feature 5 (NUR aus bullets, KEINE technischen Daten)</p>

<h3>Produkteigenschaften & Highlights</h3>
<p>
✅ Robustes Gehäuse und langlebige Verarbeitung<br />
✅ Ergonomisches Design für komfortables Arbeiten<br />
✅ Hohe Leistung bei geringem Energieverbrauch<br />
✅ Vielseitig einsetzbar in Werkstatt und Haushalt<br />
✅ Optimales Preis-Leistungs-Verhältnis
</p>

<h4>Technische Daten:</h4>
<table border="0" summary="">
<tbody>
<tr><td>Leistung:</td><td>VERWENDE technicalSpecs.standards ODER technicalSpecs.kapazität</td></tr>
<tr><td>Spannung:</td><td>VERWENDE technicalSpecs.ladestrom ODER technicalSpecs.spannung</td></tr>
<tr><td>Gewicht:</td><td>VERWENDE technicalSpecs.weight</td></tr>
<tr><td>Abmessungen:</td><td>VERWENDE technicalSpecs.size (Format: L×B×H mm)</td></tr>
<tr><td>Material:</td><td>VERWENDE technicalSpecs.material ODER "Lithium-Ionen" für Akkus</td></tr>
</tbody>
</table>

<h3>Sicherheitshinweise</h3>
<p>⚠️ Beachten Sie stets die Bedienungsanleitung des Herstellers.  
Tragen Sie bei der Nutzung geeignete Schutzkleidung und halten Sie das Werkzeug von Kindern fern.</p>

<h3>Lieferumfang</h3>
<p>LIEFERUMFANG AUS DATEN</p>

<p>PRODUKTNAME steht für Qualität, Zuverlässigkeit und Langlebigkeit – ideal für den täglichen Einsatz.</p>
</li>
</ul>

WICHTIGE REGELN:
1. Verwende NUR die Daten aus den Produktdaten
2. Ersetze PRODUKTNAME durch den echten Produktnamen
3. Ersetze Feature 1-5 durch echte Produktfeatures
4. Ersetze WERT AUS DATEN durch echte technische Werte
5. Ersetze LIEFERUMFANG AUS DATEN durch echte Lieferumfang-Angaben
6. Überschriften OHNE Icons (nur Text)
7. Icons ✅ nur in den <p> Elementen
8. Abmessungen Format: "L×B×H mm" (z.B. "57×20×69 mm") - NICHT "572069 mm"
9. Gewicht immer in Gramm (g)
10. Verwende IMMER die Werte aus technicalSpecs.size für Abmessungen, NICHT aus bullets
11. Gib NUR den HTML-Code zurück, ohne \`\`\`html`;

    // Bereinige Bulletpoints - entferne technische Daten, die bereits in technicalSpecs stehen
    if (normalizedData.bullets) {
      normalizedData.bullets = normalizedData.bullets.filter((bullet: string) => {
        const bulletLower = bullet.toLowerCase();
        // Entferne Bulletpoints mit technischen Daten, die bereits in technicalSpecs stehen
        return !bulletLower.includes('abmessungen:') && 
               !bulletLower.includes('gewicht:') && 
               !bulletLower.includes('spannung:') && 
               !bulletLower.includes('kapazität:') &&
               !bulletLower.includes('entladestrom:') &&
               !bulletLower.includes('nominalspannung:') &&
               !bulletLower.includes('nominalkapazität:') &&
               !bulletLower.includes('max. entladestrom:') &&
               !bulletLower.includes('zulassungen:');
      });
      console.log('Bereinigte Bulletpoints:', normalizedData.bullets);
    }

    // Formatiere Abmessungen korrekt vor der AI-Verarbeitung
    if (normalizedData.size && normalizedData.size.includes('×')) {
      // Abmessungen sind bereits korrekt formatiert
      console.log('Abmessungen bereits korrekt formatiert:', normalizedData.size);
    } else if (normalizedData.size && normalizedData.size.match(/^\d+mm$/)) {
      // Konvertiere "572069mm" zu "57×20×69 mm"
      const numbers = normalizedData.size.match(/\d+/g);
      if (numbers && numbers[0].length >= 6) {
        const numStr = numbers[0];
        const dim1 = numStr.substring(0, 2);
        const dim2 = numStr.substring(2, 4);
        const dim3 = numStr.substring(4, 6);
        normalizedData.size = `${dim1}×${dim2}×${dim3} mm`;
        console.log('Abmessungen korrigiert:', normalizedData.size);
      }
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(normalizedData, null, 2) }
      ],
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content?.trim() || '';
    
  } catch (error) {
    console.error('GenerateAkkushopDescription error:', error);
    throw error;
  }
}

// ===== KOMPLETTER WORKFLOW MIT FORTSCHRITT =====
export async function processProductWithNewWorkflow(htmlOrText: string, onProgress?: (step: number, message: string) => void): Promise<string> {
  try {
    console.log('=== NEUER WORKFLOW GESTARTET ===');
    
    // Schritt 1: Daten extrahieren
    console.log('Schritt 1: ExtractProductData...');
    onProgress?.(33, 'Daten werden extrahiert...');
    const extractedData = await extractProductData(htmlOrText);
    console.log('Extrahierte Daten:', extractedData);
    
    // Schritt 2: Daten normalisieren
    console.log('Schritt 2: NormalizeProductData...');
    onProgress?.(66, 'Daten werden strukturiert...');
    const normalizedData = normalizeProductData(extractedData);
    console.log('Normalisierte Daten:', normalizedData);
    
    // Schritt 3: HTML generieren mit einfacher Template-Funktion
    console.log('Schritt 3: GenerateAkkushopDescription...');
    onProgress?.(90, 'Produktbeschreibung wird generiert...');
    
    // Verwende die einfache Template-Funktion statt der komplexen AI-Funktion
    const productName = normalizedData.product_name || 'Unbekanntes Produkt';
    const description = normalizedData.short_intro || 'Hochwertiges Produkt für professionelle Anwendungen.';
    
    // Extrahiere Features
    const features = [
      normalizedData.feature_1 || 'Hochwertige Verarbeitung',
      normalizedData.feature_2 || 'Zuverlässige Leistung', 
      normalizedData.feature_3 || 'Benutzerfreundliches Design',
      normalizedData.feature_4 || 'Langlebige Qualität',
      normalizedData.feature_5 || 'Optimales Preis-Leistungs-Verhältnis'
    ];
    
    // Konvertiere Gewicht zu Gramm
    const convertWeightToGrams = (weightStr: string): string => {
      if (!weightStr || weightStr === 'Nicht angegeben') return 'Nicht angegeben';
      
      const weight = parseFloat(weightStr.replace(/[^\d.,]/g, '').replace(',', '.'));
      if (isNaN(weight)) return weightStr;
      
      if (weightStr.toLowerCase().includes('kg')) {
        return `${Math.round(weight * 1000)} g`;
      } else if (weightStr.toLowerCase().includes('g')) {
        return `${Math.round(weight)} g`;
      } else {
        // Annahme: wenn keine Einheit, dann Gramm
        return `${Math.round(weight)} g`;
      }
    };
    
    // Konvertiere Abmessungen zu mm
    const convertDimensionsToMm = (dimStr: string): string => {
      if (!dimStr || dimStr === 'Nicht angegeben') return 'Nicht angegeben';
      
      // Wenn bereits mm enthalten, zurückgeben
      if (dimStr.toLowerCase().includes('mm')) return dimStr;
      
      // Wenn cm enthalten, zu mm konvertieren
      if (dimStr.toLowerCase().includes('cm')) {
        const numbers = dimStr.match(/[\d.,]+/g);
        if (numbers) {
          const converted = numbers.map(num => {
            const val = parseFloat(num.replace(',', '.'));
            return isNaN(val) ? num : Math.round(val * 10);
          });
          // Ersetze Zahlen und entferne "cm", füge "mm" hinzu
          return dimStr.replace(/[\d.,]+/g, (match, index) => converted[index]).replace(/cm/gi, '') + ' mm';
        }
      }
      
      return dimStr;
    };
    
    // Technische Daten mit Konvertierung - prüfe alle möglichen Feldnamen
    const rawWeight = normalizedData.gewicht || normalizedData.weight || normalizedData.produktgewicht || 'Nicht angegeben';
    const rawDimensions = normalizedData.abmessungen || normalizedData.size || normalizedData.dimensions || 'Nicht angegeben';
    
    const power = normalizedData.leistung || normalizedData.power || 'Nicht angegeben';
    const voltage = normalizedData.spannung || normalizedData.voltage || 'Nicht angegeben';
    const weight = convertWeightToGrams(rawWeight);
    const dimensions = convertDimensionsToMm(rawDimensions);
    const material = normalizedData.material || 'Nicht angegeben';
    const packageContents = normalizedData.package_contents || 'Produkt wie beschrieben';
    
    const htmlDescription = `<ul>
<li>
<h2>${productName}</h2>
<p>${description}<br /><br />
✅ ${features[0]}<br />
✅ ${features[1]}<br />
✅ ${features[2]}<br />
✅ ${features[3]}<br />
✅ ${features[4]}</p>

<h3>Produkteigenschaften & Highlights</h3>
<p>
✅ Robustes Gehäuse und langlebige Verarbeitung<br />
✅ Ergonomisches Design für komfortables Arbeiten<br />
✅ Hohe Leistung bei geringem Energieverbrauch<br />
✅ Vielseitig einsetzbar in Werkstatt und Haushalt<br />
✅ Optimales Preis-Leistungs-Verhältnis
</p>

<h4>Technische Daten:</h4>
<table border="0" summary="">
<tbody>
<tr><td>Leistung:</td><td>${power}</td></tr>
<tr><td>Spannung:</td><td>${voltage}</td></tr>
<tr><td>Gewicht:</td><td>${weight}</td></tr>
<tr><td>Abmessungen:</td><td>${dimensions}</td></tr>
<tr><td>Material:</td><td>${material}</td></tr>
</tbody>
</table>

<h3>Sicherheitshinweise</h3>
<p>${safetyNotes}</p>

<p>${productName} steht für Qualität, Zuverlässigkeit und Langlebigkeit – ideal für den täglichen Einsatz.</p>

<h3>Lieferumfang</h3>
<p>${packageContents}</p>
</li>
</ul>`;
    
    console.log('Generierte HTML-Länge:', htmlDescription.length);
    
    onProgress?.(100, 'Fertig!');
    console.log('=== WORKFLOW ABGESCHLOSSEN ===');
    return htmlDescription;
    
  } catch (error) {
    console.error('Workflow-Fehler:', error);
    onProgress?.(0, 'Fehler aufgetreten');
    throw error;
  }
}

