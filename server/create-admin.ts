import { createAdminUser } from './supabase-auth';

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const username = process.env.ADMIN_USERNAME; // Optional username

if (!email || !password) {
  console.error('❌ ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be set');
  console.error('Usage: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=securepass ADMIN_USERNAME=Admin npm run create-admin');
  console.error('Note: ADMIN_USERNAME is optional (defaults to "Admin")');
  process.exit(1);
}

createAdminUser(email, password, username)
  .then(() => {
    console.log('✅ Admin user created successfully!');
    console.log(`Email: ${email}`);
    if (username) {
      console.log(`Username: ${username}`);
      console.log(`\n💡 You can now login with either:`);
      console.log(`   - Email: ${email}`);
      console.log(`   - Username: ${username}`);
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  });
