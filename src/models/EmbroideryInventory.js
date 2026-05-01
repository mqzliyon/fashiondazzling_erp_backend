const mongoose = require("mongoose");

const embroideryInventorySchema = new mongoose.Schema(
  {
    lot: {
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
    availablePieces: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalReceivedPieces: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalRejectedPieces: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalSentOfficePieces: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalSentExportPieces: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalSentFactoryPieces: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    lastUpdatedDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    createdBy: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    archivedBy: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const EmbroideryInventory = mongoose.model("EmbroideryInventory", embroideryInventorySchema);

module.exports = EmbroideryInventory;
