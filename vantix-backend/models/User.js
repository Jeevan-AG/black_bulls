const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    isFirstLogin: {
      type: Boolean,
      default: true,
    },
    role: {
      type: String,
      enum: ["admin", "employee"],
      default: "employee",
    },
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: function () { return this.role === 'employee'; }
    },
    isOnline: { type: Boolean, default: false },
    lastActive: { type: Date, default: Date.now },
    currentApp: { type: String, default: "" },
    isAuthorized: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", UserSchema);
