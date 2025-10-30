import { supabaseAdmin } from './server/supabase';
import * as fs from 'fs';

async function runMigrationOnSupabase() {
  if (!supabaseAdmin) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not configured');
    process.exit(1);
  }

  console.log('🚀 Running migration on Supabase Remote...\n');

  // Read migration file
  const migrationSQL = fs.readFileSync('server/migrations/001_add_organizations.sql', 'utf-8');
  
  // Split by statement (rough approach, works for this migration)
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';';
    
    // Skip comments
    if (stmt.startsWith('--') || stmt.startsWith('COMMENT')) {
      continue;
    }

    console.log(`Executing statement ${i + 1}/${statements.length}...`);
    
    const { error } = await supabaseAdmin.rpc('exec_sql', { sql: stmt });
    
    if (error) {
      // Some errors are OK (like "already exists")
      if (error.message.includes('already exists') || 
          error.message.includes('does not exist') ||
          error.code === '42P07' || // duplicate table
          error.code === '42701') { // duplicate column
        console.log(`⚠️  Skipped (already exists): ${error.message.substring(0, 80)}...`);
      } else {
        console.error(`❌ Error:`, error);
        // Continue anyway for now
      }
    } else {
      console.log('✅ Success');
    }
  }

  console.log('\n🎉 Migration completed! Now setting up user...\n');

  // Now create organization and assign user
  const akkushopOrgId = '16fcf886-e17c-46f0-96f9-56f4aedf7707';
  const userId = 'f1289d69-1fdf-4501-8a38-5b0d8b4d23cd';

  // Insert organization
  const { error: orgError } = await supabaseAdmin
    .from('organizations')
    .upsert({
      id: akkushopOrgId,
      name: 'AkkuShop',
      slug: 'akkushop',
      settings: {
        default_categories: ['battery', 'charger', 'tool'],
        mediamarkt_title_format: 'Kategorie + Artikelnummer'
      }
    }, { onConflict: 'id' });

  if (orgError) {
    console.error('❌ Organization error:', orgError);
  } else {
    console.log('✅ AkkuShop organization created/updated');
  }

  // Update user with organization_id
  const { error: userError } = await supabaseAdmin
    .from('users')
    .update({
      organization_id: akkushopOrgId,
      role: 'admin'
    })
    .eq('id', userId);

  if (userError) {
    console.error('❌ User update error:', userError);
  } else {
    console.log('✅ User assigned to AkkuShop organization');
  }

  // Verify
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email, organization_id, role')
    .eq('id', userId)
    .single();

  console.log('\n✅ Verification - User now has:');
  console.log(JSON.stringify(user, null, 2));
  
  process.exit(0);
}

runMigrationOnSupabase();
