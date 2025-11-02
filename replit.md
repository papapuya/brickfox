# PIMPilot - Produktmanagement SaaS

## Overview
PIMPilot is a multi-tenant B2B SaaS platform designed to automate AI-powered product description and PIM metadata generation from supplier data. It primarily processes product data via CSV uploads for multiple business customers, ensuring strict data isolation. The platform leverages OpenAI's GPT-4o-mini for text generation and a custom Cheerio-based web scraper. Its core capabilities include a robust multi-tenant architecture, secure authentication, Stripe-based subscription management, real-time API call monitoring, dynamic AI prompting, and a sophisticated category-based template system. The project aims to streamline product information management and enhance e-commerce content creation.

## User Preferences
Keine spezifischen Präferenzen dokumentiert.

## System Architecture

### Technology Stack
- **Frontend**: React 18, TypeScript, Vite, shadcn/ui, Radix UI, Tailwind CSS
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL (Helium Dev / Supabase Production) with Drizzle ORM
- **AI/ML**: OpenAI API (GPT-4o-mini for text generation, GPT-4o-mini Vision for image analysis)
- **Web Scraping**: Cheerio (Custom scraper service)
- **Authentication**: Supabase Auth (JWT-based)

### System Design
The application employs a modular subprompt architecture for specialized AI tasks, centrally orchestrated. A 3-layer category-based template system (Category Configuration, AI Generator, Template Renderer) facilitates automatic category recognition and dynamic AI prompt adaptation. Multi-tenancy is enforced server-side using `organization_id` foreign keys to ensure data isolation.

**Key Features**:
- **Multi-Tenant Architecture**: Ensures data isolation per organization.
- **User Authentication**: Supabase Auth with session management.
- **Subscription Management**: Stripe integration for tiered access and trials.
- **Usage Tracking**: Real-time API call monitoring with limit enforcement.
- **CSV Bulk Processing**: Upload and process product data for mass AI generation.
- **URL Web Scraper**: Custom Cheerio-based scraper with configurable CSS selectors, intelligent auto-recognition, table parsing, multi-URL scraping, automatic login, and session cookie capture.
- **AI Generation**: Automated product descriptions using OpenAI GPT-4o-mini, including AI-powered image analysis for color detection.
- **Project Management**: Organize generated products into projects.
- **Supplier Profiles**: Manage multiple suppliers with saved selectors.
- **Pixi ERP Integration**: Automated product comparison with Pixi ERP for identifying new vs. existing products, with intelligent matching and CSV export.
- **CSS Selector Verification System**: Workflow for testing and verifying supplier-specific CSS selectors with visual feedback.
- **Field Mapping Tool**: Visual Click-to-Connect interface for mapping scraped data or CSV columns to Brickfox CSV export fields, supporting custom transformations and reusable presets.

### UI/UX Decisions
The frontend utilizes React 18, TypeScript, Vite, shadcn/ui, Radix UI, and Tailwind CSS for a modern and responsive user experience. Standardized `Table`-components ensure consistent design and functionality across the platform, including features like sticky headers and hover effects.

## External Dependencies
- **OpenAI API**: For AI-driven text generation (GPT-4o-mini) and image analysis (GPT-4o-mini Vision).
- **Supabase**: Provides PostgreSQL database, multi-tenancy support, and authentication services.
- **Stripe**: Integrated for subscription management and payment processing.
- **Pixi ERP API**: Used for product inventory comparison and duplicate detection.
- **Greyhound SMTP**: E-mail sending for automated supplier requests via nodemailer (though currently facing connectivity issues from Replit).

## Recent Changes

### 2025-11-02: Moderne Pricing-Seite mit Gradient-Design 🎨
**Feature**: Professionelle 2-Spalten Pricing-Seite mit PIMPilot-spezifischen Features.

