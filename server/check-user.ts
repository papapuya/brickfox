import { supabaseAdmin } from './supabase';

async function main() {
  try {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const email = 'admin@pimpilot.de';
    
    console.log('Checking user in Supabase...\n');
    
    // Get user from Supabase Auth
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      throw listError;
    }
    
    const authUser = users.users.find(u => u.email === email);
    
    if (authUser) {
      console.log('✅ User found in Supabase Auth:');
      console.log('   ID:', authUser.id);
      console.log('   Email:', authUser.email);
      console.log('   Email Confirmed:', authUser.email_confirmed_at ? 'Yes' : 'No');
    } else {
      console.log('❌ User NOT found in Supabase Auth');
      process.exit(1);
    }
    
    // Check user in Supabase users table
    console.log('\nChecking Supabase users table...');
    const { data: usersData, error: usersError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email);
    
    if (usersError) {
      console.error('❌ Error:', usersError.message);
    } else if (usersData && usersData.length > 0) {
      const user = usersData[0];
      console.log('✅ User found in Supabase users table:');
      console.log('   ID:', user.id);
      console.log('   Email:', user.email);
      console.log('   Username:', user.username);
      console.log('   Is Admin:', user.is_admin);
      console.log('   Role:', user.role);
      console.log('   Tenant ID:', user.tenant_id);
      
      // Check if user needs to be updated
      if (!user.is_admin || user.role !== 'admin') {
        console.log('\n⚠️ User is not marked as admin! Updating...');
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update({ 
            is_admin: true,
            role: 'admin',
            username: 'Admin'
          })
          .eq('id', user.id);
        
        if (updateError) {
          console.error('❌ Failed to update user:', updateError.message);
        } else {
          console.log('✅ User updated to admin!');
        }
      }
    } else {
      console.log('⚠️ User NOT found in Supabase users table. Creating...');
      
      // Get or create tenant
      const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('slug', 'akkushop')
        .single();
      
      const { error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authUser.id,
          email: email,
          username: 'Admin',
          is_admin: true,
          role: 'admin',
          tenant_id: tenant?.id || null,
          subscription_status: 'trial',
          plan_id: 'trial',
          api_calls_limit: 999999,
          api_calls_used: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      
      if (insertError) {
        console.error('❌ Failed to create user:', insertError.message);
      } else {
        console.log('✅ User created in Supabase users table!');
      }
    }
    
    console.log('\n✅ Setup complete! Try logging in now.');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

