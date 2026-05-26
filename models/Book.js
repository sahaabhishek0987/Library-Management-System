const mongoose = require("mongoose");
const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Book title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    author: {
      type: String,
      required: [true, "Author name is required"],
      trim: true,
    },
    isbn: {
      type: String,
      required: [true, "ISBN is required"],
      unique: true,
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: [
        "Fiction",
        "Non-Fiction",
        "Science",
        "Technology",
        "History",
        "Biography",
        "Children",
        "Poetry",
        "Philosophy",
        "Arts",
        "Religion",
        "Travel",
        "Other",
      ],
    },
    publisher: {
      type: String,
      trim: true,
    },
    publishedYear: {
      type: Number,
      min: [1, "Invalid year"],
      max: [new Date().getFullYear(), "Year cannot be in the future"],
    },
    totalCopies: {
      type: Number,
      required: [true, "Total copies required"],
      min: [0, "Must have at least 0 copies"],
      default: 1,
    },
    availableCopies: {
      type: Number,
      default: function () {
        return this.totalCopies;
      },
      min: [0, "Available copies cannot be negative"],
    },
    description: {
      type: String,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    coverImage: {
      type: String,
      default: "",
    },
    language: {
      type: String,
      default: "English",
    },
    pages: {
      type: Number,
      min: [1, "Pages must be at least 1"],
    },
    status: {
      type: String,
      enum: ["Available", "Out of Stock"],
      default: "Available",
    },
  },
  {
    timestamps: true,
  }
);
bookSchema.pre("save", function (next) {
  this.status = this.availableCopies > 0 ? "Available" : "Out of Stock";
  next();
});
bookSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  if (update.availableCopies !== undefined) {
    update.status = update.availableCopies > 0 ? "Available" : "Out of Stock";
  }
  next();
});
module.exports = mongoose.model("Book", bookSchema);
