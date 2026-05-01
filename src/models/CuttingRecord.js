const mongoose = require("mongoose");

const cuttingRecordSchema = new mongoose.Schema(
  {
    fabricLotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FabricLot",
      required: true,
      index: true,
    },
    lotNumber: {
      type: String,
      required: true,
      trim: true,
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
    cuttingDate: {
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

const CuttingRecord = mongoose.model("CuttingRecord", cuttingRecordSchema);

module.exports = CuttingRecord;
