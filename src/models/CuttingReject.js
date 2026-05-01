const mongoose = require("mongoose");

const cuttingRejectSchema = new mongoose.Schema(
  {
    lot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FabricLot",
      required: true,
      index: true,
    },
    conversion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CuttingConversion",
      required: true,
      index: true,
    },
    rejectedPieces: {
      type: Number,
      required: true,
      min: 1,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    operatorName: {
      type: String,
      trim: true,
      default: "system",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const CuttingReject = mongoose.model("CuttingReject", cuttingRejectSchema);

module.exports = CuttingReject;
