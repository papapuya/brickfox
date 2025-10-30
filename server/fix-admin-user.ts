import { supabaseAdmin } from './supabase';

const email = 'saranzerrer@icloud.com';

async function fixAdminUser() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
  }

  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.listUsers();

  if (authError) {
    throw new Error(`Failed to list auth users: ${authError.message}`);
  }

  const user = authUser.users.find(u => u.email === email);

  if (!user) {
    throw new Error(`User not found in auth.users: ${email}`);
  }

  console.log('Found auth user:', user.id, user.email);

  const { error: upsertError } = await supabaseAdmin
    .from('users')
    .upsert({
      id: user.id,
      email: user.email,
      username: 'Admin',
      is_admin: true,
      subscription_status: 'trial',
      plan_id: 'trial',
      api_calls_limit: 100,
      api_calls_used: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id'
    });

  if (upsertError) {
    throw new Error(`Failed to upsert user: ${upsertError.message}`);
  }

  console.log(`✅ Admin user record created/updated: ${email}`);

  const { data: publicUser } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  console.log('Final user record:', publicUser);
}

fixAdminUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
