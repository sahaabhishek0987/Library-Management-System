const jwt = require("jsonwebtoken");
const User = require("../models/User");
const JWT_SECRET = process.env.JWT_SECRET || "bibliotheca_super_secret_jwt_key_2024";
const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token) {
      return res.status(401).json({ success: false, message: "Access denied. Please log in." });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ success: false, message: "User no longer exists." });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: "Your account has been deactivated. Contact admin." });
    }
    if (user.isLocked()) {
      return res.status(403).json({ success: false, message: "Account temporarily locked due to failed login attempts." });
    }
    req.user = user;
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, message: "Invalid token." });
    }
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
    }
    res.status(500).json({ success: false, message: "Authentication error." });
  }
};
const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Administrator privileges required.",
    });
  }
  next();
};
const requirePermission = (permission) => (req, res, next) => {
  if (req.user?.role === "admin") return next();
  if (!req.user?.permissions?.[permission]) {
    return res.status(403).json({
      success: false,
      message: `Access denied. You don't have '${permission}' permission.`,
    });
  }
  next();
};
module.exports = { protect, adminOnly, requirePermission };
