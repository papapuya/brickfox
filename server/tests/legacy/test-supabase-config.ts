import { supabase, supabaseAdmin } from './supabase';

async function main() {
  try {
    console.log('Testing Supabase configuration...\n');
    
    console.log('Supabase URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing');
    console.log('Supabase Anon Key:', process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
    console.log('Supabase Service Role Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
    
    console.log('\nSupabase client:', supabase ? '✅ Initialized' : '❌ Not initialized');
    console.log('Supabase Admin client:', supabaseAdmin ? '✅ Initialized' : '❌ Not initialized');
    
    // Test login
    console.log('\nTesting direct login...');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'admin@pimpilot.de',
      password: 'Admin2024Secure!',
    });
    
    if (error) {
      console.error('❌ Login failed:', error.message);
      console.error('Error status:', error.status);
    } else {
      console.log('✅ Login successful!');
      console.log('User ID:', data.user?.id);
      console.log('Email:', data.user?.email);
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

