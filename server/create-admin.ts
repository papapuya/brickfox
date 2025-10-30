import { createAdminUser } from './supabase-auth';

const email = process.env.ADMIN_EMAIL || 'saranzerrer@icloud.com';
const password = process.env.ADMIN_PASSWORD || 'Schnee1978#';

createAdminUser(email, password)
  .then(() => {
    console.log('✅ Admin user created successfully!');
    console.log(`Email: ${email}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  });
