const mongoose = require("mongoose");
const STOCK_EPSILON = 0.000001;

const fabricLotSchema = new mongoose.Schema(
  {
    fabricType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    quantityKg: {
      type: Number,
      required: true,
      min: 0,
    },
    availableKg: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    transferredKg: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Available", "Finished"],
      default: "Available",
      index: true,
    },
    receiveDate: {
      type: Date,
      required: true,
    },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
      default: null,
    },
    createdBy: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

function calculateLotStock(receivedKg, transferredKg) {
  const availableRaw = receivedKg - transferredKg;
  const availableKg = availableRaw > STOCK_EPSILON ? availableRaw : 0;

  if (availableKg > 0) {
    return { availableKg, status: "Available" };
  }

  return { availableKg: 0, status: "Finished" };
}

// Keep stock fields consistent regardless of where updates are made.
fabricLotSchema.pre("validate", function syncStock() {
  if (this.quantityKg < 0 || this.transferredKg < 0) {
    const error = new Error("quantityKg and transferredKg cannot be negative");
    error.statusCode = 400;
    throw error;
  }

  if (this.transferredKg > this.quantityKg) {
    const error = new Error("transferredKg cannot be greater than quantityKg");
    error.statusCode = 400;
    throw error;
  }

  const stock = calculateLotStock(this.quantityKg, this.transferredKg);
  this.availableKg = stock.availableKg;
  this.status = stock.status;
});

const FabricLot = mongoose.model("FabricLot", fabricLotSchema);

module.exports = FabricLot;
