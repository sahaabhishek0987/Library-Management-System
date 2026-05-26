require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/library_management";

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Serve static frontend files
app.use(express.static(path.join(__dirname, "public")));

// ─── MongoDB Connection ───────────────────────────────────────
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB connected:", MONGODB_URI);
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️  MongoDB disconnected");
});

// ─── API Routes ───────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));
app.use("/api/books", require("./routes/books"));
app.use("/api/members", require("./routes/members"));
app.use("/api/transactions", require("./routes/transactions"));

// ─── Health Check ─────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Library Management System API is running",
    mongoStatus: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    timestamp: new Date().toISOString(),
  });
});

// ─── Temporary Setup Route (seed admin + data) ────────────────
app.get("/api/setup", async (req, res) => {
  try {
    const User = require("./models/User");
    const Book = require("./models/Book");
    const Member = require("./models/Member");

    // Clear existing data
    await User.deleteMany({});
    await Book.deleteMany({});
    await Member.deleteMany({});

    // Create Admin
    const admin = new User({
      username: "admin",
      password: "admin123",
      fullName: "Library Administrator",
      email: "admin@library.com",
      role: "admin",
    });
    await admin.save();

    // Create Issuer
    const issuer = new User({
      username: "issuer1",
      password: "issuer123",
      fullName: "Rajesh Kumar",
      email: "rajesh@library.com",
      phone: "+91 9876540001",
      role: "issuer",
      createdBy: admin._id,
      permissions: {
        manageBooks: true,
        manageMembers: false,
        issueBooks: true,
        returnBooks: true,
        viewReports: false,
      },
    });
    await issuer.save();

    // Create Books
    const sampleBooks = [
      { title: "The Great Gatsby", author: "F. Scott Fitzgerald", isbn: "978-0743273565", category: "Fiction", publisher: "Scribner", publishedYear: 1925, totalCopies: 5, availableCopies: 5, pages: 180, language: "English" },
      { title: "To Kill a Mockingbird", author: "Harper Lee", isbn: "978-0061935466", category: "Fiction", publisher: "Harper Perennial", publishedYear: 1960, totalCopies: 4, availableCopies: 4, pages: 336, language: "English" },
      { title: "A Brief History of Time", author: "Stephen Hawking", isbn: "978-0553380163", category: "Science", publisher: "Bantam Books", publishedYear: 1988, totalCopies: 3, availableCopies: 3, pages: 212, language: "English" },
      { title: "The Pragmatic Programmer", author: "David Thomas", isbn: "978-0135957059", category: "Technology", publisher: "Addison-Wesley", publishedYear: 2019, totalCopies: 6, availableCopies: 6, pages: 352, language: "English" },
      { title: "Sapiens", author: "Yuval Noah Harari", isbn: "978-0062316097", category: "History", publisher: "Harper", publishedYear: 2015, totalCopies: 4, availableCopies: 4, pages: 443, language: "English" },
      { title: "Steve Jobs", author: "Walter Isaacson", isbn: "978-1451648539", category: "Biography", publisher: "Simon & Schuster", publishedYear: 2011, totalCopies: 3, availableCopies: 3, pages: 656, language: "English" },
      { title: "Harry Potter and the Philosopher's Stone", author: "J.K. Rowling", isbn: "978-0439708180", category: "Fiction", publisher: "Scholastic", publishedYear: 1997, totalCopies: 8, availableCopies: 8, pages: 309, language: "English" },
      { title: "Clean Code", author: "Robert C. Martin", isbn: "978-0132350884", category: "Technology", publisher: "Prentice Hall", publishedYear: 2008, totalCopies: 5, availableCopies: 5, pages: 431, language: "English" },
      { title: "The Republic", author: "Plato", isbn: "978-0140455113", category: "Philosophy", publisher: "Penguin Classics", publishedYear: 380, totalCopies: 2, availableCopies: 2, pages: 448, language: "English" },
      { title: "1984", author: "George Orwell", isbn: "978-0451524935", category: "Fiction", publisher: "Signet Classic", publishedYear: 1949, totalCopies: 6, availableCopies: 6, pages: 328, language: "English" },
    ];
    await Book.insertMany(sampleBooks);

    // Create Members
    const sampleMembers = [
      { name: "Arjun Sharma", email: "arjun.sharma@email.com", phone: "+91 9876543210", membershipType: "Standard" },
      { name: "Priya Patel", email: "priya.patel@email.com", phone: "+91 9876543211", membershipType: "Premium" },
      { name: "Rahul Kumar", email: "rahul.kumar@email.com", phone: "+91 9876543212", membershipType: "Student" },
      { name: "Sneha Reddy", email: "sneha.reddy@email.com", phone: "+91 9876543213", membershipType: "Standard" },
      { name: "Vikram Singh", email: "vikram.singh@email.com", phone: "+91 9876543214", membershipType: "Senior" },
    ];
    for (const m of sampleMembers) {
      await new Member(m).save();
    }

    res.json({
      success: true,
      message: "✅ Database seeded! Admin: admin/admin123 | Issuer: issuer1/issuer123. REMOVE THIS ROUTE NOW.",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Serve Frontend for all other routes ─────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ─── Start Server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  🏛️  Library Management System
  ─────────────────────────────
  🚀 Server running on    : http://localhost:${PORT}
  📚 API base URL         : http://localhost:${PORT}/api
  🗄️  MongoDB URI          : ${MONGODB_URI}
  `);
});

module.exports = app;
