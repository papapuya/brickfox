import { createAdminUser } from './supabase-auth';

async function main() {
  try {
    // Read credentials from environment variables
    const email = process.env.ADMIN_EMAIL || 'admin@pimpilot.de';
    const password = process.env.ADMIN_PASSWORD;
    const username = process.env.ADMIN_USERNAME || 'Admin';
    
    if (!password) {
      console.error('❌ ADMIN_PASSWORD environment variable must be set');
      console.error('Usage: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=securepass ADMIN_USERNAME=Admin npm run create-admin-now');
      process.exit(1);
    }
    
    console.log('Creating admin user...');
    console.log(`Email: ${email}`);
    console.log(`Username: ${username}`);
    console.log(`Password: ${'*'.repeat(password.length)} (hidden)`);
    
    await createAdminUser(email, password, username);
    
    console.log('\n✅ Admin user created successfully!');
    console.log(`\n💡 You can now login with:`);
    console.log(`   - Email: ${email}`);
    console.log(`   - Username: ${username}`);
    console.log(`   - Password: [Set via ADMIN_PASSWORD environment variable]`);
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error creating admin user:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

main();

