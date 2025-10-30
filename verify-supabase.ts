import { supabaseAdmin } from './server/supabase';

async function verify() {
  if (!supabaseAdmin) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const userId = 'f1289d69-1fdf-4501-8a38-5b0d8b4d23cd';

  console.log('🔍 Checking Supabase Remote Database...\n');

  // Check user data
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (userError) {
    console.error('❌ Error reading user:', userError.message);
    process.exit(1);
  }

  console.log('✅ User found in Supabase:');
  console.log(JSON.stringify(user, null, 2));
  
  if (!user.organization_id) {
    console.log('\n❌ PROBLEM: organization_id is NULL in Supabase!');
    console.log('The SQL UPDATE did not work. Please check:');
    console.log('1. Did you see a success message in Supabase?');
    console.log('2. Did you see the verification table with organization_id filled?');
    console.log('\nPlease run the SQL again and show me the result.');
  } else {
    console.log('\n✅ organization_id is SET!');
    console.log(`Organization ID: ${user.organization_id}`);
    console.log(`Role: ${user.role}`);
  }

  // Check organizations table
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .eq('id', user.organization_id || '16fcf886-e17c-46f0-96f9-56f4aedf7707')
    .single();

  if (orgError) {
    console.error('\n❌ Organization table error:', orgError.message);
  } else {
    console.log('\n✅ Organization found:');
    console.log(JSON.stringify(org, null, 2));
  }

  process.exit(0);
}

verify();
