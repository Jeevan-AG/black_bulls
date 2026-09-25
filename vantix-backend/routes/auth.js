const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Rule = require("../models/Rule");
const IndividualUser = require("../models/IndividualUser");
const Company = require("../models/Company");

// Helper to generate JWT
const generateToken = (id, role, email, orgId) => {
  return jwt.sign({ id, role, email, orgId }, process.env.JWT_SECRET || "vantix_fallback_secret_key", {
    expiresIn: "30d",
  });
};

// @route   POST /api/auth/check-email
// @desc    Check if an email exists and if it's the user's first login
// @access  Public (Extension pre-login)
router.post("/check-email", async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: "Email required" });

    let user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Check if domain exists in Company table
      const domain = email.split("@")[1]?.toLowerCase();
      if (domain) {
        const company = await Company.findOne({ companyDomain: domain });
        if (company) {
          return res.json({
            success: true,
            exists: true,
            isFirstLogin: true, // Allow new employees to set password
          });
        }
      }
      return res.status(404).json({ success: false, exists: false });
    }

    res.json({
      success: true,
      exists: true,
      isFirstLogin: user.isFirstLogin,
    });
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/auth/set-password
// @desc    Set password for first-time login and activate account
// @access  Public (Extension first login step)
router.post("/set-password", async (req, res, next) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ success: false, error: "Email and new password required" });
    }

    let user = await User.findOne({ email: email.toLowerCase() });
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    if (!user) {
      // Check if this is an automatic enrollment for a company
      const domain = email.split("@")[1]?.toLowerCase();
      const company = await Company.findOne({ companyDomain: domain });
      
      if (!company) {
        return res.status(404).json({ success: false, error: "User not found and domain not registered" });
      }

      // Auto-create employee
      user = await User.create({
        email: email.toLowerCase(),
        password: hashedPassword,
        role: "employee",
        isFirstLogin: false, // Setting it now
        orgId: company.adminId,
      });
    } else {
      if (!user.isFirstLogin) {
        return res.status(400).json({ success: false, error: "Password was already set. Please login instead." });
      }
      user.password = hashedPassword;
      user.isFirstLogin = false;
      await user.save();
    }

    const orgId = user.role === 'admin' ? user._id : user.orgId;
    const token = generateToken(user._id, user.role, user.email, orgId);

    res.json({
      success: true,
      token,
      user: { id: user._id, email: user.email, role: user.role }
    });
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate existing user & get token
// @access  Public
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password required" });
    }

    const cleanEmail = email.toLowerCase().trim();
    const isDemoAdmin =
      (cleanEmail === "admin@nexustech.com" || cleanEmail === "admin@vantix.corp") &&
      (password === "Demo@1234" || password === "Admin@123456");

    let user = null;
    try {
      if (require("mongoose").connection.readyState === 1) {
        user = await User.findOne({ email: cleanEmail }).maxTimeMS(2000);
      }
    } catch (e) {
      console.warn("[Auth] DB lookup skipped:", e.message);
    }

    if (user) {
      // Domain validation for employees
      if (user.role === "employee") {
        const emailDomain = cleanEmail.split("@")[1];
        const company = await Company.findOne({ adminId: user.orgId });
        if (!company || company.companyDomain !== emailDomain) {
          return res.status(401).json({ success: false, error: "Not authorized for this company" });
        }
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch && !isDemoAdmin) {
        return res.status(401).json({ success: false, error: "Invalid credentials" });
      }

      const orgId = user.role === 'admin' ? user._id : user.orgId;
      const token = generateToken(user._id, user.role, user.email, orgId);

      return res.json({
        success: true,
        token,
        user: { id: user._id, email: user.email, role: user.role }
      });
    }

    if (isDemoAdmin) {
      const demoId = "6aaeeb50fe457d3adec786ee";
      const token = generateToken(demoId, "admin", cleanEmail, demoId);
      return res.json({
        success: true,
        token,
        user: { id: demoId, email: cleanEmail, role: "admin" }
      });
    }

    return res.status(401).json({ success: false, error: "Invalid credentials" });
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/auth/admin-login
// @desc    Authenticate admin & get token
// @access  Public (React Dashboard)
router.post("/admin-login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = (email || "").toLowerCase().trim();

    // Fast-path demo login fallback (guarantees zero-friction hackathon demos)
    const isDemoAdmin =
      (cleanEmail === "admin@nexustech.com" || cleanEmail === "admin@vantix.corp") &&
      (password === "Demo@1234" || password === "Admin@123456");

    let user = null;
    try {
      if (require("mongoose").connection.readyState === 1) {
        user = await User.findOne({ email: cleanEmail }).maxTimeMS(2000);
      }
    } catch (e) {
      console.warn("[Auth] DB lookup skipped:", e.message);
    }

    if (user) {
      if (user.role !== "admin") {
        return res.status(401).json({ success: false, error: "Not authorized as an admin" });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch && !isDemoAdmin) {
        return res.status(401).json({ success: false, error: "Invalid credentials" });
      }
      const token = generateToken(user._id, user.role, user.email, user._id);
      return res.json({
        success: true,
        token,
        user: { id: user._id, email: user.email, role: user.role }
      });
    }

    if (isDemoAdmin) {
      const demoId = "6aaeeb50fe457d3adec786ee";
      const token = generateToken(demoId, "admin", cleanEmail, demoId);
      return res.json({
        success: true,
        token,
        user: { id: demoId, email: cleanEmail, role: "admin" }
      });
    }

    return res.status(401).json({ success: false, error: "Invalid credentials" });
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/auth/admin-register
// @desc    Create new admin user & get token
// @access  Public
router.post("/admin-register", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password required" });
    }

    const emailLower = email.toLowerCase();
    const domain = emailLower.split("@")[1];

    if (!domain) {
      return res.status(400).json({ success: false, error: "Invalid email format" });
    }

    const existingUser = await User.findOne({ email: emailLower });
    if (existingUser) {
      return res.status(400).json({ success: false, error: "An account with this email already exists" });
    }

    const existingCompany = await Company.findOne({ companyDomain: domain });
    if (existingCompany) {
      return res.status(400).json({ success: false, error: "A company with this domain is already registered" });
    }

    // Create new admin
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const newUser = await User.create({
      email: emailLower,
      password: hashedPassword,
      role: "admin",
      isFirstLogin: false,
    });

    // Create Company record
    await Company.create({
      companyDomain: domain,
      adminId: newUser._id,
      adminEmail: emailLower,
    });

    await Rule.create({ orgId: newUser._id, domains: [], keywords: [], customPatterns: [] });

    const token = generateToken(newUser._id, newUser.role, newUser.email, newUser._id);

    res.json({
      success: true,
      token,
      user: { id: newUser._id, email: newUser.email, role: newUser.role }
    });
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/auth/individual/register
// @desc    Register a new individual user
// @access  Public
router.post("/individual/register", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password required" });
    }

    const emailLower = email.toLowerCase();
    const existingUser = await IndividualUser.findOne({ email: emailLower });
    if (existingUser) {
      return res.status(400).json({ success: false, error: "An account with this email already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await IndividualUser.create({
      email: emailLower,
      password: hashedPassword
    });

    const token = generateToken(newUser._id, "individual", newUser.email, newUser._id);

    res.json({
      success: true,
      token,
      trialExpiresAt: newUser.trialExpiresAt,
      userType: "individual"
    });
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/auth/individual/login
// @desc    Login individual user
// @access  Public
router.post("/individual/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password required" });
    }

    const user = await IndividualUser.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: "Invalid credentials" });
    }

    const token = generateToken(user._id, "individual", user.email, user._id);

    res.json({
      success: true,
      token,
      trialExpiresAt: user.trialExpiresAt,
      userType: "individual"
    });
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/auth/change-password
// @desc    Change password for authenticated user
// @access  Private
router.post("/change-password", async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Not authorized" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "vantix_fallback_secret_key");

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: "Current and new password required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "New password must be at least 6 characters" });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(401).json({ success: false, error: "Current password is incorrect" });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    next(err);
  }
});

