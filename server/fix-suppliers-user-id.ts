import { supabaseAdmin } from './supabase';

async function fixSuppliersUserId() {
  try {
    console.log('Checking suppliers and their user_ids...\n');
    
    if (!supabaseAdmin) {
      console.error('❌ supabaseAdmin is not initialized');
      process.exit(1);
    }

    // Get all suppliers
    const { data: suppliers, error: suppliersError } = await supabaseAdmin
      .from('suppliers')
      .select('id, name, user_id, tenant_id');
    
    if (suppliersError) {
      console.error('❌ Error getting suppliers:', suppliersError.message);
      process.exit(1);
    }

    console.log(`Found ${suppliers?.length || 0} suppliers:\n`);
    suppliers?.forEach((s: any) => {
      console.log(`- ${s.name} (ID: ${s.id})`);
      console.log(`  user_id: ${s.user_id}`);
      console.log(`  tenant_id: ${s.tenant_id || 'null'}`);
      console.log('');
    });

    // Get all users
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email, username');
    
    if (usersError) {
      console.error('❌ Error getting users:', usersError.message);
    } else {
      console.log(`\nFound ${users?.length || 0} users:\n`);
      users?.forEach((u: any) => {
        console.log(`- ${u.email || u.username || 'N/A'} (ID: ${u.id})`);
      });
    }

    // Get all auth users
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (!authError && authUsers) {
      console.log(`\nFound ${authUsers.users.length} auth users:\n`);
      authUsers.users.forEach((u: any) => {
        console.log(`- ${u.email} (ID: ${u.id})`);
      });
    }

    console.log('\n💡 To fix suppliers, you can:');
    console.log('1. Update the user_id of suppliers to match your current user');
    console.log('2. Or create a new user with the user_id that matches the suppliers');
    console.log('\nExample command to update a supplier:');
    console.log('UPDATE suppliers SET user_id = \'YOUR_USER_ID\' WHERE id = \'SUPPLIER_ID\';');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Unexpected error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

fixSuppliersUserId();


