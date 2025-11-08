async function main() {
  try {
    const email = 'admin@pimpilot.de';
    const password = 'Admin2024Secure!';
    
    console.log('Testing login with detailed error handling...\n');
    
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
    } else {
      console.log('\n❌ Login failed');
      console.log('Error:', data.error);
      if (data.details) {
        console.log('Details:', data.details);
      }
      if (data.type) {
        console.log('Error type:', data.type);
      }
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Request failed:', error.message);
    process.exit(1);
  }
}

main();

