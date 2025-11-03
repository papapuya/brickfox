# PIMPilot - Produktmanagement SaaS

## Overview
PIMPilot is a multi-tenant B2B SaaS platform designed to automate AI-powered product description and PIM metadata generation from supplier data. It processes product data via CSV uploads for multiple business customers, ensuring strict data isolation. The platform leverages OpenAI's GPT-4o-mini for text generation and a custom Cheerio-based web scraper. Its core capabilities include a robust multi-tenant architecture, secure authentication, Stripe-based subscription management, real-time API call monitoring, dynamic AI prompting, and a sophisticated category-based template system. The project aims to streamline product information management and enhance e-commerce content creation with a business vision to automate product content creation for e-commerce.

## User Preferences
Keine spezifischen Präferenzen dokumentiert.

## Demo-Modus & Tenant-Verwaltung

### Demo-Kunden erkennen
Demo-Kunden (Trial-Accounts) werden im Admin-Dashboard durch:
- **Abo-Status Badge**: Blauer "Trial" Badge mit Krone-Icon
- **Default Features**: Alle neuen Kunden starten standardmäßig mit Trial-Status

### Standard-Features für neue Kunden
Jeder neu registrierte Kunde erhält automatisch diese Features:
- ✅ **URL Web-Scraper** (urlScraper: true)
- ✅ **CSV Massenimport** (csvBulkImport: true)
- ✅ **KI-Produktbeschreibungen** (aiDescriptions: true)
- ❌ **Pixi ERP Integration** (pixiIntegration: false)
- ❌ **SAP Integration** (sapIntegration: false)

Premium-Features (Pixi, SAP) können über das Admin-Dashboard pro Kunde individuell freigeschaltet werden.

### Admin-Dashboard Features (seit 2025-11-03)
- **Abo-Status Anzeige**: Farbcodierte Badges zeigen Subscription-Status (Trial, Professional, Enterprise)
- **Kunden Löschen**: Rote Trash-Button mit Bestätigungs-Dialog
  - Warnung vor unwiderruflicher Löschung aller Daten
  - Übersicht: Anzahl User, Projekte, Lieferanten
- **Bulk-Delete**: Roter "Alle Kunden löschen" Button für schnelles Cleanup
  - Löscht alle Test-Kunden (außer Super-Admin Account)
  - Bestätigungs-Dialog mit Anzahl der zu löschenden Kunden
  - Perfekt für Entwicklung und Testing
- **Feature-Flags**: Individuelle Feature-Freischaltung pro Kunde
- **KPI-Übersicht**: System-weite Metriken und Statistiken

## System Architecture

### UI/UX Decisions
The frontend utilizes React 18, TypeScript, Vite, shadcn/ui, Radix UI, and Tailwind CSS for a modern and responsive user experience. Standardized `Table`-components ensure consistent design and functionality across the platform, including features like sticky headers and hover effects.

### Technical Implementations
- **Frontend**: React 18, TypeScript, Vite, shadcn/ui, Radix UI, Tailwind CSS
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL (Helium Dev / Supabase Production) with Drizzle ORM
- **AI/ML**: OpenAI API (GPT-4o-mini for text generation, GPT-4o-mini Vision for image analysis)
- **Web Scraping**: Cheerio (Custom scraper service)
- **Authentication**: Supabase Auth (JWT-based)

