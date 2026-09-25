const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Company = require('./models/Company');
const dotenv = require('dotenv');

dotenv.config();

const seedEmployees = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/vantix');
    console.log('Connected to MongoDB...');

    // 1. Find the admin to get the orgId
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      console.error('Admin user not found. Please run admin-register first.');
      process.exit(1);
    }

    const orgId = admin._id;
    const password = 'employee123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const employees = [
      { email: 'employee1@vantix.com', password: hashedPassword, role: 'employee', orgId, isFirstLogin: false },
      { email: 'employee2@vantix.com', password: hashedPassword, role: 'employee', orgId, isFirstLogin: false },
      { email: 'employee3@vantix.com', password: hashedPassword, role: 'employee', orgId, isFirstLogin: false },
    ];

    for (const empData of employees) {
      const existing = await User.findOne({ email: empData.email });
      if (!existing) {
        await User.create(empData);
        console.log(`Created: ${empData.email}`);
      } else {
        existing.password = hashedPassword;
        await existing.save();
        console.log(`Updated: ${empData.email}`);
      }
    }

    console.log('Seed complete!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedEmployees();
