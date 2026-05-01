const mongoose = require("mongoose");

const cuttingConversionSchema = new mongoose.Schema(
  {
    lot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FabricLot",
      required: true,
      index: true,
    },
    cuttingBatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CuttingBatch",
      required: false,
      index: true,
    },
    inputKg: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    outputPieces: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    conversionRatio: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    ratioRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConversionRatio",
      required: false,
      index: true,
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

const CuttingConversion = mongoose.model("CuttingConversion", cuttingConversionSchema);

module.exports = CuttingConversion;
