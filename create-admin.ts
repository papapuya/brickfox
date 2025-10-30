import { storage } from './server/storage';

async function createAdmin() {
  try {
    // Check if admin already exists
    const existingAdmin = await storage.getUserByUsername('Admin');
    if (existingAdmin) {
      console.log('✓ Admin user already exists!');
      console.log('  Username: Admin');
      console.log('  Email:', existingAdmin.email);
      console.log('  isAdmin:', existingAdmin.isAdmin);
      return;
    }

    // Create admin user
    const user = await storage.createUser({
      email: 'admin@pimpilot.de',
      username: 'Admin',
      password: 'Schnee1978#'
    });

    // Set trial subscription
    await storage.updateUserSubscription(user.id, {
      subscriptionStatus: 'trial',
      planId: 'trial',
      apiCallsLimit: 100,
    });

    // Set admin rights using direct SQL
    const { db } = await import('./server/db');
    const { users } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    
    await db
      .update(users)
      .set({ isAdmin: true })
      .where(eq(users.id, user.id));

    console.log('✓ Admin user created successfully!');
    console.log('  Username: Admin');
    console.log('  Email: admin@pimpilot.de');
    console.log('  Password: Schnee1978#');
    console.log('  isAdmin: true');
    console.log('  Trial: 100 free AI generations');
    console.log('\n✓ You can now login at /login');
  } catch (error) {
    console.error('Error creating admin:', error);
  }
  process.exit(0);
}

createAdmin();
