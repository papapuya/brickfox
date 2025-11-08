import { supabaseAdmin } from './supabase';

async function main() {
  try {
    if (!supabaseAdmin) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    // Read credentials from environment variables
    const email = process.env.ADMIN_EMAIL || 'admin@pimpilot.de';
    const newPassword = process.env.ADMIN_PASSWORD;
    
    if (!newPassword) {
      console.error('❌ ADMIN_PASSWORD environment variable must be set');
      console.error('Usage: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=securepass npm run reset-admin-password');
      process.exit(1);
    }
    
    console.log(`Resetting password for: ${email}`);
    
    // First, get the user by email
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      throw listError;
    }
    
    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      console.error(`❌ User ${email} not found`);
      process.exit(1);
    }
    
    console.log(`✅ Found user: ${user.id} (${user.email})`);
    
    // Update password
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );
    
    if (error) {
      throw error;
    }
    
    console.log('\n✅ Password reset successfully!');
    console.log(`Email: ${email}`);
    console.log(`New Password: [Set via ADMIN_PASSWORD environment variable]`);
    console.log('\n💡 You can now login with:');
    console.log(`   - Email: ${email}`);
    console.log(`   - Password: [From ADMIN_PASSWORD environment variable]`);
    
    // Also ensure user is admin in database
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ 
        is_admin: true,
        role: 'admin',
        username: 'Admin'
      })
      .eq('id', user.id);
    
    if (updateError) {
      console.warn(`⚠️ Could not update user in database: ${updateError.message}`);
      console.log('   (User might not exist in database yet - will be created on first login)');
    } else {
      console.log('\n✅ User marked as admin in database');
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

