import { supabaseAdmin } from './server/supabase';

async function fixUserOrganization() {
  if (!supabaseAdmin) {
    console.error('SUPABASE_SERVICE_ROLE_KEY not configured');
    process.exit(1);
  }

  const userId = 'f1289d69-1fdf-4501-8a38-5b0d8b4d23cd';
  const akkushopOrgId = '16fcf886-e17c-46f0-96f9-56f4aedf7707';

  console.log('Updating user in SUPABASE REMOTE database...');

  const { data, error } = await supabaseAdmin
    .from('users')
    .upsert({
      id: userId,
      email: 'saranzerrer@icloud.com',
      username: 'Admin',
      is_admin: true,
      role: 'admin',
      organization_id: akkushopOrgId,
      subscription_status: 'trial',
      plan_id: 'trial',
      api_calls_limit: 3000,
      api_calls_used: 0,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id'
    })
    .select();

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('✅ Success! User updated in Supabase Remote:');
  console.log(JSON.stringify(data, null, 2));

  const { data: verification } = await supabaseAdmin
    .from('users')
    .select('id, email, organization_id, role')
    .eq('id', userId)
    .single();

  console.log('\n✅ Verification - User now has:');
  console.log(JSON.stringify(verification, null, 2));
  
  process.exit(0);
}

fixUserOrganization();
