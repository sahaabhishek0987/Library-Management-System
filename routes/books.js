const express = require("express");
const router = express.Router();
const Book = require("../models/Book");
const { protect, requirePermission } = require("../middleware/auth");
router.use(protect);
router.get("/", async (req, res) => {
  try {
    const {
      search,
      category,
      status,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { author: { $regex: search, $options: "i" } },
        { isbn: { $regex: search, $options: "i" } },
      ];
    }
    if (category) query.category = category;
    if (status) query.status = status;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === "asc" ? 1 : -1;
    const [books, total] = await Promise.all([
      Book.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit)),
      Book.countDocuments(query),
    ]);
    res.json({
      success: true,
      data: books,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.get("/stats", async (req, res) => {
  try {
    const [total, available, categories] = await Promise.all([
      Book.countDocuments(),
      Book.countDocuments({ status: "Available" }),
      Book.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);
    res.json({
      success: true,
      data: { total, available, outOfStock: total - available, categories },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.get("/:id", async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book)
      return res
        .status(404)
        .json({ success: false, message: "Book not found" });
    res.json({ success: true, data: book });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.post("/", requirePermission("manageBooks"), async (req, res) => {
  try {
    const book = new Book(req.body);
    book.availableCopies = book.totalCopies;
    await book.save();
    res.status(201).json({ success: true, data: book, message: "Book added successfully" });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: "ISBN already exists" });
    }
    res.status(400).json({ success: false, message: err.message });
  }
});
router.put("/:id", requirePermission("manageBooks"), async (req, res) => {
  try {
    const book = await Book.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!book)
      return res.status(404).json({ success: false, message: "Book not found" });
    res.json({ success: true, data: book, message: "Book updated successfully" });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});
router.delete("/:id", requirePermission("manageBooks"), async (req, res) => {
  try {
    const book = await Book.findByIdAndDelete(req.params.id);
    if (!book)
      return res.status(404).json({ success: false, message: "Book not found" });
    res.json({ success: true, message: "Book deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
module.exports = router;
