# PIMPilot - Produktmanagement SaaS

## Recent Changes

### 2025-11-04: Automatisches Mapping-Modul für Brickfox-CSV-Export
**Änderung**: Neues Mapping-System für automatische Konvertierung von Produktdaten in Brickfox-Format!

**Neue Features:**

**1. mappingRules.json - Zentrale Mapping-Konfiguration**
- ✅ Automatisches Mapping von PDF-Scraper-Daten → Brickfox-CSV
- ✅ Prioritätslogik für mehrfache Mappings (z.B. HTML-Beschreibung > SEO-Text)
- ✅ Fixed Values: 11 Pflichtfelder automatisch hinzugefügt (Gefahrgut, Tax Class, Zolltarif, etc.)
- ✅ Auto-Generate: Kategoriepfad wird aus Spannung generiert (z.B. "Akkus ##||## 7.2 Volt")
- ✅ Validierung: Required-Fields, Datentypen, Ranges (z.B. Spannung 0-100V)
- ✅ Transformationen: Automatische Unit-Conversion (mm→cm, g→kg)

**2. Mapping-Schema**
- **Basis-Felder**: Artikelnummer → p_item_number + v_manufacturers_item_number
- **Hersteller**: Wird auf p_brand UND v_supplier[Eur] gemappt
- **Energie**: Energie (Wh) → p_attributes[energie_wh][de] (korrekt als Attribut)
- **Beschreibungen**: HTML-Beschreibung als Hauptfeld, SEO-Text als Fallback
- **Schutzschaltung**: Neues Mapping für Li-Ion-Schutzschaltung

**3. Verbesserungen gegenüber Original**
- ✅ Doppeltes Mapping aufgelöst: p_description[de] jetzt mit Prioritätslogik
- ✅ Fehlende Defaults ergänzt: v_status = "1", v_supplier aus Hersteller
- ✅ Energie_Wh korrigiert: Jetzt als Brickfox-Attribut p_attributes[energie_wh][de]
- ✅ SEO-Felder hinzugefügt: meta_title, keywords, p_short_description in Ausgabe

**Betroffene Dateien**:
- `mappingRules.json` - Zentrale Mapping-Konfiguration
- (Pending) `server/services/mapping-service.ts` - Mapping-Engine
- (Pending) `server/routes-supabase.ts` - API-Endpoint /api/mapping/apply

### 2025-11-04: Enterprise-Sicherheits-Features implementiert
**Änderung**: Umfassende Sicherheits-Upgrades für Enterprise-Readiness!

**Neue Features:**

**1. Automatisches Backup-System**
- ✅ DB-Tabellen: `backups`, `audit_logs`, `permissions`
- ✅ Backup-Service: Create, Restore, List, Delete Backups
- ✅ API-Endpoints: `/api/backups` (POST/GET/DELETE), `/api/backups/:id/restore`
- ✅ Point-in-Time Recovery für Geschäftsdaten (users, projects, products, suppliers, templates, permissions)
- ✅ Automatische Expiration (30 Tage default)
- ✅ Multi-Tenant Isolation
- ✅ Audit-Logging für alle Backup-Operationen

**2. Granulares RBAC-System mit Permissions**
- ✅ 5 Rollen: `admin`, `editor`, `viewer`, `project_manager`, `member`
- ✅ Permission-Service mit resource/action/scope-basiertem Zugriff
- ✅ Middleware: `requirePermission`, `requireAnyPermission`, `requireRole`
- ✅ Scopes: `all` (global), `own` (nur eigene Ressourcen), `team` (Tenant-weit), `none`
- ✅ Default-Permissions pro Rolle
- ✅ API-Endpoints: `/api/permissions` (POST/GET/DELETE), `/api/users/:userId/role` (PUT)
- ✅ Security: Ownership-Checks aus Datenbank (kein Client-Tampering)

**3. Audit-Log-System**
- ✅ Protokollierung aller CRUD-Operationen
- ✅ Tracking: User, Timestamp, Action, ResourceType, ResourceId, Changes, IP, UserAgent
- ✅ API: `/api/audit-logs` (GET, Super-Admin only)

**Rollen-Hierarchie:**
- **admin**: Full access (alle Ressourcen, inkl. Backups, Users)
- **editor**: Create/Update Products, Projects, Suppliers (scope: all)
- **viewer**: Read-only + Export (scope: all)
- **project_manager**: Create/Update/Delete eigene Projects/Products (scope: own)
- **member**: Create/Update eigene Ressourcen (scope: own)

**4. Field-Level Encryption für sensible Daten**
- ✅ AES-256-GCM Authenticated Encryption (verhindert Tampering)
- ✅ Verschlüsselte Felder: `loginPassword`, `sessionCookies`, API-Keys
- ✅ Automatic Encryption/Decryption bei CREATE/UPDATE/GET
- ✅ Null-Handling: Secrets können gelöscht werden
- ✅ Error-Handling: Tampering wird erkannt und geloggt
- ✅ ENCRYPTION_KEY aus Environment (32+ Zeichen)

**Betroffene Dateien**:
- `shared/schema.ts` - Neue Tabellen: backups, audit_logs, permissions
- `server/services/backup-service.ts` - Backup/Restore-Logik
- `server/services/permission-service.ts` - RBAC-Logik
- `server/middleware/permissions.ts` - Permission-Middleware
- `server/routes-supabase.ts` - API-Endpoints für Backups, Permissions, Audit-Logs
- `server/services/encryption-service.ts` - AES-256-GCM Encryption
- `server/supabase-storage.ts` - Automatische Encryption bei Supplier-CRUD
- `server/api-key-manager.ts` - Encrypted API-Key Storage

## Recent Changes

### 2025-11-03: PDF-Scraper → Pixi-Compare Direkt-Integration
**Änderung**: PDF-Scraper ist jetzt direkt mit dem Pixi-Vergleich verbunden - ohne CSV-Export/Import-Zwischenschritt!

**Neuer Workflow**:
1. PDF hochladen → Produkte extrahieren
2. Lieferant mit Pixi-Nummer auswählen (obligatorisch!)
3. Button "Mit Pixi vergleichen" → **Direkte Übergabe** an Pixi-System
4. Automatischer Vergleich mit Multi-Strategie Matching

**Technische Details**:
- ✅ **Strikte Validierung**: Lieferantennummer ist jetzt obligatorisch (kein Fallback mehr)
- ✅ **Multi-Strategie Matching** im Pixi-Service:
  - Strategie 1: `p_item_number` (z.B. "ANS2447304960")
  - Strategie 2: `v_manufacturers_item_number` (z.B. "2447304960" ohne Präfix)
  - Strategie 3: EAN als Fallback
- ✅ **Automatische Datenkonvertierung**: PDF → Brickfox-Format → Pixi-Vergleich
- ✅ **SessionStorage-Übergabe**: csvData + supplNr + source
- ✅ **Auto-Loading**: Pixi-Compare lädt Daten automatisch beim Öffnen

**Betroffene Dateien**:
- `client/src/pages/pdf-auto-scraper.tsx` - Button + Datenkonvertierung
- `client/src/pages/pixi-compare.tsx` - Auto-Loading + Validierung
- `server/routes-supabase.ts` - Neue Route `/api/pixi/compare-direct`
- `server/services/pixi-service.ts` - Multi-Strategie Matching

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