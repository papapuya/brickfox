# PIMPilot - Produktmanagement SaaS

## Overview
PIMPilot is a production-ready multi-tenant B2B SaaS platform designed to automate the generation of AI-powered product descriptions and PIM metadata from supplier data. It efficiently processes product data, primarily via CSV uploads, for multiple business customers using a single application instance with complete data isolation. The platform leverages OpenAI GPT-4o-mini for intelligent text generation and a custom Cheerio-based web scraper.

**Key Capabilities:**
- Multi-Tenant Architecture with organization-based data isolation.
- Secure user authentication and Stripe-based subscription management with a trial mode.
- Real-time API call monitoring and usage tracking with tier-based limits.
- Dynamic AI prompting and a modular subprompt architecture.
- Category-based template system for structured product description output.

## User Preferences
Keine spezifischen Präferenzen dokumentiert.

## Recent Changes

### 2025-11-02: VK-Preisberechnung & EK-Preis aus PDF
**Feature**: Korrektur der VK-Preisberechnung und Sicherstellung, dass EK-Preis immer aus PDF gelesen wird.

**Problem**: VK-Berechnung in `brickfox-mapper.ts` verwendete `Math.round()` statt `Math.floor()` + 0.95.

**Lösung**:
- **VK-Berechnung korrigiert**: `VK = floor(EK × 2 × 1.19) + 0.95` (ANSMANN-Standard)
- **EK-Preis Priorität**: PDF-EK-Preis überschreibt IMMER gescrapte Preise
- **Konsistente Formel**: Alle Module verwenden jetzt die gleiche VK-Berechnungsformel

**Betroffene Dateien**:
- `server/services/brickfox-mapper.ts` - VK-Berechnung korrigiert
- `server/scraper-service.ts` - VK-Berechnung bereits korrekt
- `client/src/pages/url-scraper.tsx` - EK aus PDF + VK-Berechnung bereits korrekt

**Beispiel**: EK 38,49€ → VK = floor(38,49 × 2 × 1.19) + 0.95 = floor(91,6062) + 0.95 = **91,95€**

### 2025-11-02: PDF Parser - Produkte MIT/OHNE URL Trennung
**Feature**: Tab-basierte UI zur Trennung von Produkten mit scrapbaren URLs vs. Metadaten ohne URL.

**Problem**: PDF-Parser hat sowohl Produkte mit URLs (sofort verarbeitbar) als auch Produkte ohne URLs (nur Metadaten) extrahiert, aber beide in einer Liste gemischt dargestellt.

**Lösung**:
- **Backend**: `PDFParseResult` erweitert um `withURL[]` und `withoutURL[]` Arrays
- **Frontend**: Tab-System mit zwei separaten Ansichten
  - Tab "Mit URL": Produkte die direkt per Auto-Scraper verarbeitet werden können
  - Tab "Ohne URL": Produkte ohne URL + Hinweis zur Lieferanten-Kontaktierung
- **Badge-System**: Zeigt Anzahl pro Kategorie in Tab-Headern
- **Call-to-Action**: "URLs anfragen" Button für manuelle Nachfrage beim Lieferanten (geplant: E-Mail-Automation)

**Betroffene Dateien**:
- `client/src/pages/pdf-auto-scraper.tsx` - Tab-UI, Badge-System, separierte Tabellen
- `server/services/pdf-parser.ts` - Rückgabe von zwei separaten Produktlisten

**Nächster Schritt**: E-Mail-Integration (Resend/SendGrid) für automatisierte Lieferanten-Anfragen bei Produkten ohne URL.

### 2025-11-02: AI-Bildanalyse für automatische Farbextraktion
**Feature**: OpenAI Vision API Integration zur automatischen Erkennung der Produktfarbe aus Bildern.

**Problem**: ANSMANN-Produktseiten enthalten oft falsche Textdaten für Farben (z.B. "blau" im Text, aber schwarzer Akkupack im Bild).

**Lösung**:
- **OpenAI Vision API** analysiert automatisch das erste Produktbild
- Erkennt dominante Farbe (schwarz, gelb, rot, blau, grün, weiß, grau, orange, silber)
- Überschreibt fehlerhafte Textdaten mit AI-erkannter Farbe
- Flag `colorDetectedByAI` für Frontend-Anzeige

