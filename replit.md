# PIMPilot - Produktmanagement SaaS

## Recent Changes

### 2025-11-03: Brickfox CSV Export - Separate Bild-Spalten
**Änderung**: Brickfox CSV Export erstellt jetzt separate Spalten für jede Bild-URL (p_image[1] bis p_image[10]).

**Neue Features**:
- ✅ 10 separate Bild-Spalten: `p_image[1]`, `p_image[2]`, ..., `p_image[10]`
- ✅ Automatische Extraktion aus `localImagePaths` (heruntergeladene Bilder)
- ✅ Fallback auf `images` Array aus Produktdaten
- ✅ Produktbeschreibung (`p_description[de]`) nutzt jetzt `autoExtractedDescription` wenn `htmlCode` leer ist

**Betroffene Dateien**: 
- `shared/brickfox-schema.ts` - 10 neue p_image Felder im Schema + Default-Mapping
- `server/services/brickfox-mapper.ts` - Logik für Bild-Extraktion aus Produktdaten

### 2025-11-03: Selektoren neu strukturiert für Händler-Shops
**Änderung**: Komplette Neustrukturierung der CSS-Selektoren für bessere Datenerfassung im eingeloggten Zustand.

**Neue Selektor-Struktur** (nach Gruppen organisiert):
- **Basis-Daten**: Produktname, Artikelnummer, EAN, Hersteller
- **Preise**: Händler-EK-Preis (Netto), Händler-EK-Preis (Brutto), UVP/Empf. VK-Preis
- **Medien**: Produktbilder
- **Beschreibungen**: Kurzbeschreibung, Ausführliche Beschreibung
- **Technische Daten**: Gewicht, Abmessungen, Kategorie

**Wichtige Verbesserungen**:
- ✅ Spezielle Felder für Händlerpreise (Netto/Brutto)
- ✅ UVP/RRP-Feld für empfohlenen Verkaufspreis
- ✅ Gruppierung nach Kategorien für bessere Übersicht
- ✅ Verbesserte Platzhalter mit Beispiel-Selektoren
- ✅ Login-Felder mit klarer Beschriftung (CSS-Selektor vs. Login-Daten)

**Betroffene Dateien**: 
- `client/src/components/supplier-selectors-tab.tsx` - Neue Selektor-Struktur mit Gruppierung
- `server/scraper-service.ts` - Backend-Support für neue Felder (priceGross, rrp, longDescription, dimensions)

## Overview
PIMPilot is a multi-tenant B2B SaaS platform designed to automate AI-powered product description and PIM metadata generation from supplier data. It processes product data via CSV uploads for multiple business customers, ensuring strict data isolation. The platform leverages OpenAI's GPT-4o-mini for text generation and a custom Cheerio-based web scraper. Its core capabilities include a robust multi-tenant architecture, secure authentication, Stripe-based subscription management, real-time API call monitoring, dynamic AI prompting, and a sophisticated category-based template system. The project aims to streamline product information management and enhance e-commerce content creation with a business vision to automate product content creation for e-commerce.

## User Preferences
No specific preferences documented.

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18, TypeScript, Vite, shadcn/ui, Radix UI, and Tailwind CSS for a modern and responsive user experience. Standardized `Table`-components ensure consistent design and functionality across the platform, including features like sticky headers and hover effects. The pricing page features a modern, two-column layout with gradient designs and consistent button heights.

### Technical Implementations
- **Frontend**: React 18, TypeScript, Vite, shadcn/ui, Radix UI, Tailwind CSS
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL (Helium Dev / Supabase Production) with Drizzle ORM
- **AI/ML**: OpenAI API (GPT-4o-mini for text generation, GPT-4o-mini Vision for image analysis)
- **Web Scraping**: Cheerio (Custom scraper service)
- **Authentication**: Supabase Auth (JWT-based)

### Feature Specifications
- **Multi-Tenant Architecture**: Ensures data isolation, dynamic tenant creation, and robust slug generation.
- **User Authentication**: Supabase Auth with session management.
- **Subscription Management**: Stripe integration for tiered access and trials, with default features for new customers (URL Web-Scraper, CSV Mass Import, AI Product Descriptions).
- **Usage Tracking**: Real-time API call monitoring with limit enforcement.
- **CSV Bulk Processing**: Upload and process product data for mass AI generation, with standardized column selection for PIM mapping and full image URL export.
- **URL Web Scraper**: Custom Cheerio-based scraper with configurable CSS selectors, intelligent auto-recognition, table parsing, multi-URL scraping, automatic login, session cookie capture, automatic image download, and Magento-specific JSON gallery parsing.
- **AI Generation**: Automated product descriptions using OpenAI GPT-4o-mini, including AI-powered image analysis for color detection and dynamic product type extraction.
- **Project Management**: Organize generated products into projects.
- **Supplier Profiles**: Manage multiple suppliers with saved selectors.
- **ERP Integration (e.g., Pixi)**: Automated product comparison for identifying new vs. existing products, intelligent matching, and CSV export.
- **CSS Selector Verification System**: Workflow for testing and verifying supplier-specific CSS selectors with visual feedback.
- **Field Mapping Tool**: Visual "Click-to-Connect" interface for mapping scraped data or CSV columns to export fields, supporting custom transformations and reusable presets.
- **Admin Dashboard**: Professional dashboard with real-time KPIs (e.g., products in system, data completeness, active suppliers, AI texts generated) and tenant management capabilities (subscription status, customer deletion, feature flags). Includes a checkbox-based bulk delete for customers.
- **PDF Parser**: Improved PDF parser for accurate extraction of purchase and selling prices.
- **Image Handling**: Static file server for local product images, automatic image download during scraping, and an interactive image gallery for scraped products.
- **Contact Form**: Professional contact form with direct email sending to admin.

### System Design
The application employs a modular subprompt architecture for specialized AI tasks, centrally orchestrated. A 3-layer category-based template system (Category Configuration, AI Generator, Template Renderer) facilitates automatic category recognition and dynamic AI prompt adaptation. Multi-tenancy is enforced server-side using `organization_id` foreign keys to ensure data isolation.

## External Dependencies
- **OpenAI API**: For AI-driven text generation (GPT-4o-mini) and image analysis (GPT-4o-mini Vision).
- **Supabase**: Provides PostgreSQL database, multi-tenancy support, and authentication services.
- **Stripe**: Integrated for subscription management and payment processing.
- **Pixi ERP API**: Used for product inventory comparison and duplicate detection.
- **Greyhound SMTP**: E-mail sending for automated supplier requests via nodemailer.