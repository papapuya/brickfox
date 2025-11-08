import { supabaseAdmin } from './supabase';

// Get user_id from command line argument or use the admin user_id
const targetUserId = process.argv[2] || 'd98a6646-1cf1-4442-8e68-7f6e7976f525';

async function updateSuppliersUserId() {
  try {
    console.log(`Updating suppliers to user_id: ${targetUserId}\n`);
    
    if (!supabaseAdmin) {
      console.error('❌ supabaseAdmin is not initialized');
      process.exit(1);
    }

    // First, verify the user exists
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, username')
      .eq('id', targetUserId)
      .single();

    if (userError || !user) {
      console.error(`❌ User with ID ${targetUserId} not found`);
      console.error('Error:', userError?.message);
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.email || user.username || 'N/A'}\n`);

    // Get all suppliers
    const { data: suppliers, error: suppliersError } = await supabaseAdmin
      .from('suppliers')
      .select('id, name, user_id');
    
    if (suppliersError) {
      console.error('❌ Error getting suppliers:', suppliersError.message);
      process.exit(1);
    }

    if (!suppliers || suppliers.length === 0) {
      console.log('No suppliers found to update');
      process.exit(0);
    }

    console.log(`Found ${suppliers.length} supplier(s) to update:\n`);
    suppliers.forEach((s: any) => {
      console.log(`- ${s.name} (ID: ${s.id})`);
      console.log(`  Current user_id: ${s.user_id}`);
      console.log(`  New user_id: ${targetUserId}`);
      console.log('');
    });

    // Update all suppliers
    const { data: updatedSuppliers, error: updateError } = await supabaseAdmin
      .from('suppliers')
      .update({ user_id: targetUserId })
      .select();

    if (updateError) {
      console.error('❌ Error updating suppliers:', updateError.message);
      process.exit(1);
    }

    console.log(`✅ Successfully updated ${updatedSuppliers?.length || 0} supplier(s)`);
    console.log('\nUpdated suppliers:');
    updatedSuppliers?.forEach((s: any) => {
      console.log(`- ${s.name} (now belongs to user: ${targetUserId})`);
    });

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Unexpected error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

updateSuppliersUserId();


