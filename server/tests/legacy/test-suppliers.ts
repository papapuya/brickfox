import { supabaseAdmin } from './supabase';

async function testSuppliers() {
  try {
    console.log('Testing suppliers table access...');
    
    if (!supabaseAdmin) {
      console.error('❌ supabaseAdmin is not initialized');
      process.exit(1);
    }
    
    // Test 1: Count all suppliers
    const { count, error: countError } = await supabaseAdmin
      .from('suppliers')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error counting suppliers:', countError.message);
      console.error('Details:', countError);
    } else {
      console.log(`✅ Total suppliers in Supabase: ${count || 0}`);
    }
    
    // Test 2: Get first 5 suppliers
    const { data: suppliers, error: selectError } = await supabaseAdmin
      .from('suppliers')
      .select('*')
      .limit(5);
    
    if (selectError) {
      console.error('❌ Error selecting suppliers:', selectError.message);
      console.error('Details:', selectError);
    } else {
      console.log(`✅ Found ${suppliers?.length || 0} suppliers`);
      if (suppliers && suppliers.length > 0) {
        console.log('Sample supplier:', {
          id: suppliers[0].id,
          name: suppliers[0].name,
          user_id: suppliers[0].user_id,
          tenant_id: suppliers[0].tenant_id,
        });
      }
    }
    
    // Test 3: Check table structure
    const { data: tableInfo, error: tableError } = await supabaseAdmin
      .from('suppliers')
      .select('id, name, user_id, tenant_id, created_at')
      .limit(1);
    
    if (tableError) {
      console.error('❌ Error checking table structure:', tableError.message);
    } else {
      console.log('✅ Table structure is accessible');
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Unexpected error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

testSuppliers();