### Feature Specifications
- **Multi-Tenant Architecture**: Ensures data isolation per organization, including dynamic tenant creation and robust slug generation during registration.
- **User Authentication**: Supabase Auth with session management.
- **Subscription Management**: Stripe integration for tiered access and trials.
- **Usage Tracking**: Real-time API call monitoring with limit enforcement.
- **CSV Bulk Processing**: Upload and process product data for mass AI generation, with column selection for export.
- **URL Web Scraper**: Custom Cheerio-based scraper with configurable CSS selectors, intelligent auto-recognition, table parsing, multi-URL scraping, automatic login, session cookie capture, automatic image download, and Magento-specific JSON gallery parsing.
- **AI Generation**: Automated product descriptions using OpenAI GPT-4o-mini, including AI-powered image analysis for color detection and dynamic product type extraction for specific formatting (e.g., MediaMarkt V1).
- **Project Management**: Organize generated products into projects.
- **Supplier Profiles**: Manage multiple suppliers with saved selectors.
- **Pixi ERP Integration**: Automated product comparison with Pixi ERP for identifying new vs. existing products, with intelligent matching and CSV export.
- **CSS Selector Verification System**: Workflow for testing and verifying supplier-specific CSS selectors with visual feedback.
- **Field Mapping Tool**: Visual Click-to-Connect interface for mapping scraped data or CSV columns to Brickfox CSV export fields, supporting custom transformations and reusable presets.
- **Admin Dashboard**: Professional dashboard with real-time KPIs and system overview.
- **Pricing Page**: Modern, two-column pricing page with detailed feature breakdowns for different tiers.
- **PDF Parser**: Improved PDF parser for accurate extraction of Netto EK (purchase price) and correct VK (selling price) calculation.
- **Image Handling**: Static file server for local product images, automatic image download during scraping, and an interactive image gallery for scraped products.

### System Design
The application employs a modular subprompt architecture for specialized AI tasks, centrally orchestrated. A 3-layer category-based template system (Category Configuration, AI Generator, Template Renderer) facilitates automatic category recognition and dynamic AI prompt adaptation. Multi-tenancy is enforced server-side using `organization_id` foreign keys to ensure data isolation.

## External Dependencies
- **OpenAI API**: For AI-driven text generation (GPT-4o-mini) and image analysis (GPT-4o-mini Vision).
- **Supabase**: Provides PostgreSQL database, multi-tenancy support, and authentication services.
- **Stripe**: Integrated for subscription management and payment processing.
- **Pixi ERP API**: Used for product inventory comparison and duplicate detection.
- **Greyhound SMTP**: E-mail sending for automated supplier requests via nodemailer.

## Recent Changes

### 2025-11-02: Production-Build Fix für Mobile Safari 📱
**Fix**: Production-Build erfolgreich konfiguriert für iOS/Safari-Kompatibilität.

**Änderungen**:
- **Build-Script**: `NODE_ENV=production` für korrekten Plugin-Loading
- **Server-Config**: Host auf `0.0.0.0` für Replit Deployments
- **Vite-Config**: `base: '/'` und Preview-Server für Production
- **Build-Output**: `dist/public/` mit allen Assets (1 MB, gzip: 283 KB)

**Betroffene Dateien**:
- `package.json` - Build-Script mit `cross-env NODE_ENV=production`
- `server/index.ts` - Host auf `0.0.0.0` für alle Environments
- `vite.config.ts` - `base` und `preview` Config hinzugefügt

**Build-Ergebnis**:
✓ Build erfolgreich in 21.25s
✓ Assets: 116 KB CSS, 1 MB JS (gzip: 283 KB)
✓ Bereit für Deployment auf Replit Autoscale

### 2025-11-02: Kontaktformular mit E-Mail-Versand 📧
**Feature**: Professionelles Kontaktformular mit direktem E-Mail-Versand an Admin.

**Implementierung**:
- **Kontakt-Seite**: `/contact` mit Formular (Name, Firma, E-Mail, Telefon, Nachricht)
- **Backend-Endpoint**: `/api/contact` sendet E-Mails via SMTP (Greyhound)
- **Success-Screen**: Bestätigungsseite nach erfolgreichem Versand
- **Navigation**: Link in Landing-Page Header zu Kontaktformular

**Design-Highlights**:
- Zweispaltiges Layout: Formular links, Info-Karten rechts
- Gradient-Button (Blue→Purple→Pink) für "Nachricht senden"
- Info-Karte mit Demo-Anfordern Button
- Zurück-Button oben links

