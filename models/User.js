const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [30, "Username cannot exceed 30 characters"],
      match: [/^[a-z0-9_]+$/, "Username can only contain lowercase letters, numbers, and underscores"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // never return password by default
    },
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"],
    },
    role: {
      type: String,
      enum: ["admin", "issuer"],
      default: "issuer",
    },
    employeeId: {
      type: String,
      unique: true,
      sparse: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: {
      type: Date,
    },
    permissions: {
      manageBooks: { type: Boolean, default: true },
      manageMembers: { type: Boolean, default: false },
      issueBooks: { type: Boolean, default: true },
      returnBooks: { type: Boolean, default: true },
      viewReports: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate employee ID
userSchema.pre("save", async function (next) {
  if (!this.employeeId) {
    const count = await mongoose.model("User").countDocuments();
    const prefix = this.role === "admin" ? "ADM" : "ISS";
    this.employeeId = `${prefix}${String(count + 1001).padStart(4, "0")}`;
  }
  next();
});

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if account is locked
userSchema.methods.isLocked = function () {
  return this.lockedUntil && this.lockedUntil > Date.now();
};

// Default issuer permissions
userSchema.pre("save", function (next) {
  if (this.isNew && this.role === "admin") {
    this.permissions = {
      manageBooks: true,
      manageMembers: true,
      issueBooks: true,
      returnBooks: true,
      viewReports: true,
    };
  }
  next();
});

module.exports = mongoose.model("User", userSchema);
