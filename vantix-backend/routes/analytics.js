const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Violation = require("../models/Violation");
const { asyncHandler } = require("../middleware/errorHandler");
const { authMiddleware, adminMiddleware } = require("../middleware/authMiddleware");

// @route   GET /api/analytics/total-leaks
// @desc    Get total violations
// @access  Private/Admin
router.get(
  "/total-leaks",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const orgId = new mongoose.Types.ObjectId(req.orgId);
    const count = await Violation.countDocuments({ orgId });
    res.json({ success: true, count });
  })
);

// @route   GET /api/analytics/top-users
// @desc    Get top users with most leaks
// @access  Private/Admin
router.get(
  "/top-users",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const pipeline = [
      // Exclude violations that might have missing userIds (if any fallback occurred)
      { $match: { orgId: new mongoose.Types.ObjectId(req.orgId), userId: { $exists: true, $ne: null } } },
      
      // Group by user id
      {
        $group: {
          _id: "$userId",
          violationCount: { $sum: 1 },
        },
      },
      
      // Sort backwards
      { $sort: { violationCount: -1 } },
      
      // Keep only top 5
      { $limit: 5 },
      
      // Join over to User collection to bring back user details
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      
      // Flatten the resulting array
      { $unwind: "$userDetails" },
      
      // Select fields
      {
        $project: {
          _id: 1,
          violationCount: 1,
          email: "$userDetails.email",
        },
      },
    ];

    const topUsers = await Violation.aggregate(pipeline);

    res.json({ success: true, topUsers });
  })
);

// @route   GET /api/analytics/trends
// @desc    Get daily violation counts for the last 14 days
// @access  Private/Admin
router.get(
  "/trends",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const orgId = new mongoose.Types.ObjectId(req.orgId);
    
    // Calculate the date 14 days ago
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 13);
    pastDate.setHours(0, 0, 0, 0);

    const pipeline = [
      {
        $match: {
          orgId: orgId,
          timestamp: { $gte: pastDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$timestamp" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const results = await Violation.aggregate(pipeline);
    
    // Fill in missing days with 0
    const trends = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(pastDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const found = results.find(r => r._id === dateStr);
      trends.push(found ? found.count : 0);
    }

    res.json({ success: true, trends });
  })
);

module.exports = router;
