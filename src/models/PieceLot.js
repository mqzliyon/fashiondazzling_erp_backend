const mongoose = require("mongoose");

const pieceLotSchema = new mongoose.Schema(
  {
    lotNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    fabricLotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FabricLot",
      required: false,
      index: true,
      default: null,
    },
    cuttingBatchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CuttingBatch",
      required: false,
      index: true,
      default: null,
    },
    fabricType: {
      type: String,
      trim: true,
      default: "Manual",
      index: true,
    },
    fabricSource: {
      type: String,
      enum: ["Manual", "Cutting Conversion"],
      default: "Manual",
      index: true,
    },
    convertedKg: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    outputPieces: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    sentToEmbroideryPieces: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    receivedFromCompletePieces: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    yieldRatio: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    completionDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
      default: null,
    },
    status: {
      type: String,
      enum: ["Available", "Sent to Embroidery"],
      default: "Available",
      index: true,
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
  { timestamps: true }
);

const PieceLot = mongoose.model("PieceLot", pieceLotSchema);

module.exports = PieceLot;
