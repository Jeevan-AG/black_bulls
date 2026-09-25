const mongoose = require("mongoose");

const CompanySchema = new mongoose.Schema(
  {
    companyDomain: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    adminEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Company", CompanySchema);
