const mongoose = require("mongoose");

const cuttingBatchSchema = new mongoose.Schema(
  {
    fabricLotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FabricLot",
      required: true,
      index: true,
    },
    fabricType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    quantityKg: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    batchDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    operatorName: {
      type: String,
      required: true,
      trim: true,
      default: "system",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    transferHistory: {
      type: [
        {
          quantityKg: { type: Number, required: true, min: 0.0001 },
          transferDate: { type: Date, required: true, default: Date.now },
          notes: { type: String, trim: true, default: "" },
          by: { type: String, trim: true, default: "system" },
        },
      ],
      default: [],
    },
    conversionHistory: {
      type: [
        {
          convertedKg: { type: Number, required: true, min: 0.0001 },
          outputPieces: { type: Number, required: true, min: 0.0001 },
          yieldRatio: { type: Number, required: true, min: 0.0001 },
          completionDate: { type: Date, required: true, default: Date.now },
          notes: { type: String, trim: true, default: "" },
          sentPieces: { type: Number, min: 0, default: 0 },
          conversionId: { type: mongoose.Schema.Types.ObjectId, ref: "CuttingConversion" },
          pieceLotId: { type: mongoose.Schema.Types.ObjectId, ref: "PieceLot" },
        },
      ],
      default: [],
    },
    createdBy: {
      type: String,
      trim: true,
      default: "system",
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const CuttingBatch = mongoose.model("CuttingBatch", cuttingBatchSchema);

module.exports = CuttingBatch;
