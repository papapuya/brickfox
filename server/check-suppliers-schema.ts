import { supabaseAdmin } from './supabase';

async function checkSchema() {
  try {
    console.log('Checking suppliers table schema...');
    
    if (!supabaseAdmin) {
      console.error('❌ supabaseAdmin is not initialized');
      process.exit(1);
    }
    
    // Try to get one row to see actual columns
    const { data, error } = await supabaseAdmin
      .from('suppliers')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Error:', error.message);
      console.error('Code:', error.code);
      console.error('Details:', error.details);
      console.error('Hint:', error.hint);
    } else {
      console.log('✅ Table exists and is accessible');
      if (data && data.length > 0) {
        console.log('Columns in table:', Object.keys(data[0]));
      } else {
        // Try a direct query to see what columns exist
        console.log('Table is empty, checking schema...');
        // We can't directly query schema, but we can try to insert a test row to see what columns are required
        console.log('Note: Table exists but has no data');
      }
    }
    
    // Try specific columns that should exist
    const testColumns = [
      'id', 'user_id', 'name', 'suppl_nr', 'url_pattern', 
      'description', 'selectors', 'product_link_selector',
      'session_cookies', 'user_agent', 'login_url',
      'login_username_field', 'login_password_field',
      'login_username', 'login_password', 'tenant_id',
      'verified_fields', 'last_verified_at', 'created_at', 'updated_at'
    ];
    
    console.log('\nTesting column access...');
    for (const col of testColumns) {
      const { error: colError } = await supabaseAdmin
        .from('suppliers')
        .select(col)
        .limit(0);
      
      if (colError && colError.code === '42703') {
        console.log(`❌ Column '${col}' does NOT exist`);
      } else if (colError) {
        console.log(`⚠️  Column '${col}' has error: ${colError.message}`);
      } else {
        console.log(`✅ Column '${col}' exists`);
      }
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Unexpected error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

checkSchema();