**Betroffene Dateien**:
- `client/src/pages/contact.tsx` - Neue Kontakt-Seite mit Formular
- `client/src/App.tsx` - Route `/contact` hinzugefügt
- `client/src/pages/landing.tsx` - Link zu Kontakt-Seite
- `server/routes-supabase.ts` - `/api/contact` Endpoint mit E-Mail-Versand

### 2025-11-02: Pricing-Seite – Allgemeine Features ohne Vendor-Lock-In 🎯
**Änderung**: Features auf Pricing-Seite allgemeiner formuliert für breitere Anwendbarkeit.

**Was wurde geändert:**
- ❌ "Brickfox CSV-Export" → ✅ "CSV-Export mit Field-Mapping – Flexibles Export-System"
- ❌ "Pixi ERP-Integration" → ✅ "ERP-Integration – Duplikat-Erkennung & Abgleich"
- ➕ Zurück-Button oben links mit Pfeil-Icon
- ✅ Buttons auf gleicher Höhe durch Flexbox-Layout

**Begründung**: Spezifische Vendor-Namen (Brickfox, Pixi) schränken die wahrgenommene Flexibilität der Plattform ein. Allgemeine Formulierungen zeigen, dass PIMPilot mit verschiedenen Systemen funktioniert.

### 2025-11-02: Admin-Dashboard mit KPIs und Systemübersicht 📊
**Feature**: Professionelles Admin-Dashboard mit Echtzeit-KPIs und Detailübersicht.

**Implementierung**:
- **5 Hauptmetriken (KPI-Header)**:
  - 🧾 Produkte im System (mandantenübergreifend)
  - ✅ Datenvollständigkeit (% der Produkte mit Pflichtfeldern)
  - 📦 Lieferanten aktiv (Gesamt, erfolgreich, Fehler)
  - ⚙️ Letzter Pixi-Sync (Zeitstempel)
  - 🤖 KI-Texte heute generiert
- **Backend-Endpoint**: `/api/admin/kpis` mit Echtzeit-Datenabfrage
- **Mandanten-Übersicht**: Tabelle mit allen Kunden, User-Anzahl, Projekte, Lieferanten
- **Feature-Flags**: Individuelle Feature-Freischaltung pro Kunde (Pixi, SAP, Scraper, CSV, AI)

**Design-Highlights**:
- 5 KPI-Cards mit farbigen Icons (Blau, Grün, Orange, Lila, Indigo)
- Hover-Effekte und Shadow-Transitions für professionellen Look
- Status-Indikatoren für Lieferanten (OK/Fehler mit Icons)
- Responsive Grid-Layout für KPIs (5 Spalten auf Desktop)

**Betroffene Dateien**:
- `client/src/pages/admin-dashboard.tsx` - Komplett neu gestaltet mit KPIs
- `server/routes-supabase.ts` - `/api/admin/kpis` Endpoint hinzugefügt

### 2025-11-02: Moderne Pricing-Seite mit Gradient-Design 🎨
**Feature**: Professionelle 2-Spalten Pricing-Seite mit allgemeinen PIM-Features.

**Implementierung**:
- **2-Tarife-System**: Professional (für Start-Ups/KMUs) + Enterprise (für große Unternehmen)
- **Gradient-Buttons**: Blue→Purple→Pink Gradient, Buttons auf gleicher Höhe
- **Feature-Listen**: Allgemeine Features ohne spezifische Vendor-Lock-Ins
- **Call-to-Action**: "Demo anfordern" leitet zu Registrierung weiter

**Design-Highlights**:
- Zweispaltiges Grid-Layout mit Cards (Flexbox für einheitliche Button-Höhe)
- Enterprise-Tarif mit blauem Rahmen und Gradient-Hintergrund
- Farbcodierte Checkmarks (Professional: Blau, Enterprise: Lila)
- Responsive Design für Desktop und Mobile