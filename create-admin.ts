import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

async function createAdmin() {
  try {
    const db = new Database('local.db');
    
    // Check if users table exists
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").all();
    
    if (tables.length === 0) {
      console.log('❌ Database tables not created yet!');
      console.log('Please start the app first (npm run dev) to create tables, then try again.');
      process.exit(1);
    }

    // Check if admin already exists
    const existingAdmin = db.prepare("SELECT * FROM users WHERE username = 'Admin'").get() as any;
    
    if (existingAdmin) {
      console.log('✓ Admin user already exists!');
      console.log('  Username: Admin');
      console.log('  Email:', existingAdmin.email);
      console.log('  isAdmin:', existingAdmin.isAdmin);
      
      // Update to admin if not already
      if (!existingAdmin.isAdmin) {
        db.prepare("UPDATE users SET isAdmin = 1 WHERE username = 'Admin'").run();
        console.log('✓ Admin rights granted!');
      }
      
      process.exit(0);
      return;
    }

    // Create admin user
    const passwordHash = await bcrypt.hash('Schnee1978#', 10);
    const userId = nanoid();
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO users (
        id, email, username, password_hash, is_admin, 
        subscription_status, plan_id, api_calls_used, api_calls_limit,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      'admin@pimpilot.de',
      'Admin',
      passwordHash,
      1, // is_admin = true
      'trial',
      'trial',
      0,
      100,
      now,
      now
    );

    console.log('✅ Admin user created successfully!');
    console.log('');
    console.log('  Username: Admin');
    console.log('  Email: admin@pimpilot.de');
    console.log('  Password: Schnee1978#');
    console.log('  isAdmin: ✓ true');
    console.log('  Trial: 100 free AI generations');
    console.log('');
    console.log('✅ You can now login at /login with username "Admin"');
    
    db.close();
  } catch (error: any) {
    console.error('❌ Error creating admin:', error.message);
  }
  process.exit(0);
}

createAdmin();