**Implementierung**:
- **2-Tarife-System**: Professional (für Start-Ups/KMUs) + Enterprise (für große Unternehmen)
- **Gradient-Design**: Enterprise-Karte mit blau→lila Hintergrund-Gradient
- **Gradient-Button**: Enterprise CTA mit blau→lila→pink Gradient (wie Vorlage)
- **PIMPilot-Features**: CSV Bulk-Import, URL Scraper, AI-Produktbeschreibungen, PDF Auto-Scraper, Pixi ERP-Integration, MediaMarkt-Formatierung
- **Responsive Design**: 2-Spalten auf Desktop, gestapelt auf Mobile
- **Professional-Features**: Bis zu 500 Produkte/Monat, Lieferanten-Verwaltung, Brickfox CSV-Export
- **Enterprise-Features**: Unbegrenzte Produktgenerierung, PDF Auto-Scraper, Pixi-Integration, persönlicher Support

**Design-Highlights**:
- Professional: Weiße Karte mit blauen Akzenten, einfacher blauer Button
- Enterprise: Gradient-Background (blue-50 → purple-50), lila/pink Akzente, Gradient-Button
- Moderne Checkmarks mit farblich passenden Icons
- Shadow-Effekte und Hover-Transitions für professionellen Look

**Betroffene Dateien**:
- `client/src/pages/pricing.tsx` - Komplett neu gestaltet mit modernem 2-Spalten-Layout

### 2025-11-02: Multi-Tenant-Registrierung mit robuster Slug-Generierung 🏢
**Feature**: Standard B2B SaaS Registrierungsflow - jede Firma erstellt automatisch ihren eigenen Tenant bei Registrierung.

**Implementierung**:
- **Frontend**: Firmenname-Feld zur Registrierung hinzugefügt (`companyName` required)
- **Backend**: Automatische Tenant-Erstellung bei Registrierung mit eindeutigem Slug
- **Slug-Generierung**: Robuste Konvertierung deutscher Umlaute (ä→ae, ö→oe, ü→ue, ß→ss)
- **Kollisionserkennung**: Automatisches Suffix bei doppelten Slugs (z.B. "mueller-gmbh" → "mueller-gmbh-2")
- **Fallback**: Leere Slugs fallen zurück auf "company"
- **Webhook**: Dynamische Tenant-Zuweisung aus `user_metadata.tenant_id` (statt hardcodiert AkkuShop)
- **Admin-Logik**: Erster User eines neuen Tenants wird automatisch Admin (`isAdmin=true, role=admin`)
- **Backward Compatibility**: Legacy-Users ohne `tenant_id` fallen zurück auf AkkuShop-Tenant

**Test-Ergebnisse**:
- ✅ "Bäcker & Köche GmbH" → slug: "baecker-koeche-gmbh"
- ✅ "Müller GmbH" → slug: "mueller-gmbh"
- ✅ "Müller GmbH" (Duplikat) → slug: "mueller-gmbh-2"

**Betroffene Dateien**:
- `client/src/pages/register.tsx` - Firmenname-Feld
- `shared/schema.ts` - RegisterUserSchema erweitert
- `server/routes-supabase.ts` - Tenant-Erstellung mit robuster Slug-Generierung
- `server/webhooks-supabase.ts` - Dynamische tenant_id aus user_metadata
- `server/supabase-storage.ts` - `getTenantBySlug()` Methode hinzugefügt

### 2025-11-02: PDF-Parser EK-Spalten-Fix + VK-Berechnung korrigiert 💰
**Bugfix**: PDF-Parser liest jetzt die korrekte "Netto EK"-Spalte aus und berechnet VK korrekt.

**Problem**: PDF-Parser las die **UE/VP-Spalte** (Lieferanten-Verkaufspreis) statt der **Netto-EK-Spalte**.
- Beispiel: Netto EK = 23,96€ ✓, UE/VP = 49,99€ ✗
- Parser nahm fälschlicherweise 49,99€ (den letzten Preis in der Zeile)

**Lösung**:
- **PDF-Parser**: Nimmt jetzt den **vorletzten Preis** (Netto-EK), nicht den letzten (UE/VP)
- **Fallback**: Bei nur einem Preis wird dieser genommen
- **VK-Formel**: **VK = (EK × 2) + 19%** = **EK × 2 × 1,19** = **EK × 2,38**
- **Rundung**: Ergebnis wird immer auf ,95 gerundet (z.B. 9,95, 16,95, 11,95)

