-- SUPER SICHERES SQL - Schritt für Schritt

-- Schritt 1: Organizations Tabelle
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schritt 2: organization_id Spalte zur users Tabelle
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Schritt 3: role Spalte zur users Tabelle  
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT;

-- Schritt 4: Foreign Key constraint (falls nicht vorhanden)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_organization_id_fkey'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_organization_id_fkey 
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Schritt 5: AkkuShop Organisation erstellen
INSERT INTO organizations (id, name, slug, settings)
VALUES (
  '16fcf886-e17c-46f0-96f9-56f4aedf7707',
  'AkkuShop',
  'akkushop',
  '{"default_categories": ["battery", "charger", "tool"]}'
)
ON CONFLICT (id) DO NOTHING;

-- Schritt 6: User zur Organisation zuweisen (jetzt NACHDEM die Spalten existieren!)
UPDATE users 
SET 
  organization_id = '16fcf886-e17c-46f0-96f9-56f4aedf7707', 
  role = 'admin'
WHERE id = 'f1289d69-1fdf-4501-8a38-5b0d8b4d23cd';

-- Schritt 7: Andere Tabellen
ALTER TABLE projects ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE products_in_projects ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Schritt 8: Foreign Keys für andere Tabellen
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'projects_organization_id_fkey') THEN
    ALTER TABLE projects ADD CONSTRAINT projects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'products_organization_id_fkey') THEN
    ALTER TABLE products_in_projects ADD CONSTRAINT products_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'suppliers_organization_id_fkey') THEN
    ALTER TABLE suppliers ADD CONSTRAINT suppliers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Schritt 9: Verification
SELECT id, email, organization_id, role FROM users WHERE id = 'f1289d69-1fdf-4501-8a38-5b0d8b4d23cd';
