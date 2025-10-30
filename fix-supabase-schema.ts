import { supabaseAdmin } from './server/supabase';

async function fixSchema() {
  if (!supabaseAdmin) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('🚀 Fixing Supabase Remote schema step-by-step...\n');

  const akkushopOrgId = '16fcf886-e17c-46f0-96f9-56f4aedf7707';
  const userId = 'f1289d69-1fdf-4501-8a38-5b0d8b4d23cd';

  // Step 1: Create organizations table via direct insert (will auto-create if not exists)
  console.log('Step 1: Creating AkkuShop organization...');
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .upsert({
      id: akkushopOrgId,
      name: 'AkkuShop',
      slug: 'akkushop',
      settings: {
        default_categories: ['battery', 'charger', 'tool'],
        mediamarkt_title_format: 'Kategorie + Artikelnummer'
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' })
    .select();

  if (orgError) {
    console.error('❌ Organization error:', orgError.message);
    console.log('ℹ️  This means the organizations table likely doesn\'t exist yet in Supabase Remote.\n');
  } else {
    console.log('✅ Organization created:', org);
  }

  // Step 2: Try to update user with organization_id
  console.log('\nStep 2: Assigning user to organization...');
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .update({
      organization_id: akkushopOrgId,
      role: 'admin',
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select();

  if (userError) {
    console.error('❌ User update error:', userError.message);
    console.log('ℹ️  This confirms: organization_id column does NOT exist in Supabase Remote users table.\n');
    
    console.log('📋 MANUAL ACTION REQUIRED:');
    console.log('Please run this SQL in Supabase SQL Editor:');
    console.log('https://supabase.com/dashboard/project/lxemqwvdaxzeldpjmxoc/sql/new\n');
    console.log('--- Copy from here ---');
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
    `.trim());
    console.log('--- Copy until here ---\n');
  } else {
    console.log('✅ User updated:', user);
  }

  // Step 3: Verify
  const { data: verification, error: verifyError } = await supabaseAdmin
    .from('users')
    .select('id, email, organization_id, role')
    .eq('id', userId)
    .single();

  if (verifyError) {
    console.error('❌ Verification failed:', verifyError.message);
  } else {
    console.log('\n✅ VERIFICATION - User in Supabase Remote:');
    console.log(JSON.stringify(verification, null, 2));
    
    if (verification.organization_id) {
      console.log('\n🎉 SUCCESS! User has organization_id assigned!');
    } else {
      console.log('\n⚠️  organization_id is still NULL - migration needed');
    }
  }
}

fixSchema();
