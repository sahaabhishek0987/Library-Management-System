const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { protect, adminOnly } = require("../middleware/auth");
const JWT_SECRET = process.env.JWT_SECRET || "bibliotheca_super_secret_jwt_key_2024";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username and password are required." });
    }
    const user = await User.findOne({ username: username.toLowerCase().trim() }).select("+password");
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid username or password." });
    }
    if (user.isLocked()) {
      const remaining = Math.ceil((user.lockedUntil - Date.now()) / 60000);
      return res.status(403).json({
        success: false,
        message: `Account locked. Try again in ${remaining} minute(s).`,
      });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: "Account deactivated. Contact administrator." });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.loginAttempts += 1;
      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);
        await user.save();
        return res.status(403).json({
          success: false,
          message: `Too many failed attempts. Account locked for ${LOCK_DURATION_MINUTES} minutes.`,
        });
      }
      await user.save();
      return res.status(401).json({
        success: false,
        message: `Invalid username or password. ${MAX_LOGIN_ATTEMPTS - user.loginAttempts} attempt(s) remaining.`,
      });
    }
    user.loginAttempts = 0;
    user.lockedUntil = undefined;
    user.lastLogin = new Date();
    await user.save();
    const token = jwt.sign(
      { id: user._id, role: user.role, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    res.json({
      success: true,
      message: `Welcome back, ${user.fullName}!`,
      token,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        employeeId: user.employeeId,
        permissions: user.permissions,
        lastLogin: user.lastLogin,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("createdBy", "fullName username");
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.put("/change-password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Both current and new password are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters." });
    }
    const user = await User.findById(req.user._id).select("+password");
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Current password is incorrect." });
    }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: "Password changed successfully." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.get("/issuers", protect, adminOnly, async (req, res) => {
  try {
    const { search, isActive, page = 1, limit = 20 } = req.query;
    const query = { role: "issuer" };
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: "i" } },
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { employeeId: { $regex: search, $options: "i" } },
      ];
    }
    if (isActive !== undefined) query.isActive = isActive === "true";
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [issuers, total] = await Promise.all([
      User.find(query)
        .populate("createdBy", "fullName username")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query),
    ]);
    res.json({
      success: true,
      data: issuers,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.post("/issuers", protect, adminOnly, async (req, res) => {
  try {
    const { username, password, fullName, email, phone, permissions } = req.body;
    if (!username || !password || !fullName) {
      return res.status(400).json({ success: false, message: "Username, password, and full name are required." });
    }
    const existing = await User.findOne({ username: username.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: "Username already taken." });
    }
    const issuer = new User({
      username,
      password,
      fullName,
      email,
      phone,
      role: "issuer",
      createdBy: req.user._id,
      permissions: {
        manageBooks: permissions?.manageBooks ?? true,
        manageMembers: permissions?.manageMembers ?? false,
        issueBooks: permissions?.issueBooks ?? true,
        returnBooks: permissions?.returnBooks ?? true,
        viewReports: permissions?.viewReports ?? false,
      },
    });
    await issuer.save();
    res.status(201).json({
      success: true,
      data: issuer,
      message: `Issuer account '${issuer.username}' created successfully.`,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: "Username or Employee ID already exists." });
    }
    res.status(400).json({ success: false, message: err.message });
  }
});
router.put("/issuers/:id", protect, adminOnly, async (req, res) => {
  try {
    const { fullName, email, phone, isActive, permissions, password } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (user.role === "admin" && req.user._id.toString() !== user._id.toString()) {
      return res.status(403).json({ success: false, message: "Cannot modify another admin account." });
    }
    if (fullName) user.fullName = fullName;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (isActive !== undefined) user.isActive = isActive;
    if (permissions) user.permissions = { ...user.permissions.toObject?.() || user.permissions, ...permissions };
    if (password) {
      if (password.length < 6) return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
      user.password = password;
    }
    if (isActive === true) {
      user.loginAttempts = 0;
      user.lockedUntil = undefined;
    }
    await user.save();
    res.json({ success: true, data: user, message: "Account updated successfully." });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});
router.delete("/issuers/:id", protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    if (user.role === "admin") return res.status(403).json({ success: false, message: "Cannot delete an admin account." });
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: `Issuer account '${user.username}' deleted.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.put("/issuers/:id/reset-password", protect, adminOnly, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    user.password = newPassword;
    user.loginAttempts = 0;
    user.lockedUntil = undefined;
    await user.save();
    res.json({ success: true, message: `Password reset for '${user.username}'.` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});
module.exports = router;