**Beispiele**:
- PDF: Netto EK = 23,96€ → System: **EK = 23,96€** (unverändert) → **VK = 56,95€**
- EK = 5,00€ → VK = 5 × 2 × 1,19 = 11,90 → **11,95€**
- EK = 7,00€ → VK = 7 × 2 × 1,19 = 16,66 → **16,95€**

**Betroffene Dateien**:
- `server/services/pdf-parser.ts` - EK-Extraktion aus PDF (vorletzter statt letzter Preis)
- `client/src/pages/url-scraper.tsx` - VK-Berechnungslogik (PDF-Import)
- `server/scraper-service.ts` - VK-Berechnungslogik (Scraping)

### 2025-11-02: Magento-Gallery-JSON-Parser für ANSMANN-Produkte 🖼️
**Feature**: Intelligente Extraktion aller Produktbilder aus Magento-JavaScript-Galerien (ANSMANN PIM).

**Problem**: ANSMANN verwendet Magento's Fotorama-Plugin, das Bilder dynamisch per JavaScript lädt. Cheerio (HTML-Parser) kann nur statisches HTML parsen und fand daher nur 1 Fallback-Bild statt ~10 Galerie-Bildern.

**Lösung**:
- **Magento-JSON-Parser**: Extrahiert Bilder aus `<script type="text/x-magento-init">` JSON-Config
- **Automatische Erkennung**: Aktiviert sich, wenn ≤1 Bild gefunden wurde (Fallback-Trigger)
- **Vollständige Galerie**: Extrahiert alle Bilder (`full`, `large`, `thumb` URLs) ohne JavaScript-Ausführung
- **Kein Headless Browser**: Performante Lösung ohne Browser-Overhead (Puppeteer/Playwright)
- **Robustes Fallback**: Bei JSON-Parse-Fehler bleibt das statische Fallback-Bild erhalten

**Ergebnisse**:
- ✅ **10 Bilder** pro ANSMANN-Produkt (statt 1)
- ✅ Alle Bilder automatisch heruntergeladen und lokal gespeichert
- ✅ Keine Performance-Einbußen durch Headless-Browser

**Betroffene Dateien**:
- `server/scraper-service.ts` - Magento-Gallery-JSON-Parser mit Fallback-Trigger

### 2025-11-02: Static-File-Server für Produktbilder 🌐
**Feature**: Lokale Produktbilder werden als URLs bereitgestellt, damit sie im Browser angezeigt werden können.

**Implementierung**:
- **Express Static-Server**: Serviert Bilder aus `attached_assets/product_images/` unter `/product-images/`
- **URL-Umwandlung**: Lokale Pfade werden automatisch in Browser-URLs konvertiert
  - Pfad: `attached_assets/product_images/ANS15210039/bild_1.jpg`
  - URL: `/product-images/ANS15210039/bild_1.jpg`
- **CSV-Export**: "Lokale_Bildpfade" enthält jetzt direkte URLs (z.B. `/product-images/ANS15210039/bild_1.jpg|/product-images/ANS15210039/bild_2.jpg`)
- **Browser-Kompatibilität**: Alle Bilder können direkt im Browser geöffnet werden

**Betroffene Dateien**:
- `server/index.ts` - Static-File-Server-Endpoint
- `server/routes-supabase.ts` - URL-Umwandlung für `localImagePaths`

### 2025-11-02: Automatischer Bilder-Download beim Scraping 📥
**Feature**: Alle Produktbilder werden beim Scraping automatisch heruntergeladen und lokal gespeichert.

**Implementierung**:
- **Image-Download-Service**: Lädt alle Bilder eines Produkts herunter (Array-Loop für mehrere URLs)
- **Lokale Speicherung**: Bilder werden in `attached_assets/product_images/{Artikelnummer}/` gespeichert
- **Dateinamen**: `bild_1.jpg`, `bild_2.jpg`, etc. (automatische Erkennung der Dateiendung)
- **Sicherheit**: Artikelnummer wird sanitiert, um Directory Traversal Attacken zu verhindern (Whitelist: `[A-Za-z0-9_-]`)
- **CSV-Export**: Neue Spalte "Lokale_Bildpfade" mit allen lokalen Pfaden (zusätzlich zu Bild_URLs)
- **Error-Handling**: Fortsetzung auch bei fehlgeschlagenen Downloads einzelner Bilder