**Technische Details**:
- Neue Funktion: `analyzeProductImageColor()` in `server/ai-service.ts`
- Integration in beide Scraper-Routen (`/api/scrape`, `/api/scrape-product`)
- GPT-4o-mini Vision mit 'low' detail für schnelle/günstige Analyse
- Validierung: Nur erlaubte Farben werden akzeptiert

### 2025-11-02: SEO-Optimierung für akkushop.de
**Feature**: Komplette Überarbeitung der AI-Prompts für akkushop.de-konforme SEO und Produktbeschreibungen.

**SEO Title (Meta Title)**:
- Format: `Akkupack 2s2p 5200mah kaufen | Akkushop`
- Zielbereich: 45-55 Zeichen (380-480 Pixel)
- Produktfokus statt Markenfokus
- Conversion-Keyword "kaufen"

**SEO Description (Meta Description)**:
- Format: `Hochwertiger Akkupack 2s2p 5200mah ✓Qualitätsprodukte ✓Versandkostenfrei ab 39,95€ ✓Kundenservice ✆071517071010`
- Zielbereich: 120-140 Zeichen (750-880 Pixel)
- Feste Service-USPs für konsistente Markenbotschaft
- Telefonnummer mit grünem ☎ Symbol

**HTML-Produktbeschreibung**:
- KEINE langen Beschreibungen mehr - nur kurze, prägnante USPs
- 3 produktspezifische USPs (aus technischen Specs)
- 2 feste Service-USPs: `✓Versandkostenfrei ab 39,95€ ✓Kundenservice ☎071517071010`
- Grünes Telefon-Symbol via `<span style="color: green;">☎</span>`

**SERP Preview Qualitätsindikatoren**:
- Grüne Balken: Title 380-580px, Description 750-1000px
- Gelbe Balken: Title 320-380px oder 580-620px, Description 600-750px oder 1000-1100px
- Rote Balken: außerhalb der optimalen Bereiche

**Betroffene Dateien**:
- `server/ai-service.ts` - SEO-Prompts und Produktbeschreibungs-Prompts
- `client/src/pages/url-scraper.tsx` - SERP Preview Schwellenwerte

### 2025-11-01: ANSMANN Supplier Integration - 10 Technical Specification Selectors
**Feature**: Hinzufügung von 10 lieferantenspezifischen CSS-Selektoren für ANSMANN-Produkte.

**Neue ANSMANN-Selektoren**:
- Nominalspannung (V) → `td.col.data[data-th="Nominal-Spannung"]`
- Nominalkapazität (mAh) → `td.col.data[data-th="Nominal-Kapazität"]`
- max. Entladestrom (A) → `td.col.data[data-th="max. Entladestrom"]`
- Länge (mm) → `td.col.data[data-th="Länge"]`
- Breite (mm) → `td.col.data[data-th="Breite"]`
- Höhe (mm) → `td.col.data[data-th="Höhe"]`
- Gewicht (g) → `td.col.data[data-th="Produktgewicht"]`
- Zellenchemie → `td.col.data[data-th="Zellenchemie"]`
- Energie (Wh) → `td.col.data[data-th="Energie"]`
- Farbe → `td.col.data[data-th="Farbe"]`

**Frontend-Änderungen**:
- `ScrapedProduct` Interface um 10 technische Felder erweitert
- Selector State Variable mit ANSMANN-Selektoren initialisiert
- Tabellen-Header und -Zellen angepasst (Nitecore-Spalten entfernt, ANSMANN-Spalten hinzugefügt)

**Critical Fix - Race Condition in Supplier Selector Loading**:
- **Problem**: Beim PDF-Auto-Scraper wurden Selektoren aus React State gelesen, der asynchron aktualisiert wird → leere Felder beim Scraping
- **Lösung**: Selektoren werden jetzt **direkt** vom Supplier-Objekt gelesen statt aus State
- **Betroffene Datei**: `client/src/pages/url-scraper.tsx` - `handleScrapeFromPDF()` Funktion

