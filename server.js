require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/library_management";
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "public")));
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

app.use("/api/auth", require("./routes/auth"));
app.use("/api/books", require("./routes/books"));
app.use("/api/members", require("./routes/members"));
app.use("/api/transactions", require("./routes/transactions"));

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Library Management System API is running",
    mongoStatus: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    timestamp: new Date().toISOString(),
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

app.listen(PORT, () => {
  console.log(`
  🏛️  Library Management System
  ─────────────────────────────
  🚀 Server running on    : http://localhost:${PORT}
  📚 API base URL         : http://localhost:${PORT}/api
  🗄️  MongoDB URI          : ${MONGODB_URI}
  
  📖 API Endpoints:
     GET    /api/health
     GET    /api/books
     POST   /api/books
     PUT    /api/books/:id
     DELETE /api/books/:id
     GET    /api/members
     POST   /api/members
     PUT    /api/members/:id
     DELETE /api/members/:id
     GET    /api/transactions
     POST   /api/transactions/borrow
     PUT    /api/transactions/return/:id
  `);
});

module.exports = app;
