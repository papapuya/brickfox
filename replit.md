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