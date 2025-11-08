import { supabase } from './supabase';

async function main() {
  try {
    const email = 'admin@pimpilot.de';
    const password = 'Admin2024Secure!';
    
    console.log('Testing direct Supabase login...\n');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}\n`);
    
    // Test direct Supabase auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('❌ Login failed:', error.message);
      console.error('Status:', error.status);
      console.error('Full error:', JSON.stringify(error, null, 2));
      process.exit(1);
    }
    
    if (!data.user) {
      console.error('❌ No user returned');
      process.exit(1);
    }
    
    console.log('✅ Login successful!');
    console.log('User ID:', data.user.id);
    console.log('Email:', data.user.email);
    console.log('Session:', data.session ? 'Yes' : 'No');
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Unexpected error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

