import { supabaseAdmin } from './supabase';

const email = 'saranzerrer@icloud.com';

async function updateAdminFlag() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
  }

  const { data: users, error: fetchError } = await supabaseAdmin
    .from('users')
    .select('id, email, is_admin')
    .eq('email', email)
    .single();

  if (fetchError || !users) {
    throw new Error(`User not found: ${email}`);
  }

  console.log('Current user:', users);

  if (users.is_admin) {
    console.log('✅ User is already admin!');
    process.exit(0);
  }

  const { error: updateError } = await supabaseAdmin
    .from('users')
    .update({ is_admin: true, username: 'Admin' })
    .eq('id', users.id);

  if (updateError) {
    throw new Error(`Failed to update admin flag: ${updateError.message}`);
  }

  console.log(`✅ Admin flag set for: ${email}`);
}

updateAdminFlag()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
