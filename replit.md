# PIMPilot - Produktmanagement SaaS

## Overview
PIMPilot is a multi-tenant B2B SaaS platform automating AI-powered product description and PIM metadata generation from supplier data. It processes product data via CSV uploads for multiple business customers, ensuring strict data isolation. The platform leverages OpenAI's GPT-4o-mini for text generation and a custom Cheerio-based web scraper. Its core capabilities include a robust multi-tenant architecture, secure authentication, Stripe-based subscription management, real-time API call monitoring, dynamic AI prompting, and a sophisticated category-based template system. The project aims to streamline product information management and enhance e-commerce content creation with a business vision to automate product content creation for e-commerce.

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
- **CSV Bulk Processing**: Upload and process product data for mass AI generation, with standardized column selection for PIM mapping and full image URL export. Brickfox CSV export now includes separate columns for up to 10 image URLs and consistent preview/export.
- **URL Web Scraper**: Custom Cheerio-based scraper with configurable CSS selectors (restructured for better data capture of base data, prices, media, descriptions, technical data), intelligent auto-recognition, table parsing, multi-URL scraping, automatic login, session cookie capture, automatic image download, and Magento-specific JSON gallery parsing.
- **AI Generation**: Automated product descriptions using OpenAI GPT-4o-mini, including AI-powered image analysis for color detection and dynamic product type extraction.
- **Project Management**: Organize generated products into projects.
- **Supplier Profiles**: Manage multiple suppliers with saved selectors.
- **ERP Integration (e.g., Pixi)**: Automated product comparison for identifying new vs. existing products, intelligent multi-strategy matching (item number, manufacturer's item number, EAN), and CSV export. Direct integration for PDF Scraper to Pixi Compare without intermediate CSV steps. Ensures hyphens in manufacturer item numbers are preserved for correct matching.
- **CSS Selector Verification System**: Workflow for testing and verifying supplier-specific CSS selectors with visual feedback.
- **Field Mapping Tool**: Visual "Click-to-Connect" interface for mapping scraped data or CSV columns to export fields, supporting custom transformations and reusable presets. A new automatic mapping module utilizes `mappingRules.json` for centralized configuration, including priority logic, fixed values, auto-generation (e.g., category path), validation, and unit transformations.
- **Admin Dashboard**: Professional dashboard with real-time KPIs and tenant management capabilities (subscription status, customer deletion, feature flags). Includes a checkbox-based bulk delete for customers.
- **PDF Parser**: Improved PDF parser for accurate extraction of purchase and selling prices.
- **Image Handling**: Static file server for local product images, automatic image download during scraping, and an interactive image gallery for scraped products.
- **Contact Form**: Professional contact form with direct email sending to admin.
- **Enterprise Security Features**: Implemented automatic backup system (Point-in-Time Recovery, multi-tenant isolation, audit-logging), granular RBAC with 5 roles (`admin`, `editor`, `viewer`, `project_manager`, `member`) and resource/action/scope-based permissions, comprehensive audit-log system for all CRUD operations, and field-level AES-256-GCM encryption for sensitive data (e.g., passwords, API keys).

### System Design
The application employs a modular subprompt architecture for specialized AI tasks, centrally orchestrated. A 3-layer category-based template system (Category Configuration, AI Generator, Template Renderer) facilitates automatic category recognition and dynamic AI prompt adaptation. Multi-tenancy is enforced server-side using `organization_id` foreign keys to ensure data isolation.

## External Dependencies
- **OpenAI API**: For AI-driven text generation (GPT-4o-mini) and image analysis (GPT-4o-mini Vision).
- **Supabase**: Provides PostgreSQL database, multi-tenancy support, and authentication services.
- **Stripe**: Integrated for subscription management and payment processing.
- **Pixi ERP API**: Used for product inventory comparison and duplicate detection.
- **Greyhound SMTP**: E-mail sending for automated supplier requests via nodemailer.