**Betroffene Dateien**:
- `server/image-download-service.ts` - Download-Service mit Sicherheits-Sanitierung
- `server/routes-supabase.ts` - Automatischer Download nach Scraping
- `client/src/pages/url-scraper.tsx` - Empfang und Export von `localImagePaths`

### 2025-11-02: Bildergalerie für gescrapte Produkte 🖼️
**Feature**: Interaktive Bildergalerie zum Anzeigen aller gescrapten Produktbilder in voller Größe.

**Implementierung**:
- **Klickbare Thumbnails**: Hover-Effekt mit Eye-Icon, zeigt Bildanzahl an (z.B. "3 Bilder")
- **Vollbild-Galerie**: Dialog mit großer Bildanzeige, Navigation zwischen Bildern mit Pfeiltasten
- **Thumbnail-Leiste**: Alle Bilder als Thumbnails unten, aktives Bild wird hervorgehoben
- **Bild-Zähler**: "1 / 5" Anzeige für aktuelle Position
- **URL-Kopieren**: Kopier-Button für direkte Bild-URL mit Toast-Bestätigung
- **Error-Handling**: Fallback-Bilder bei Ladefehlern

**Betroffene Dateien**:
- `client/src/pages/url-scraper.tsx` - Bildergalerie-Dialog und State-Management

### 2025-11-02: Spaltenauswahl für CSV-Export (URL-Scraper)
**Feature**: CSV-Export mit individueller Spaltenauswahl.

**Implementierung**:
- **Spaltenauswahl-Dialog**: Checkboxen für alle 23 Export-Felder (Artikelnummer, Produktname, EAN, technische Daten, SEO-Felder, etc.)
- **"Alle auswählen" / "Alle abwählen"**: Schnelle Massenauswahl für alle Spalten
- **Persistente Auswahl**: Spaltenauswahl bleibt während der Session erhalten
- **Flexible Exports**: Nur ausgewählte Spalten werden ins CSV exportiert (z.B. nur Basis-Daten ohne SEO)

**Betroffene Dateien**:
- `client/src/pages/url-scraper.tsx` - Spaltenauswahl-UI und Export-Logik

### 2025-11-02: CSV-Bulk-Tabelle mit standardisiertem Table-Component
**Änderung**: Vorschau-Tabelle verwendet jetzt das gleiche `Table`-Component wie alle anderen Tabellen (einheitliches CI).

**Implementierung**:
- **Table-Component**: `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` aus `@/components/ui/table`
- **Einheitliches Design**: Hover-Effekte, Border, Spacing werden automatisch vom Component gehandhabt
- **Sticky Headers**: Gleiche Funktionalität wie in PDF-Scraper und URL-Scraper

**Betroffene Dateien**:
- `client/src/components/bulk-description-table.tsx` - Table-Component-Migration

### 2025-11-02: MediaMarkt V1 - Dynamische Produkttyp-Extraktion
**Änderung**: Produkttyp wird dynamisch aus dem Produktnamen extrahiert (nicht hardcodiert).

**Implementierung**:
- **Dynamische Extraktion**: Findet Wörter mit Schlüsselwörtern wie "lampe", "batterie", "akku", "ladegerät"
- **Direkt aus Produktname**: "Nitecore Chameleon CG7 - 2500 Lumen **Taschenlampe**" → extrahiert "Taschenlampe"
- **MediaMarkt V1**: "Taschenlampe NCCG7" (Produkttyp + Modellcode, **OHNE Marke**)
- **Flexibel**: Funktioniert mit beliebigen Produkttypen, keine hardcodierte Liste

**Betroffene Dateien**:
- `client/src/pages/url-scraper.tsx` - `extractProductTypeFromName()` Funktion