**Supplier-Konfiguration**:
- ANSMANN Supplier-Profil in Datenbank mit allen technischen Selektoren aktualisiert
- Automatische Übernahme der Selektoren beim PDF-Auto-Scraper Workflow

### 2025-11-01: Performance-Optimierung - Debug-Modus für Logging
**Problem**: Übermäßiges Console-Logging (besonders im Brickfox-Mapper und AI-Service) verlangsamte die Entwicklungsumgebung.

**Lösung**: 
- Environment Variable `DEBUG_MODE` hinzugefügt (Standard: `false`)
- Debug-Logging-Funktionen in kritischen Services implementiert
- Massive Datenausgaben (extractedData, customAttributes, etc.) werden nur noch bei aktiviertem Debug-Modus geloggt
- Normale Logs zeigen nur wichtige Status-Updates und Fehler

**Debug-Modus aktivieren**:
```bash
# In Development Environment
DEBUG_MODE=true
```

**Betroffene Dateien**:
- `server/services/brickfox-mapper.ts` - Reduzierung von 3x Logging pro Feld auf 1x Debug-Log
- `server/ai-service.ts` - Komplette Datenausgaben nur im Debug-Modus

## System Architecture

### Technology Stack
- **Frontend**: React 18, TypeScript, Vite, shadcn/ui, Radix UI, Tailwind CSS
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL (Helium Dev / Supabase Production) with Drizzle ORM
- **AI/ML**: OpenAI API (GPT-4o-mini for text generation, GPT-4o-mini Vision for image analysis)
- **Web Scraping**: Cheerio (Custom scraper service)
- **Authentication**: Supabase Auth (JWT-based)

### System Design
The application employs a **modular subprompt architecture** for specialized AI tasks (e.g., USP generation, technical data extraction) orchestrated by a central component. A **category-based template system** uses a 3-layer approach: Category Configuration, AI Generator, and Template Renderer. This system supports automatic category recognition and dynamic AI prompt adaptation.

**Multi-Tenancy**: Achieved through server-side enforcement using `organization_id` foreign keys, ensuring data isolation and preventing cross-tenant access.

**Core Features**:
- **Multi-Tenant Architecture**: Data isolation via `organization_id` foreign keys.
- **User Authentication**: Supabase Auth integration with "Remember Me" functionality. Sessions are stored in localStorage (persistent) or sessionStorage (ephemeral) based on user preference. DynamicStorage adapter ensures no token resurrection across storage types.
- **Subscription Management**: Stripe integration for tiered access and trial mode.
- **Usage Tracking**: Real-time API call monitoring with limit enforcement.
- **CSV Bulk Processing**: Upload and process product data via CSV for mass AI generation.
- **URL Web Scraper**: Custom Cheerio-based scraper with configurable CSS selectors, intelligent auto-recognition, and a tables parser. Supports multi-URL scraping, automatic login with encrypted credentials, and session cookie capture.
- **AI Generation**: Automated product descriptions using OpenAI GPT-4o-mini, with dynamic, product-specific prompts. AI-powered image analysis for automatic color detection from product images.
- **Project Management**: Save and organize generated products into projects.
- **Supplier Profiles**: Manage multiple suppliers with saved selectors.
- **Pixi ERP Integration**: Automated product comparison with Pixi ERP system to identify new vs. existing products, with CSV upload, intelligent matching, and CSV export functionality.
- **CSS Selector Verification System**: Comprehensive workflow for testing and verifying supplier-specific CSS selectors with visual feedback and persistence.
- **Field Mapping Tool**: Visual Click-to-Connect interface for mapping scraped data fields (URL Scraper) or CSV columns to Brickfox CSV export fields. Supports automatic field detection, custom transformations, and reusable mapping presets. Includes tenant-isolated storage and API endpoints for CRUD operations.

## External Dependencies
- **OpenAI API**: Used for AI-driven text generation (GPT-4o-mini).
- **Supabase**: Used for PostgreSQL database, UUID primary keys, organization-based multi-tenancy, and authentication.
- **Stripe**: Integrated for subscription management and payment processing.
- **Pixi ERP API**: External integration for product inventory comparison and duplicate detection.