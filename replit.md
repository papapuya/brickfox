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
- **AI/ML**: OpenAI API (GPT-4o-mini)
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
- **AI Generation**: Automated product descriptions using OpenAI GPT-4o-mini, with dynamic, product-specific prompts.
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