const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const Book = require("../models/Book");
const Member = require("../models/Member");
const { protect, requirePermission } = require("../middleware/auth");

// All transaction routes require authentication
router.use(protect);

// ─── GET /api/transactions ─── List all transactions
router.get("/", async (req, res) => {
  try {
    const {
      search,
      status,
      type,
      memberId,
      bookId,
      page = 1,
      limit = 10,
    } = req.query;

    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (memberId) query.member = memberId;
    if (bookId) query.book = bookId;

    if (search) {
      // Find matching members and books first for cross-collection searching
      const matchingMembers = await Member.find({ name: { $regex: search, $options: "i" } }).select('_id');
      const matchingBooks = await Book.find({ title: { $regex: search, $options: "i" } }).select('_id');
      
      query.$or = [
        { transactionId: { $regex: search, $options: "i" } },
        { member: { $in: matchingMembers.map(m => m._id) } },
        { book: { $in: matchingBooks.map(b => b._id) } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let txQuery = Transaction.find(query)
      .populate("member", "name memberId email")
      .populate("book", "title author isbn")
      .populate("issuedBy", "fullName username")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const [transactions, total] = await Promise.all([
      txQuery,
      Transaction.countDocuments(query),
    ]);

    // Recalculate fines and update overdue status dynamically
    const now = new Date();
    for (const tx of transactions) {
      if (tx.status === "Active" && tx.dueDate < now) {
        await Transaction.findByIdAndUpdate(tx._id, { status: "Overdue" });
        tx.status = "Overdue";
      }
    }

    res.json({
      success: true,
      data: transactions,
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

// ─── GET /api/transactions/stats ─── Dashboard statistics
router.get("/stats", async (req, res) => {
  try {
    const now = new Date();
    const [active, overdue, returned, totalFines] = await Promise.all([
      Transaction.countDocuments({ status: "Active" }),
      Transaction.countDocuments({ status: "Overdue" }),
      Transaction.countDocuments({ status: "Returned" }),
      Member.aggregate([{ $group: { _id: null, total: { $sum: "$fineAmount" } } }]),
    ]);

    res.json({
      success: true,
      data: {
        active,
        overdue,
        returned,
        totalFines: totalFines[0]?.total || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/transactions/:id ─── Get single transaction
router.get("/:id", async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id)
      .populate("member", "name memberId email phone")
      .populate("book", "title author isbn category")
      .populate("issuedBy", "fullName username");
      
    if (!tx)
      return res.status(404).json({ success: false, message: "Transaction not found" });

    const fine = tx.calculateFine();
    res.json({ success: true, data: { ...tx.toObject(), calculatedFine: fine } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/transactions/borrow ─── Issue a book
router.post("/borrow", requirePermission("issueBooks"), async (req, res) => {
  try {
    const { memberId, bookId, notes } = req.body;

    // Validate member
    const member = await Member.findById(memberId);
    if (!member)
      return res.status(404).json({ success: false, message: "Member not found" });
    if (member.status !== "Active")
      return res.status(400).json({ success: false, message: "Member account is not active" });
    if (member.fineAmount > 0)
      return res.status(400).json({ success: false, message: `Member has unpaid fine of ₹${member.fineAmount}` });

    // Check borrow limit (max 3 active borrows)
    const activeBorrows = await Transaction.countDocuments({
      member: memberId,
      status: { $in: ["Active", "Overdue"] },
    });
    if (activeBorrows >= 3)
      return res.status(400).json({ success: false, message: "Member has reached maximum borrow limit (3 books)" });

    // Validate book
    const book = await Book.findById(bookId);
    if (!book)
      return res.status(404).json({ success: false, message: "Book not found" });
    if (book.availableCopies < 1)
      return res.status(400).json({ success: false, message: "No copies available" });

    // Check not already borrowed
    const alreadyBorrowed = await Transaction.findOne({
      member: memberId,
      book: bookId,
      status: { $in: ["Active", "Overdue"] },
    });
    if (alreadyBorrowed)
      return res.status(400).json({ success: false, message: "Member already has this book borrowed" });

    // Create transaction with the authenticated user explicitly tagged as the issuer
    const transaction = new Transaction({
      member: memberId,
      book: bookId,
      type: "Borrow",
      notes,
      issuedBy: req.user._id 
    });
    await transaction.save();

    // Update book availability
    await Book.findByIdAndUpdate(bookId, {
      $inc: { availableCopies: -1 },
    });
    await Book.findByIdAndUpdate(bookId, [
      { $set: { status: { $cond: [{ $gt: ["$availableCopies", 0] }, "Available", "Out of Stock"] } } }
    ]);

    // Update member
    await Member.findByIdAndUpdate(memberId, {
      $push: { borrowedBooks: transaction._id },
      $inc: { totalBorrowed: 1 },
    });

    const populated = await Transaction.findById(transaction._id)
      .populate("member", "name memberId email")
      .populate("book", "title author isbn");

    res.status(201).json({
      success: true,
      data: populated,
      message: `"${book.title}" issued to ${member.name} successfully. Due: ${transaction.dueDate.toDateString()}`,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/transactions/return/:id ─── Return a book
router.put("/return/:id", requirePermission("returnBooks"), async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate("book")
      .populate("member");

    if (!transaction)
      return res.status(404).json({ success: false, message: "Transaction not found" });
    if (transaction.status === "Returned")
      return res.status(400).json({ success: false, message: "Book already returned" });

    const returnDate = new Date();
    transaction.returnDate = returnDate;
    transaction.type = "Return";
    transaction.status = "Returned";

    // Calculate fine
    const fine = transaction.calculateFine();
    transaction.fineAmount = fine;
    await transaction.save();

    // Update book availability
    await Book.findByIdAndUpdate(transaction.book._id, {
      $inc: { availableCopies: 1 },
      status: "Available",
    });

    // Update member fines
    if (fine > 0) {
      await Member.findByIdAndUpdate(transaction.member._id, {
        $inc: { fineAmount: fine },
      });
    }

    res.json({
      success: true,
      data: transaction,
      message: fine > 0
        ? `Book returned. Fine applied: ₹${fine}`
        : "Book returned successfully. No fine.",
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/transactions/pay-fine/:memberId ─── Pay fine
router.put("/pay-fine/:memberId", async (req, res) => {
  try {
    const member = await Member.findById(req.params.memberId);
    if (!member)
      return res.status(404).json({ success: false, message: "Member not found" });

    const fineCleared = member.fineAmount;
    await Member.findByIdAndUpdate(req.params.memberId, { fineAmount: 0 });
    await Transaction.updateMany(
      { member: req.params.memberId, finePaid: false },
      { finePaid: true }
    );

    res.json({ success: true, message: `Fine of ₹${fineCleared} cleared for ${member.name}` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;