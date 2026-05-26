const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema(
  {
    memberId: {
      type: String,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, "Member name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[+\d\s\-()]{7,20}$/, "Please enter a valid phone number"],
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      zipCode: { type: String, trim: true },
    },
    membershipType: {
      type: String,
      enum: ["Standard", "Premium", "Student", "Senior"],
      default: "Standard",
    },
    membershipExpiry: {
      type: Date,
      default: () => {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        return d;
      },
    },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Suspended"],
      default: "Active",
    },
    borrowedBooks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Transaction",
      },
    ],
    totalBorrowed: {
      type: Number,
      default: 0,
    },
    fineAmount: {
      type: Number,
      default: 0,
      min: [0, "Fine amount cannot be negative"],
    },
    joinDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate member ID
memberSchema.pre("save", async function (next) {
  if (!this.memberId) {
    const count = await mongoose.model("Member").countDocuments();
    this.memberId = `LIB${String(count + 1001).padStart(5, "0")}`;
  }
  next();
});

module.exports = mongoose.model("Member", memberSchema);
