const mongoose = require("mongoose");

const stockMovementLogSchema = new mongoose.Schema(
  {
    movementType: {
      type: String,
      required: true,
      enum: ["transfer_to_cutting"],
      index: true,
    },
    fabricLotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FabricLot",
      required: true,
      index: true,
    },
    quantityKg: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    beforeAvailableKg: {
      type: Number,
      required: true,
      min: 0,
    },
    afterAvailableKg: {
      type: Number,
      required: true,
      min: 0,
    },
    referenceType: {
      type: String,
      required: true,
      enum: ["cutting_record"],
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    movementDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const StockMovementLog = mongoose.model("StockMovementLog", stockMovementLogSchema);

module.exports = StockMovementLog;
