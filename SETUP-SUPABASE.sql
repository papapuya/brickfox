-- ============================================
-- SUPABASE DATABASE SETUP
-- Run this ONCE in your Supabase SQL Editor
-- ============================================

-- 1. Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add organization_id and role columns to users table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE users ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member'));
  END IF;
END $$;

-- 3. Create AkkuShop organization
INSERT INTO organizations (id, name, slug, settings)
VALUES (
  '16fcf886-e17c-46f0-96f9-56f4aedf7707',
  'AkkuShop',
  'akkushop',
  '{"default_categories": ["battery", "charger", "tool"], "mediamarkt_title_format": "Kategorie + Artikelnummer"}'
)
ON CONFLICT (slug) DO NOTHING;

-- 4. Assign your user to AkkuShop organization as admin
UPDATE users 
SET 
  organization_id = '16fcf886-e17c-46f0-96f9-56f4aedf7707', 
  role = 'admin',
  updated_at = NOW()
WHERE id = 'f1289d69-1fdf-4501-8a38-5b0d8b4d23cd';

-- 5. Add organization_id to other tables (for future multi-tenancy)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE products_in_projects ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 6. Verification - Check if user now has organization_id
SELECT id, email, organization_id, role FROM users WHERE id = 'f1289d69-1fdf-4501-8a38-5b0d8b4d23cd';
