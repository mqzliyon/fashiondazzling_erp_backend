const mongoose = require("mongoose");

const foreignShipmentSchema = new mongoose.Schema(
  {
    country: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    buyerName: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    buyerPhone: {
      type: String,
      trim: true,
      default: "",
    },
    shipmentNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true,
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
      min: 1,
    },
    shipmentDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["Packed", "Dispatched", "In Transit", "Delivered"],
      default: "Packed",
      index: true,
    },
    source: {
      type: String,
      enum: ["embroidery", "factory_warehouse"],
      default: "embroidery",
      index: true,
    },
    grade: {
      type: String,
      enum: ["A Grade", "B Grade", ""],
      default: "",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const ForeignShipment = mongoose.model("ForeignShipment", foreignShipmentSchema);

module.exports = ForeignShipment;
