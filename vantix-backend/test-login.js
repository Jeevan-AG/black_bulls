const axios = require('axios');

async function testLogin() {
  try {
    const res = await axios.post('http://localhost:5000/api/auth/admin-login', {
      email: 'admin@vantix.com',
      password: 'admin123'
    });
    console.log('Login success:', res.data.success);
  } catch (err) {
    console.log('Login failed:', err.response ? err.response.data : err.message);
  }
}

testLogin();
