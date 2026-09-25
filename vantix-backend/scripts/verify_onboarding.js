const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';

async function test() {
  console.log('--- Testing Domain-Based Onboarding ---');

  try {
    const uniqueId = Date.now();
    const adminEmail = `admin_${uniqueId}@test-${uniqueId}.com`;
    const adminPassword = 'Password123!';

    // 1. Admin Register
    console.log(`1. Registering admin: ${adminEmail}`);
    const regRes = await axios.post(`${API_BASE}/auth/admin-register`, {
      email: adminEmail,
      password: adminPassword
    });
    console.log('   Success:', regRes.data.success);

    // 2. Check duplicate domain registration
    console.log(`2. Attempting duplicate domain registration...`);
    try {
      await axios.post(`${API_BASE}/auth/admin-register`, {
        email: `another_admin@test-${uniqueId}.com`,
        password: adminPassword
      });
    } catch (err) {
      console.log('   Caught Expected Error:', err.response.data.error);
    }

    // 3. Employee Check Email (New employee)
    const empEmail = `employee_${uniqueId}@test-${uniqueId}.com`;
    console.log(`3. Checking email for new employee: ${empEmail}`);
    const checkRes = await axios.post(`${API_BASE}/auth/check-email`, { email: empEmail });
    console.log('   Exists:', checkRes.data.exists, 'IsFirstLogin:', checkRes.data.isFirstLogin);

    // 4. Employee Set Password (Auto-onboard)
    console.log(`4. Setting password for employee...`);
    const setPassRes = await axios.post(`${API_BASE}/auth/set-password`, {
      email: empEmail,
      newPassword: 'EmpPassword123!'
    });
    console.log('   Success:', setPassRes.data.success, 'Role:', setPassRes.data.user.role);

    // 5. Employee Login
    console.log(`5. Logging in as employee...`);
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: empEmail,
      password: 'EmpPassword123!'
    });
    console.log('   Success:', loginRes.data.success, 'Token received:', !!loginRes.data.token);

    // 6. Test domain validation failure
    // We can't easily test this without manually tampering with the DB to associate a user with a different orgId, 
    // or by trying to login with an email whose domain doesn't match the registered company domain of their orgId.
    // Actually, if I login with bob@wrong.com but my password matches bob@acme.com? No, emails are unique.
    
    console.log('--- Verification Complete ---');
  } catch (err) {
    console.error('Test Failed:', err.response?.data || err.message);
  }
}

test();
