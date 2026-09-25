const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");
const User = require("../models/User");
const Violation = require("../models/Violation");
const ActivityLog = require("../models/ActivityLog");
const { asyncHandler } = require("../middleware/errorHandler");
const { authMiddleware, adminMiddleware } = require("../middleware/authMiddleware");

// @route   GET /api/reports/generate
// @desc    Generate weekly/monthly/yearly reports (JSON — used by dashboard)
// @access  Private/Admin
router.get(
  "/generate",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const { period = "monthly" } = req.query;
    
    let days = 30;
    if (period === "weekly") days = 7;
    if (period === "yearly") days = 365;

    const to = new Date();
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const orgId = new mongoose.Types.ObjectId(req.orgId); // Ensure ObjectId type for aggregation

    // Coverage
    const employees = await User.find({ orgId: req.orgId, role: 'employee' }).select("_id");
    
    let active = 0;
    let inactive = 0;
    let notInstalled = 0;

    for (const emp of employees) {
      const lastActivity = await ActivityLog.findOne({ userId: emp._id }).sort({ timestamp: -1 });
      if (!lastActivity) {
        notInstalled++;
      } else if (lastActivity.timestamp >= from) {
        active++;
      } else {
        inactive++;
      }
    }

    // Platform Usage
    const platformUsageRaw = await ActivityLog.aggregate([
      { $match: { orgId: orgId, timestamp: { $gte: from } } },
      { $group: { _id: "$platform", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const platformUsage = platformUsageRaw.map(p => ({ platform: p._id || "Unknown", count: p.count }));

    // Activity Timeline
    const timelineRaw = await ActivityLog.aggregate([
      { $match: { orgId: orgId, timestamp: { $gte: from } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
            userId: "$userId"
          }
        }
      },
      {
        $group: {
          _id: "$_id.date",
          activeUsers: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    const activityTimelineMap = {};
    timelineRaw.forEach(t => {
      activityTimelineMap[t._id] = t.activeUsers;
    });
    
    // Fill in missing days
    const activityTimeline = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split("T")[0];
      activityTimeline.push({
        date: dateStr,
        activeUsers: activityTimelineMap[dateStr] || 0
      });
    }

    // Top Active Employees
    const topEmployeesRaw = await ActivityLog.aggregate([
      { $match: { orgId: orgId, timestamp: { $gte: from } } },
      {
        $group: {
          _id: {
            userId: "$userId",
            date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }
          },
          platforms: { $addToSet: "$platform" }
        }
      },
      {
        $group: {
          _id: "$_id.userId",
          daysActive: { $sum: 1 },
          allPlatforms: { $push: "$platforms" }
        }
      },
      { $sort: { daysActive: -1 } },
      { $limit: 5 }
    ]);

    const topActiveEmployees = [];
    for (const t of topEmployeesRaw) {
      const user = await User.findById(t._id).select("email");
      if (user) {
        // Flatten and distinct platforms
        const distinctPlatforms = [...new Set(t.allPlatforms.flat())].filter(p => p && p !== "Unknown");
        topActiveEmployees.push({
          email: user.email,
          daysActive: t.daysActive,
          platforms: distinctPlatforms.length > 0 ? distinctPlatforms : ["Unknown"]
        });
      }
    }

    // ── Violation data ────────────────────────────────────────────────────────
    const totalViolations = await Violation.countDocuments({ orgId, timestamp: { $gte: from, $lte: to } });

    // Breakdown by type
    const violationsByTypeRaw = await Violation.aggregate([
      { $match: { orgId, timestamp: { $gte: from, $lte: to } } },
      { $unwind: "$matches" },
      { $group: { _id: "$matches.type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const violationsByType = violationsByTypeRaw.map(v => ({ type: v._id, count: v.count }));

    // Top offenders (by violation count)
    const topOffendersRaw = await Violation.aggregate([
      { $match: { orgId, timestamp: { $gte: from, $lte: to }, userId: { $exists: true, $ne: null } } },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $project: { _id: 0, email: "$user.email", count: 1 } },
    ]);

    // Recent violations
    const recentViolationsRaw = await Violation.find({ orgId, timestamp: { $gte: from, $lte: to } })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();
    const recentViolations = recentViolationsRaw.map(v => ({
      timestamp: v.timestamp,
      url: v.url,
      types: (v.matches || []).map(m => m.type),
    }));

    res.json({
      success: true,
      period,
      generatedAt: new Date().toISOString(),
      dateRange: { from: from.toISOString(), to: to.toISOString() },
      org: {
        adminEmail: req.user.email,
        totalEmployees: employees.length
      },
      coverage: { active, inactive, notInstalled },
      platformUsage,
      activityTimeline,
      topActiveEmployees,
      // Violation data
      totalViolations,
      violationsByType,
      topOffenders: topOffendersRaw,
      recentViolations,
    });
  })
);

// @route   GET /api/reports/download
// @desc    Download report as PDF
// @access  Private/Admin
router.get(
  "/download",
  [authMiddleware, adminMiddleware],
  asyncHandler(async (req, res) => {
    const { period = "monthly" } = req.query;

    let days = 30;
    if (period === "weekly") days = 7;
    if (period === "yearly") days = 365;

    const to = new Date();
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const orgId = new mongoose.Types.ObjectId(req.orgId);

    // ── Gather all data ───────────────────────────────────────────────────────
    const employees = await User.find({ orgId: req.orgId, role: "employee" }).select("_id email");

    let activeCnt = 0, inactiveCnt = 0, notInstalledCnt = 0;
    const employeeStatusList = [];
    for (const emp of employees) {
      const lastActivity = await ActivityLog.findOne({ userId: emp._id }).sort({ timestamp: -1 });
      let status = "Not Installed";
      if (!lastActivity) { notInstalledCnt++; }
      else if (lastActivity.timestamp >= from) { activeCnt++; status = "Active"; }
      else { inactiveCnt++; status = "Inactive"; }
      employeeStatusList.push({ email: emp.email, status });
    }

    const totalViolations = await Violation.countDocuments({ orgId, timestamp: { $gte: from, $lte: to } });

    const violationsByTypeRaw = await Violation.aggregate([
      { $match: { orgId, timestamp: { $gte: from, $lte: to } } },
      { $unwind: "$matches" },
      { $group: { _id: "$matches.type", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const topOffendersRaw = await Violation.aggregate([
      { $match: { orgId, timestamp: { $gte: from, $lte: to }, userId: { $exists: true, $ne: null } } },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $project: { _id: 0, email: "$user.email", count: 1 } },
    ]);

    const recentViolationsRaw = await Violation.find({ orgId, timestamp: { $gte: from, $lte: to } })
      .sort({ timestamp: -1 }).limit(15).lean();

    // ── Build PDF ─────────────────────────────────────────────────────────────
    const doc = new PDFDocument({ margin: 50, size: "A4" });

    const filename = `vantix-report-${period}-${new Date().toISOString().split("T")[0]}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    const fromStr = from.toISOString().split("T")[0];
    const toStr = to.toISOString().split("T")[0];

    // ── Header ────
    doc.fontSize(22).font("Helvetica-Bold").text("Vantix", { continued: true });
    doc.fontSize(12).font("Helvetica").text("  Data Loss Prevention Report", { baseline: "bottom" });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#555")
      .text(`Period: ${period.charAt(0).toUpperCase() + period.slice(1)}  |  ${fromStr} — ${toStr}  |  Generated: ${new Date().toLocaleString()}`)
      .text(`Admin: ${req.user.email}`);
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#1a1a2e").lineWidth(2).stroke();
    doc.moveDown(1);

    // ── Executive Summary ────
    doc.fillColor("#1a1a2e").fontSize(14).font("Helvetica-Bold").text("Executive Summary");
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica").fillColor("#333");
    doc.text(`Total Employees: ${employees.length}        Active: ${activeCnt}        Inactive: ${inactiveCnt}        Not Installed: ${notInstalledCnt}`);
    doc.text(`Total Violations: ${totalViolations}`);
    doc.moveDown(1);

    // ── Violations by Type ────
    doc.fillColor("#1a1a2e").fontSize(14).font("Helvetica-Bold").text("Violations by Type");
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica").fillColor("#333");
    if (violationsByTypeRaw.length === 0) {
      doc.text("No violations recorded in this period.");
    } else {
      // Table header
      const typeTableY = doc.y;
      doc.font("Helvetica-Bold").text("Type", 50, typeTableY, { width: 300 });
      doc.text("Count", 400, typeTableY, { width: 100, align: "right" });
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ddd").lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      doc.font("Helvetica");
      for (const v of violationsByTypeRaw) {
        const rowY = doc.y;
        doc.text(v._id || "Unknown", 50, rowY, { width: 300 });
        doc.text(String(v.count), 400, rowY, { width: 100, align: "right" });
        doc.moveDown(0.2);
      }
    }
    doc.moveDown(1);

    // ── Top Offenders ────
    doc.fillColor("#1a1a2e").fontSize(14).font("Helvetica-Bold").text("Top Offenders");
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica").fillColor("#333");
    if (topOffendersRaw.length === 0) {
      doc.text("No offender data available.");
    } else {
      const offTableY = doc.y;
      doc.font("Helvetica-Bold").text("Employee Email", 50, offTableY, { width: 300 });
      doc.text("Violations", 400, offTableY, { width: 100, align: "right" });
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ddd").lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      doc.font("Helvetica");
      for (const o of topOffendersRaw) {
        const rowY = doc.y;
        doc.text(o.email, 50, rowY, { width: 300 });
        doc.text(String(o.count), 400, rowY, { width: 100, align: "right" });
        doc.moveDown(0.2);
      }
    }
    doc.moveDown(1);

    // ── Recent Violations ────
    if (doc.y > 650) doc.addPage();
    doc.fillColor("#1a1a2e").fontSize(14).font("Helvetica-Bold").text("Recent Violations");
    doc.moveDown(0.5);
    doc.fontSize(9).font("Helvetica").fillColor("#333");
    if (recentViolationsRaw.length === 0) {
      doc.text("No recent violations.");
    } else {
      const rvTableY = doc.y;
      doc.font("Helvetica-Bold");
      doc.text("Date", 50, rvTableY, { width: 120 });
      doc.text("URL", 175, rvTableY, { width: 200 });
      doc.text("Types", 380, rvTableY, { width: 165 });
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ddd").lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(8);
      for (const v of recentViolationsRaw) {
        if (doc.y > 750) doc.addPage();
        const rowY = doc.y;
        doc.text(new Date(v.timestamp).toLocaleDateString(), 50, rowY, { width: 120 });
        doc.text(v.url || "—", 175, rowY, { width: 200 });
        doc.text((v.matches || []).map(m => m.type).join(", "), 380, rowY, { width: 165 });
        doc.moveDown(0.3);
      }
    }
    doc.moveDown(1);

    // ── Employee Status ────
    if (doc.y > 600) doc.addPage();
    doc.fillColor("#1a1a2e").fontSize(14).font("Helvetica-Bold").text("Employee Status Summary");
    doc.moveDown(0.5);
    doc.fontSize(9).font("Helvetica").fillColor("#333");
    if (employeeStatusList.length === 0) {
      doc.text("No employees registered.");
    } else {
      const esTableY = doc.y;
      doc.font("Helvetica-Bold");
      doc.text("Email", 50, esTableY, { width: 300 });
      doc.text("Status", 400, esTableY, { width: 100, align: "right" });
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ddd").lineWidth(0.5).stroke();
      doc.moveDown(0.3);
      doc.font("Helvetica");
      for (const e of employeeStatusList) {
        const rowY = doc.y;
        doc.text(e.email, 50, rowY, { width: 300 });
        doc.text(e.status, 400, rowY, { width: 100, align: "right" });
        doc.moveDown(0.2);
      }
    }

    // ── Footer ────
    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ccc").lineWidth(0.5).stroke();
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor("#999").text("Vantix — Data Loss Prevention · Confidential", 50, doc.y, { align: "center", width: 495 });

    doc.end();
  })
);

module.exports = router;
