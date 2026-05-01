const mongoose = require("mongoose");

const rejectManagementSchema = new mongoose.Schema(
  {
    lot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FabricLot",
      required: true,
      index: true,
    },
    stage: {
      type: String,
      required: true,
      enum: ["cutting", "embroidery"],
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    reason: {
      type: String,
      trim: true,
      default: "",
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const RejectManagement = mongoose.model("RejectManagement", rejectManagementSchema);

module.exports = RejectManagement;
