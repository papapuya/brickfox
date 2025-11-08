async function main() {
  try {
    const email = 'admin@pimpilot.de';
    const password = 'Admin2024Secure!';
    
    console.log('Testing API login...\n');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}\n`);
    
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });
    
    const data = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('\n✅ Login successful!');
      if (data.user) {
        console.log('User:', data.user.email);
        console.log('Is Admin:', data.user.isAdmin);
      }
    } else {
      console.log('\n❌ Login failed:', data.error);
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

