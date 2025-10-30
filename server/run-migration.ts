import { supabaseAdmin } from './supabase';

export async function ensureMultiTenantSchema() {
  if (!supabaseAdmin) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
    return false;
  }

  const akkushopOrgId = '16fcf886-e17c-46f0-96f9-56f4aedf7707';
  const userId = 'f1289d69-1fdf-4501-8a38-5b0d8b4d23cd';

  console.log('🔍 Checking Supabase schema...');

  // Check if organizations table exists
  const { error: orgCheckError } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .limit(1);

  if (orgCheckError && orgCheckError.message.includes('does not exist')) {
    console.log('⚠️  organizations table missing - schema update needed');
    console.log('📋 Please run this SQL in Supabase Dashboard:');
    console.log('   https://supabase.com/dashboard/project/lxemqwvdaxzeldpjmxoc/sql');
    console.log('\n--- SQL START ---');
    console.log(`
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member'));

INSERT INTO organizations (id, name, slug, settings)
VALUES (
  '${akkushopOrgId}',
  'AkkuShop',
  'akkushop',
  '{"default_categories": ["battery", "charger", "tool"]}'
)
ON CONFLICT (slug) DO NOTHING;

UPDATE users 
SET organization_id = '${akkushopOrgId}', role = 'admin'
WHERE id = '${userId}';

ALTER TABLE projects ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE products_in_projects ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    `.trim());
    console.log('--- SQL END ---\n');
    return false;
  }

  console.log('✅ Schema looks good!');
  return true;
}
