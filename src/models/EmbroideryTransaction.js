const mongoose = require("mongoose");

const embroideryTransactionSchema = new mongoose.Schema(
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
      required: false,
      index: true,
    },
    actionType: {
      type: String,
      required: true,
      enum: [
        "receive_from_cutting",
        "reject",
        "send_to_office",
        "send_to_export",
        "send_to_factory_warehouse",
        "return_from_factory_warehouse",
      ],
      index: true,
    },
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
    pieces: {
      type: Number,
      required: true,
      min: 1,
    },
    reason: {
      type: String,
      trim: true,
      default: "",
    },
    grade: {
      type: String,
      enum: ["A Grade", "B Grade", ""],
      default: "",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
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

const EmbroideryTransaction = mongoose.model(
  "EmbroideryTransaction",
  embroideryTransactionSchema
);

module.exports = EmbroideryTransaction;
