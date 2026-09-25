require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Company = require('../models/Company');
const Rule = require('../models/Rule');
const Violation = require('../models/Violation');

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('🚀 Connected to MongoDB for seeding...');

        // Clear existing data to ensure fresh seed
        await User.deleteMany({});
        await Company.deleteMany({});
        await Rule.deleteMany({});
        await Violation.deleteMany({});

        const email = 'admin@vantix.com';
        const password = 'admin123';

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const admin = await User.create({
            email,
            password: hashedPassword,
            role: 'admin',
            isFirstLogin: false
        });

        await Company.create({
            companyDomain: 'vantix.com',
            adminId: admin._id,
            adminEmail: email
        });

        await Rule.create({
            orgId: admin._id,
            domains: [],
            keywords: ['secret_project_x', 'vanguard_leak'],
            customPatterns: []
        });

        // Add dummy violations
        await Violation.create([
            {
                userId: admin._id,
                orgId: admin._id,
                url: "https://chatgpt.com/",
                email: "admin@vantix.com",
                matches: [{ type: "Credit Card" }, { type: "Email" }],
                timestamp: new Date()
            },
            {
                userId: admin._id,
                orgId: admin._id,
                url: "https://claude.ai/",
                email: "admin@vantix.com",
                matches: [{ type: "API Key" }],
                timestamp: new Date(Date.now() - 3600000)
            },
            {
                userId: admin._id,
                orgId: admin._id,
                url: "https://chatgpt.com/",
                email: "admin@vantix.com",
                matches: [{ type: "Keyword" }],
                timestamp: new Date(Date.now() - 7200000)
            }
        ]);

        console.log(`
        ✅ Seed Success!
        ----------------------
        Admin Email: ${email}
        Admin Password: ${password}
        ----------------------
        Data: Admin, Company, Rules, and 3 Dummy Violations created.
        ----------------------
        You can now log in to the Vantix Hub.
        `);
        process.exit(0);
    } catch (error) {
        console.error('❌ Seed Error:', error);
        process.exit(1);
    }
};

seedAdmin();
