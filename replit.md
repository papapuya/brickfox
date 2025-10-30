# PIMPilot - Produktmanagement SaaS

## Overview
PIMPilot is a production-ready multi-tenant B2B SaaS platform designed to automate the generation of AI-powered product descriptions and PIM metadata from supplier data. It targets efficient mass processing of product data, primarily via CSV uploads, for multiple business customers using a single application instance with complete data isolation. The platform leverages OpenAI GPT-4o-mini for intelligent text generation and a custom Cheerio-based web scraper.

**Key Capabilities:**
- Multi-Tenant Architecture with organization-based data isolation.
- Secure user authentication and Stripe-based subscription management with a trial mode offering 100 free AI generations.
- Real-time API call monitoring and usage tracking with tier-based limits.
- Dynamic AI prompting and a modular subprompt architecture for flexible content generation.
- Category-based template system for structured product description output.

## User Preferences
Keine spezifischen Präferenzen dokumentiert.

## System Architecture

### Technology Stack
- **Frontend**: React 18, TypeScript, Vite, shadcn/ui, Radix UI, Tailwind CSS
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL (Supabase) with Drizzle ORM
- **AI/ML**: OpenAI API (GPT-4o-mini)
- **Web Scraping**: Cheerio (Custom scraper service)
- **Authentication**: Passport.js + bcrypt

### System Design
The application employs a **modular subprompt architecture** (`server/prompts/`) for specialized AI tasks (e.g., USP generation, technical data extraction, safety warnings) orchestrated by a central component. A **category-based template system** (`server/templates/`) uses a 3-layer approach: Category Configuration, AI Generator (returning structured JSON), and Template Renderer (constructing HTML). This system supports automatic category recognition and dynamic AI prompt adaptation.

**Multi-Tenancy**: Achieved through server-side enforcement using `organization_id` foreign keys across all relevant tables, ensuring complete data isolation and preventing cross-tenant access. Security measures include NULL organization_id blocking and security logging.

**Core Features**:
- **Multi-Tenant Architecture**: Data isolation via `organization_id` foreign keys.
- **User Authentication**: Passport.js Local Strategy with bcrypt and Supabase.
- **Subscription Management**: Stripe integration for tiered access (Starter, Pro, Enterprise) and a trial mode.
- **Usage Tracking**: Real-time API call monitoring with limit enforcement.
- **Protected Routes**: Server-side organization filtering and client-side protection.
- **CSV Bulk Processing**: Upload and process product data via CSV for mass AI generation.
- **URL Web Scraper**: Custom Cheerio-based scraper with configurable CSS selectors, intelligent auto-recognition, and a tables parser. Supports multi-URL scraping with timeout protection.
- **AI Generation**: Automated product descriptions in a MediaMarkt-like format using OpenAI GPT-4o-mini, with dynamic, product-specific prompts.
- **Project Management**: Save and organize generated products into projects.
- **Supplier Profiles**: Manage multiple suppliers with saved selectors.

## External Dependencies
-   **OpenAI API**: Used for AI-driven text generation (GPT-4o-mini).
-   **Supabase (PostgreSQL)**: The production database, leveraged for its PostgreSQL capabilities, UUID primary keys, and organization-based multi-tenancy support.
-   **Stripe**: Integrated for subscription management and payment processing.