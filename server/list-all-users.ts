import { supabaseAdmin } from './supabase';

async function main() {
  try {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    console.log('Listing all users in Supabase...\n');
    
    // Get all users from Supabase Auth
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      throw authError;
    }
    
    console.log(`Found ${authUsers.users.length} users in Supabase Auth:\n`);
    
    for (const authUser of authUsers.users) {
      console.log(`Email: ${authUser.email}`);
      console.log(`ID: ${authUser.id}`);
      console.log(`Email Confirmed: ${authUser.email_confirmed_at ? 'Yes' : 'No'}`);
      console.log(`Created: ${authUser.created_at}`);
      
      // Check in users table
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();
      
      if (!userError && userData) {
        console.log(`Username: ${userData.username || 'N/A'}`);
        console.log(`Is Admin: ${userData.is_admin ? 'Yes' : 'No'}`);
        console.log(`Role: ${userData.role || 'N/A'}`);
      } else {
        console.log(`⚠️ Not found in users table`);
      }
      
      console.log('---\n');
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

