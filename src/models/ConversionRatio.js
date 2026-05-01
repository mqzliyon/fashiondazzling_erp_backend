const mongoose = require("mongoose");

const conversionRatioSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    piecesPerKg: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    fabricType: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
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

const ConversionRatio = mongoose.model("ConversionRatio", conversionRatioSchema);

module.exports = ConversionRatio;
