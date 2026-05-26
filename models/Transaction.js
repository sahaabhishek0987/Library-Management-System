const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      unique: true,
      default: () => "TXN-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
    },
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
    },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["Borrow", "Return"],
      default: "Borrow",
    },
    borrowDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      default: () => {
        const date = new Date();
        date.setDate(date.getDate() + 14); // 14 days default borrowing period
        return date;
      },
    },
    returnDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["Active", "Returned", "Overdue"],
      default: "Active",
    },
    fineAmount: {
      type: Number,
      default: 0,
    },
    finePaid: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Method to calculate fine based on Rs 5 per day overdue
transactionSchema.methods.calculateFine = function () {
  if (this.status === "Returned" && this.returnDate <= this.dueDate) return 0;
  
  const endDate = this.returnDate || new Date();
  if (endDate <= this.dueDate) return 0;
  
  const daysOverdue = Math.ceil((endDate - this.dueDate) / (1000 * 60 * 60 * 24));
  return daysOverdue > 0 ? daysOverdue * 5 : 0; 
};

module.exports = mongoose.model("Transaction", transactionSchema);