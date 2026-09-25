const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function checkUser() {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email: 'admin@vantix.com' });
  if (user) {
    console.log('User found:', user.email, 'Role:', user.role);
  } else {
    console.log('User NOT found');
  }
  process.exit(0);
}

checkUser();
