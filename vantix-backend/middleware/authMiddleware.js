const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Not authorized. No token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "vantix_fallback_secret_key");
    
    // Check database to see if user is still authorized
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, error: "User not found." });
    }

    if (!user.isAuthorized) {
      return res.status(403).json({ success: false, error: "Access revoked. Please contact your admin." });
    }

    // Check if the project itself is active
    const Company = require("../models/Company");
    const company = await Company.findOne({ adminId: decoded.orgId });
    if (company && !company.isActive) {
      return res.status(403).json({ success: false, error: "This project has been remotely terminated. Unauthorized use detected." });
    }

    req.user = decoded; 
    req.orgId = decoded.orgId; 
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: "Not authorized. Invalid token." });
  }
};

const adminMiddleware = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    return res.status(403).json({ success: false, error: "Not authorized as an admin." });
  }
};

module.exports = { authMiddleware, adminMiddleware };