// @route   GET /api/auth/profile
// @desc    Get current user profile
// @access  Private
router.get("/profile", async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Not authorized" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "vantix_fallback_secret_key");

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        orgId: user.role === 'admin' ? user._id : user.orgId
      }
    });
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/auth/toggle-project-status
// @desc    Toggle project active status (Remote Kill Switch)
// @access  Private/Admin
router.post("/toggle-project-status", async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Not authorized" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "vantix_fallback_secret_key");

    if (decoded.role !== "admin") {
      return res.status(403).json({ success: false, error: "Admin only" });
    }

    const company = await Company.findOne({ adminId: decoded.orgId });
    if (!company) return res.status(404).json({ success: false, error: "Company not found" });

    company.isActive = !company.isActive;
    await company.save();

    res.json({
      success: true,
      message: `Project ${company.isActive ? 'activated' : 'terminated'}`,
      isActive: company.isActive
    });
  } catch (err) {
    next(err);
  }
});

// @route   GET /api/auth/project-status
// @desc    Get current project status
// @access  Private/Admin
router.get("/project-status", async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "Not authorized" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "vantix_fallback_secret_key");

    const company = await Company.findOne({ adminId: decoded.orgId });
    if (!company) return res.status(404).json({ success: false, error: "Company not found" });

    res.json({
      success: true,
      isActive: company.isActive
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
