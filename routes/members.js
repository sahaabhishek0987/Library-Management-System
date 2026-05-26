const express = require("express");
const router = express.Router();
const Member = require("../models/Member");
const Transaction = require("../models/Transaction");
const { protect, requirePermission } = require("../middleware/auth");
router.use(protect);
router.get("/", async (req, res) => {
  try {
    const {
      search,
      status,
      membershipType,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { memberId: { $regex: search, $options: "i" } },
      ];
    }
    if (status) query.status = status;
    if (membershipType) query.membershipType = membershipType;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === "asc" ? 1 : -1;
    const [members, total] = await Promise.all([
      Member.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit)),
      Member.countDocuments(query),
    ]);
    res.json({
      success: true,
      data: members,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.get("/stats", async (req, res) => {
  try {
    const [total, active, withFines] = await Promise.all([
      Member.countDocuments(),
      Member.countDocuments({ status: "Active" }),
      Member.countDocuments({ fineAmount: { $gt: 0 } }),
    ]);
    res.json({ success: true, data: { total, active, inactive: total - active, withFines } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.get("/:id", async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member)
      return res.status(404).json({ success: false, message: "Member not found" });
    res.json({ success: true, data: member });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.get("/:id/transactions", async (req, res) => {
  try {
    const transactions = await Transaction.find({ member: req.params.id })
      .populate("book", "title author isbn")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: transactions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.post("/", requirePermission("manageMembers"), async (req, res) => {
  try {
    const member = new Member(req.body);
    await member.save();
    res.status(201).json({ success: true, data: member, message: "Member registered successfully" });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }
    res.status(400).json({ success: false, message: err.message });
  }
});
router.put("/:id", requirePermission("manageMembers"), async (req, res) => {
  try {
    const member = await Member.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!member)
      return res.status(404).json({ success: false, message: "Member not found" });
    res.json({ success: true, data: member, message: "Member updated successfully" });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});
router.delete("/:id", requirePermission("manageMembers"), async (req, res) => {
  try {
    const activeBorrows = await Transaction.countDocuments({
      member: req.params.id,
      status: "Active",
    });
    if (activeBorrows > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete member with active borrows",
      });
    }
    const member = await Member.findByIdAndDelete(req.params.id);
    if (!member)
      return res.status(404).json({ success: false, message: "Member not found" });
    res.json({ success: true, message: "Member deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
module.exports = router;
