require("dotenv").config();
const mongoose = require("mongoose");
const Book = require("./models/Book");
const Member = require("./models/Member");
const User = require("./models/User");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/library_management";

const sampleBooks = [
  { title: "The Great Gatsby", author: "F. Scott Fitzgerald", isbn: "978-0743273565", category: "Fiction", publisher: "Scribner", publishedYear: 1925, totalCopies: 5, availableCopies: 5, description: "A story of the mysteriously wealthy Jay Gatsby and his love for the beautiful Daisy Buchanan.", pages: 180, language: "English" },
  { title: "To Kill a Mockingbird", author: "Harper Lee", isbn: "978-0061935466", category: "Fiction", publisher: "Harper Perennial", publishedYear: 1960, totalCopies: 4, availableCopies: 4, description: "The story of racial injustice and the loss of innocence in the American South.", pages: 336, language: "English" },
  { title: "A Brief History of Time", author: "Stephen Hawking", isbn: "978-0553380163", category: "Science", publisher: "Bantam Books", publishedYear: 1988, totalCopies: 3, availableCopies: 3, description: "A landmark volume in science writing by one of the great minds of our time.", pages: 212, language: "English" },
  { title: "The Pragmatic Programmer", author: "David Thomas", isbn: "978-0135957059", category: "Technology", publisher: "Addison-Wesley", publishedYear: 2019, totalCopies: 6, availableCopies: 6, description: "Your journey to mastery in software development.", pages: 352, language: "English" },
  { title: "Sapiens: A Brief History of Humankind", author: "Yuval Noah Harari", isbn: "978-0062316097", category: "History", publisher: "Harper", publishedYear: 2015, totalCopies: 4, availableCopies: 4, description: "How Homo sapiens came to rule the world.", pages: 443, language: "English" },
  { title: "Steve Jobs", author: "Walter Isaacson", isbn: "978-1451648539", category: "Biography", publisher: "Simon & Schuster", publishedYear: 2011, totalCopies: 3, availableCopies: 3, description: "The exclusive biography of Steve Jobs.", pages: 656, language: "English" },
  { title: "Harry Potter and the Philosopher's Stone", author: "J.K. Rowling", isbn: "978-0439708180", category: "Fiction", publisher: "Scholastic", publishedYear: 1997, totalCopies: 8, availableCopies: 8, description: "The first book in the beloved Harry Potter series.", pages: 309, language: "English" },
  { title: "Clean Code", author: "Robert C. Martin", isbn: "978-0132350884", category: "Technology", publisher: "Prentice Hall", publishedYear: 2008, totalCopies: 5, availableCopies: 5, description: "A handbook of agile software craftsmanship.", pages: 431, language: "English" },
  { title: "The Republic", author: "Plato", isbn: "978-0140455113", category: "Philosophy", publisher: "Penguin Classics", publishedYear: 380, totalCopies: 2, availableCopies: 2, description: "Plato's masterwork on justice and ideal society.", pages: 448, language: "English" },
  { title: "1984", author: "George Orwell", isbn: "978-0451524935", category: "Fiction", publisher: "Signet Classic", publishedYear: 1949, totalCopies: 6, availableCopies: 6, description: "A dystopian social science fiction novel.", pages: 328, language: "English" },
];

const sampleMembers = [
  { name: "Arjun Sharma", email: "arjun.sharma@email.com", phone: "+91 9876543210", membershipType: "Standard", address: { city: "Kolkata", state: "West Bengal" } },
  { name: "Priya Patel", email: "priya.patel@email.com", phone: "+91 9876543211", membershipType: "Premium", address: { city: "Mumbai", state: "Maharashtra" } },
  { name: "Rahul Kumar", email: "rahul.kumar@email.com", phone: "+91 9876543212", membershipType: "Student", address: { city: "Delhi", state: "Delhi" } },
  { name: "Sneha Reddy", email: "sneha.reddy@email.com", phone: "+91 9876543213", membershipType: "Standard", address: { city: "Hyderabad", state: "Telangana" } },
  { name: "Vikram Singh", email: "vikram.singh@email.com", phone: "+91 9876543214", membershipType: "Senior", address: { city: "Jaipur", state: "Rajasthan" } },
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB connected");

    await Book.deleteMany({});
    await Member.deleteMany({});
    await User.deleteMany({});
    console.log("🗑️  Cleared existing data");



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
    console.log("📋 Issuer created → username: issuer1 | password: issuer123");

    const books = await Book.insertMany(sampleBooks);
    console.log(`📚 Inserted ${books.length} books`);

    for (const m of sampleMembers) {
      await new Member(m).save();
    }
    console.log(`👥 Inserted ${sampleMembers.length} members`);

    console.log(`

    `);
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  }
}
seed();
