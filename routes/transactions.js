const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");
const Book = require("../models/Book");
const Member = require("../models/Member");
const { protect, requirePermission } = require("../middleware/auth");
router.use(protect);
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
router.post("/borrow", requirePermission("issueBooks"), async (req, res) => {
  try {
    const { memberId, bookId, notes } = req.body;
    const member = await Member.findById(memberId);
    if (!member)
      return res.status(404).json({ success: false, message: "Member not found" });
    if (member.status !== "Active")
      return res.status(400).json({ success: false, message: "Member account is not active" });
    if (member.fineAmount > 0)
      return res.status(400).json({ success: false, message: `Member has unpaid fine of ₹${member.fineAmount}` });
    const activeBorrows = await Transaction.countDocuments({
      member: memberId,
      status: { $in: ["Active", "Overdue"] },
    });
    if (activeBorrows >= 3)
      return res.status(400).json({ success: false, message: "Member has reached maximum borrow limit (3 books)" });
    const book = await Book.findById(bookId);
    if (!book)
      return res.status(404).json({ success: false, message: "Book not found" });
    if (book.availableCopies < 1)
      return res.status(400).json({ success: false, message: "No copies available" });
    const alreadyBorrowed = await Transaction.findOne({
      member: memberId,
      book: bookId,
      status: { $in: ["Active", "Overdue"] },
    });
    if (alreadyBorrowed)
      return res.status(400).json({ success: false, message: "Member already has this book borrowed" });
    const transaction = new Transaction({
      member: memberId,
      book: bookId,
      type: "Borrow",
      notes,
      issuedBy: req.user._id 
    });
    await transaction.save();
    await Book.findByIdAndUpdate(bookId, {
      $inc: { availableCopies: -1 },
    });
    await Book.findByIdAndUpdate(bookId, [
      { $set: { status: { $cond: [{ $gt: ["$availableCopies", 0] }, "Available", "Out of Stock"] } } }
    ]);
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
    const fine = transaction.calculateFine();
    transaction.fineAmount = fine;
    await transaction.save();
    await Book.findByIdAndUpdate(transaction.book._id, {
      $inc: { availableCopies: 1 },
      status: "Available",
    });
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
