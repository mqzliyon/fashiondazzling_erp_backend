const mongoose = require("mongoose");

const rejectInventorySchema = new mongoose.Schema(
  {
    lot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FabricLot",
      required: true,
      unique: true,
      index: true,
    },
    totalRejectedPieces: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    lastRejectDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastReason: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const RejectInventory = mongoose.model("RejectInventory", rejectInventorySchema);

module.exports = RejectInventory;
