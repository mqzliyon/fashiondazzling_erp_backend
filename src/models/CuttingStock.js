const mongoose = require("mongoose");

const cuttingStockSchema = new mongoose.Schema(
  {
    fabricLotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FabricLot",
      required: true,
      unique: true,
      index: true,
    },
    fabricType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    currentKg: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalReceivedKg: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    lastReceivedDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastOperatorName: {
      type: String,
      trim: true,
      default: "system",
    },
  },
  {
    timestamps: true,
  }
);

const CuttingStock = mongoose.model("CuttingStock", cuttingStockSchema);

module.exports = CuttingStock;
