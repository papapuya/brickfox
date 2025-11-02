# PIMPilot - Produktmanagement SaaS

## Overview
PIMPilot is a multi-tenant B2B SaaS platform for automating AI-powered product description and PIM metadata generation from supplier data. It processes product data, primarily via CSV uploads, for multiple business customers with data isolation. The platform uses OpenAI GPT-4o-mini for text generation and a custom Cheerio-based web scraper. Key capabilities include multi-tenant architecture, secure authentication, Stripe-based subscription management, real-time API call monitoring, dynamic AI prompting, and a category-based template system.

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
The application utilizes a modular subprompt architecture for specialized AI tasks, orchestrated by a central component. A category-based template system employs a 3-layer approach (Category Configuration, AI Generator, Template Renderer) to support automatic category recognition and dynamic AI prompt adaptation. Multi-tenancy is enforced server-side using `organization_id` foreign keys, ensuring data isolation.

**Core Features**:
- **Multi-Tenant Architecture**: Data isolation via `organization_id` foreign keys.
- **User Authentication**: Supabase Auth integration with "Remember Me" functionality, storing sessions in localStorage or sessionStorage.
- **Subscription Management**: Stripe integration for tiered access and trial mode.
- **Usage Tracking**: Real-time API call monitoring with limit enforcement.
- **CSV Bulk Processing**: Upload and process product data via CSV for mass AI generation.
- **URL Web Scraper**: Custom Cheerio-based scraper with configurable CSS selectors, intelligent auto-recognition, tables parser, multi-URL scraping, automatic login, and session cookie capture.
- **AI Generation**: Automated product descriptions using OpenAI GPT-4o-mini, with dynamic, product-specific prompts. Includes AI-powered image analysis for automatic color detection.
- **Project Management**: Save and organize generated products into projects.
- **Supplier Profiles**: Manage multiple suppliers with saved selectors.
- **Pixi ERP Integration**: Automated product comparison with Pixi ERP system to identify new vs. existing products, with CSV upload, intelligent matching, and CSV export functionality.
- **CSS Selector Verification System**: Comprehensive workflow for testing and verifying supplier-specific CSS selectors with visual feedback and persistence.
- **Field Mapping Tool**: Visual Click-to-Connect interface for mapping scraped data fields or CSV columns to Brickfox CSV export fields. Supports automatic field detection, custom transformations, and reusable mapping presets, with tenant-isolated storage and API endpoints.

## External Dependencies
- **OpenAI API**: For AI-driven text generation (GPT-4o-mini) and image analysis (GPT-4o-mini Vision).
- **Supabase**: Provides PostgreSQL database, UUID primary keys, organization-based multi-tenancy, and authentication.
- **Stripe**: Integrated for subscription management and payment processing.
- **Pixi ERP API**: External integration for product inventory comparison and duplicate detection.
- **Greyhound SMTP**: E-Mail-Versand für automatisierte Lieferanten-Anfragen (via nodemailer).

## Recent Changes

### 2025-11-02: E-Mail-Integration für Lieferanten-Anfragen (Greyhound SMTP)
**Feature**: Automatischer E-Mail-Versand für Produkte ohne URLs mit editierbarer Vorlage.

**Implementierung**:
- **SMTP-Integration**: Greyhound SMTP-Server via nodemailer (Zugangsdaten in Replit Secrets: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM)
- **E-Mail-Service**: `server/services/email-service.ts` für strukturierte E-Mail-Versendung
- **API-Endpoint**: `/api/email/request-urls` für E-Mail-Versand mit EAN-Codes
- **Frontend-Dialog**: Editierbare E-Mail-Vorlage mit Empfänger, Betreff, Nachricht und automatischem Anhängen der EAN-Codes
- **Button "URLs anfragen"**: Im Tab "Ohne URL" - öffnet Dialog, sendet E-Mail über Greyhound SMTP

**Workflow**:
1. PDF hochladen → Produkte OHNE URL werden im Tab "Ohne URL" angezeigt
2. Button "URLs anfragen" klicken → Dialog öffnet sich
3. E-Mail-Vorlage editieren (Empfänger, Betreff, Nachricht anpassen)
4. E-Mail wird mit allen EAN-Codes aus Tab "Ohne URL" versendet
5. Lieferant erhält strukturierte Anfrage mit EAN-Liste

**Betroffene Dateien**:
- `server/services/email-service.ts` - SMTP-Service
- `server/routes-supabase.ts` - API-Endpoint
- `client/src/pages/pdf-auto-scraper.tsx` - Dialog-Integration