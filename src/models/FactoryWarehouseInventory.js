const mongoose = require("mongoose");

const factoryWarehouseInventorySchema = new mongoose.Schema(
  {
    lot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FabricLot",
      required: true,
      index: true,
    },
    grade: {
      type: String,
      enum: ["A Grade", "B Grade"],
      required: true,
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
    lastUpdatedDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

factoryWarehouseInventorySchema.index({ lot: 1, grade: 1 }, { unique: true });

const FactoryWarehouseInventory = mongoose.model(
  "FactoryWarehouseInventory",
  factoryWarehouseInventorySchema
);

module.exports = FactoryWarehouseInventory;
