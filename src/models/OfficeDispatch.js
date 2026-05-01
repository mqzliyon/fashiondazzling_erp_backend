const mongoose = require("mongoose");

const officeDispatchSchema = new mongoose.Schema(
  {
    office: {
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
      min: 1,
    },
    dispatchDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    referenceNo: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["dispatched", "received", "cancelled"],
      default: "dispatched",
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

const OfficeDispatch = mongoose.model("OfficeDispatch", officeDispatchSchema);

module.exports = OfficeDispatch;
