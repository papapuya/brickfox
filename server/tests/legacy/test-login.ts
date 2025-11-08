import { supabase, supabaseAdmin } from './supabase';
import { supabaseStorage } from './supabase-storage';

async function main() {
  try {
    const email = 'admin@pimpilot.de';
    const password = 'Admin2024Secure!';
    
    console.log('Testing login...\n');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}\n`);
    
    // Test 1: Try direct Supabase login
    console.log('[TEST 1] Attempting Supabase Auth login...');
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (loginError) {
      console.error('❌ Login failed:', loginError.message);
      console.error('   Error code:', loginError.status);
    } else {
      console.log('✅ Supabase Auth login successful!');
      console.log('   User ID:', loginData.user?.id);
      console.log('   Email:', loginData.user?.email);
    }
    
    // Test 2: Check user in database
    console.log('\n[TEST 2] Checking user in database...');
    if (loginData?.user) {
      const user = await supabaseStorage.getUserById(loginData.user.id);
      if (user) {
        console.log('✅ User found in database:');
        console.log('   ID:', user.id);
        console.log('   Email:', user.email);
        console.log('   Username:', user.username);
        console.log('   Is Admin:', user.isAdmin);
        console.log('   Role:', user.role);
      } else {
        console.log('⚠️ User NOT found in Helium DB (but exists in Supabase Auth)');
        console.log('   This might cause login issues.');
      }
    }
    
    // Test 3: Check username lookup
    console.log('\n[TEST 3] Testing username lookup...');
    const userByUsername = await supabaseStorage.getUserByUsername('Admin');
    if (userByUsername) {
      console.log('✅ Username "Admin" found:');
      console.log('   Email:', userByUsername.email);
      console.log('   Is Admin:', userByUsername.isAdmin);
    } else {
      console.log('⚠️ Username "Admin" NOT found in database');
    }
    
    // Test 4: List all users from Supabase
    if (supabaseAdmin) {
      console.log('\n[TEST 4] Checking Supabase users table...');
      const { data: usersData, error: usersError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('email', email);
      
      if (usersError) {
        console.error('❌ Error querying users table:', usersError.message);
      } else if (usersData && usersData.length > 0) {
        console.log('✅ User found in Supabase users table:');
        console.log('   ID:', usersData[0].id);
        console.log('   Email:', usersData[0].email);
        console.log('   Username:', usersData[0].username);
        console.log('   Is Admin:', usersData[0].is_admin);
        console.log('   Role:', usersData[0].role);
      } else {
        console.log('⚠️ User NOT found in Supabase users table');
      }
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();

