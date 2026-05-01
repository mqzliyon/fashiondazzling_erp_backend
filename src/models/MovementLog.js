const mongoose = require("mongoose");

const movementLogSchema = new mongoose.Schema(
  {
    fromStage: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    toStage: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    lot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FabricLot",
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
      default: "kg",
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    user: {
      type: String,
      required: true,
      trim: true,
      default: "system",
    },
  },
  {
    timestamps: true,
  }
);

const MovementLog = mongoose.model("MovementLog", movementLogSchema);

module.exports = MovementLog;
