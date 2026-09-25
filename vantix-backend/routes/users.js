const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { asyncHandler } = require("../middleware/errorHandler");
const { authMiddleware, adminMiddleware } = require("../middleware/authMiddleware");

// @route   GET /api/users
// @desc    Get all employees
// @access  Private/Admin
router.get(
  "/",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    // Return everyone, exclude password field
    const users = await User.find({ orgId: req.orgId, role: 'employee' }).select("-password").sort({ createdAt: -1 });
    
    // Auto-offline users who haven't sent a heartbeat in 2 minutes
    const now = new Date();
    for (let u of users) {
      if (u.isOnline && (now - new Date(u.lastActive)) > 120000) {
        u.isOnline = false;
        u.currentApp = "";
        await u.save();
      }
    }
    
    res.json({ success: true, users });
  })
);


// @route   POST /api/users
// @desc    Add a new employee
// @access  Private/Admin
router.post(
  "/",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const { email, role } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }

    const emailLower = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: emailLower });
    
    if (existingUser) {
      return res.status(400).json({ success: false, error: "User already exists" });
    }

    // Since the hackathon extension UI doesn't have the "Set Password" screen
    // implemented yet, we will set a default password and bypass the first login check.
    const defaultPassword = "Password123";
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(defaultPassword, salt);

    const user = await User.create({
      email: emailLower,
      password: hashedPassword, 
      role: role === "admin" ? "admin" : "employee",
      isFirstLogin: false,
      orgId: req.orgId,
    });

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        isFirstLogin: user.isFirstLogin,
        createdAt: user.createdAt,
      },
    });
  })
);


// @route   PATCH /api/users/:id
// @desc    Update an employee's role
// @access  Private/Admin
router.patch(
  "/:id",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const { role } = req.body;
    if (!role || !["admin", "employee"].includes(role)) {
      return res.status(400).json({ success: false, error: "Valid role required (admin or employee)" });
    }

    const user = await User.findOne({ _id: req.params.id, orgId: req.orgId });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    user.role = role;
    await user.save();

    res.json({
      success: true,
      user: { id: user._id, email: user.email, role: user.role },
    });
  })
);

// @route   DELETE /api/users/:id
// @desc    Remove an employee
// @access  Private/Admin
router.delete(
  "/:id",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, orgId: req.orgId });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ success: false, error: "Cannot delete your own account" });
    }

    await User.deleteOne({ _id: user._id });

    res.json({ success: true, message: `User ${user.email} removed` });
  })
);

// @route   PUT /api/users/:id/toggle-access
// @desc    Toggle an employee's authorization
// @access  Private/Admin
router.put(
  "/:id/toggle-access",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, orgId: req.orgId });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    user.isAuthorized = !user.isAuthorized;
    await user.save();

    res.json({
      success: true,
      message: `Access ${user.isAuthorized ? 'granted' : 'revoked'} for ${user.email}`,
      user: { id: user._id, isAuthorized: user.isAuthorized },
    });
  })
);

// @route   PUT /api/users/status
// @desc    Update an employee's online status and current app
// @access  Private/Employee
router.put(
  "/status",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { currentApp } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    user.isOnline = true;
    user.lastActive = new Date();
    user.currentApp = currentApp || "";
    await user.save();

    res.json({ success: true, isAuthorized: user.isAuthorized });
  })
);

module.exports = router;
