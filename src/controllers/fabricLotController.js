const mongoose = require("mongoose");
const FabricLot = require("../models/FabricLot");
const CuttingBatch = require("../models/CuttingBatch");
const CuttingStock = require("../models/CuttingStock");
const MovementLog = require("../models/MovementLog");
const { ROLES } = require("../config/rbac");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const {
  getPaginationFromQuery,
  buildPaginationMeta,
} = require("../utils/pagination");
const STOCK_EPSILON = 0.000001;

function toNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? NaN : parsed;
}

function calculateStock(receivedKg, transferredKg) {
  const availableRaw = receivedKg - transferredKg;
  const availableKg = availableRaw > STOCK_EPSILON ? availableRaw : 0;

  if (availableKg > 0) {
    return { availableKg, status: "Available" };
  }

  return { availableKg: 0, status: "Finished" };
}

function validateStock(receivedKg, transferredKg) {
  if (Number.isNaN(receivedKg) || Number.isNaN(transferredKg)) {
    const error = new Error("quantityKg and transferredKg must be valid numbers");
    error.statusCode = 400;
    throw error;
  }

  if (receivedKg < 0 || transferredKg < 0) {
    const error = new Error("quantityKg and transferredKg cannot be negative");
    error.statusCode = 400;
    throw error;
  }

  if (transferredKg > receivedKg) {
    const error = new Error("transferredKg cannot be greater than quantityKg");
    error.statusCode = 400;
    throw error;
  }
}

function withSessionOptions() {
  return {
    readConcern: { level: "snapshot" },
    writeConcern: { w: "majority" },
  };
}

function isAdmin(req) {
  return String(req.user?.role || "").toLowerCase() === ROLES.ADMIN;
}

function ownershipFilter(req) {
  if (isAdmin(req)) return {};
  return { createdByUserId: req.user?._id || null };
}

function withCreator(lot) {
  const obj = typeof lot?.toObject === "function" ? lot.toObject() : lot;
  const creatorUser = obj?.createdByUserId && typeof obj.createdByUserId === "object" ? obj.createdByUserId : null;
  return {
    ...obj,
    createdByUser: creatorUser
      ? {
          _id: String(creatorUser._id || ""),
          name: creatorUser.name || "",
          email: creatorUser.email || "",
        }
      : null,
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getFabricBaseName(rawName) {
  return String(rawName || "")
    .trim()
    .replace(/\s*-\s*\d+\s*$/, "")
    .trim();
}

async function buildNextFabricTypeName(baseName, session) {
  const escapedBase = escapeRegex(baseName);
  const pattern = new RegExp(`^${escapedBase}\\s-\\s(\\d+)$`, "i");
  const existing = await FabricLot.find(
    { fabricType: { $regex: new RegExp(`^${escapedBase}(\\s-\\s\\d+)?$`, "i") } },
    "fabricType"
  )
    .session(session)
    .lean();

  let maxSerial = 0;
  for (const item of existing) {
    const match = String(item.fabricType || "").match(pattern);
    if (match?.[1]) {
      const serial = Number(match[1]);
      if (!Number.isNaN(serial) && serial > maxSerial) {
        maxSerial = serial;
      }
    }
  }

  const nextSerial = String(maxSerial + 1).padStart(2, "0");
  return `${baseName} - ${nextSerial}`;
}

async function recalculateExistingFabricLotStatuses() {
  const lots = await FabricLot.find(
    {},
    "_id quantityKg receivedKg transferredKg availableKg status"
  ).lean();
  if (!lots.length) return;

  const ops = [];
  for (const lot of lots) {
    const quantityKg = Number(
      lot.quantityKg !== undefined && lot.quantityKg !== null
        ? lot.quantityKg
        : lot.receivedKg || 0
    );
    const transferredKg = Number(lot.transferredKg || 0);
    const availableRaw = quantityKg - transferredKg;
    const availableKg = availableRaw > STOCK_EPSILON ? availableRaw : 0;
    const status = availableKg > 0 ? "Available" : "Finished";

    if (lot.availableKg !== availableKg || lot.status !== status) {
      ops.push({
        updateOne: {
          filter: { _id: lot._id },
          update: { $set: { availableKg, status } },
        },
      });
    }
  }

  if (ops.length) {
    await FabricLot.bulkWrite(ops, { ordered: false });
  }
}

const createFabricLot = asyncHandler(async (req, res) => {
  const {
    fabricType,
    quantityKg: rawQuantityKg,
    receivedKg: rawReceivedKg,
    transferredKg: rawTransferredKg,
    receiveDate,
  } = req.body;

  if (!fabricType) {
    const error = new Error("fabricType is required");
    error.statusCode = 400;
    throw error;
  }
  const baseName = getFabricBaseName(fabricType);
  if (!baseName) {
    const error = new Error("fabricType is required");
    error.statusCode = 400;
    throw error;
  }

  const quantityKg = toNumber(rawQuantityKg ?? rawReceivedKg, NaN);
  const transferredKg = toNumber(rawTransferredKg, 0);
  validateStock(quantityKg, transferredKg);

  const stock = calculateStock(quantityKg, transferredKg);
  const generatedFabricType = await buildNextFabricTypeName(baseName);

  const createdLot = await FabricLot.create({
    fabricType: generatedFabricType,
    quantityKg,
    transferredKg,
    availableKg: stock.availableKg,
    status: stock.status,
    receiveDate: receiveDate || new Date(),
    createdByUserId: req.user?._id || null,
    createdBy: req.user?.email || req.user?.name || "",
  });

  return sendSuccess(res, {
    status: 201,
    data: createdLot,
    message: "Fabric lot created",
  });
});

const getFabricLots = asyncHandler(async (req, res) => {
  await recalculateExistingFabricLotStatuses();
  const filter = ownershipFilter(req);
  const { page, limit, skip } = getPaginationFromQuery(req.query);
  const total = await FabricLot.countDocuments(filter);
  const lots = await FabricLot.find(filter)
    .populate("createdByUserId", "name email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return sendSuccess(res, {
    data: lots.map(withCreator),
    message: "",
    count: total,
    pagination: buildPaginationMeta({ total, page, limit }),
  });
});

const getFabricLotById = asyncHandler(async (req, res) => {
  await recalculateExistingFabricLotStatuses();
  const lot = await FabricLot.findOne({
    _id: req.params.id,
    ...ownershipFilter(req),
  }).populate("createdByUserId", "name email");

  if (!lot) {
    const error = new Error("Fabric lot not found");
    error.statusCode = 404;
    throw error;
  }

  const movementHistory = await MovementLog.find({ lot: lot._id })
    .sort({ date: -1, createdAt: -1 })
    .select("fromStage toStage quantity unit date user createdAt");

  return sendSuccess(res, {
    data: {
      lot: withCreator(lot),
      movementHistory,
    },
    message: "",
  });
});

const updateFabricLot = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let updatedLot = null;

    await (async () => {
      const lot = await FabricLot.findOne({
        _id: req.params.id,
        ...ownershipFilter(req),
      }).session(session);

      if (!lot) {
        const error = new Error("Fabric lot not found");
        error.statusCode = 404;
        throw error;
      }

      const nextReceivedKg =
        req.body.quantityKg !== undefined || req.body.receivedKg !== undefined
          ? toNumber(req.body.quantityKg ?? req.body.receivedKg, NaN)
          : lot.quantityKg;
      const nextTransferredKg =
        req.body.transferredKg !== undefined
          ? toNumber(req.body.transferredKg, NaN)
          : lot.transferredKg;

      validateStock(nextReceivedKg, nextTransferredKg);
      const stock = calculateStock(nextReceivedKg, nextTransferredKg);

      if (req.body.fabricType !== undefined) {
        lot.fabricType = req.body.fabricType;
      }
      if (req.body.receiveDate !== undefined) {
        lot.receiveDate = req.body.receiveDate;
      }

      lot.quantityKg = nextReceivedKg;
      lot.transferredKg = nextTransferredKg;
      lot.availableKg = stock.availableKg;
      lot.status = stock.status;

      await lot.save({ session });
      updatedLot = lot;
    })();

    return sendSuccess(res, {
      data: updatedLot,
      message: "Fabric lot updated",
    });
  } finally {
    session.endSession();
  }
});

const deleteFabricLot = asyncHandler(async (req, res) => {
  const deletedLot = await FabricLot.findOneAndDelete({
    _id: req.params.id,
    ...ownershipFilter(req),
  });

  if (!deletedLot) {
    const error = new Error("Fabric lot not found");
    error.statusCode = 404;
    throw error;
  }

  return sendSuccess(res, {
    data: { id: String(deletedLot._id) },
    message: "Fabric lot deleted successfully",
  });
});

const transferToCutting = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let responsePayload = null;

    await (async () => {
      const { quantityKg: rawQuantityKg, cuttingDate, notes, operatorName } = req.body;
      const quantityKg = toNumber(rawQuantityKg, NaN);
      const effectiveOperatorName =
        operatorName || req.user?.name || req.user?.email || "system";

      if (Number.isNaN(quantityKg) || quantityKg <= 0) {
        const error = new Error("quantityKg must be a positive number");
        error.statusCode = 400;
        throw error;
      }

      const lotQuery = {
        _id: req.params.id,
        ...ownershipFilter(req),
      };
      const lot = await FabricLot.findOne(lotQuery).session(session);
      if (!lot) {
        const error = new Error("Fabric lot not found");
        error.statusCode = 404;
        throw error;
      }

      if (quantityKg > lot.availableKg) {
        const error = new Error("Cannot transfer more than available quantity");
        error.statusCode = 400;
        throw error;
      }

      const nextTransferredKg = lot.transferredKg + quantityKg;
      validateStock(lot.quantityKg, nextTransferredKg);
      const stock = calculateStock(lot.quantityKg, nextTransferredKg);

      lot.transferredKg = nextTransferredKg;
      lot.availableKg = stock.availableKg;
      lot.status = stock.status;
      await lot.save({ session });

      let cuttingBatch = await CuttingBatch.findOne({
        fabricLotId: lot._id,
        isDeleted: { $ne: true },
      }).session(session);
      if (!cuttingBatch) {
        const createdDocs = await CuttingBatch.create(
          [
            {
              fabricLotId: lot._id,
              fabricType: lot.fabricType,
              quantityKg,
              batchDate: cuttingDate || new Date(),
              operatorName: effectiveOperatorName,
              notes: notes || "",
              createdBy: req.user?.email || effectiveOperatorName,
              transferHistory: [
                {
                  quantityKg,
                  transferDate: cuttingDate || new Date(),
                  notes: notes || "",
                  by: req.user?.email || effectiveOperatorName,
                },
              ],
            },
          ],
          { session }
        );
        cuttingBatch = createdDocs[0];
      } else {
        cuttingBatch.quantityKg += quantityKg;
        cuttingBatch.fabricType = lot.fabricType;
        cuttingBatch.batchDate = cuttingDate || new Date();
        cuttingBatch.notes = notes || cuttingBatch.notes || "";
        cuttingBatch.transferHistory.push({
          quantityKg,
          transferDate: cuttingDate || new Date(),
          notes: notes || "",
          by: req.user?.email || effectiveOperatorName,
        });
        await cuttingBatch.save({ session });
      }

      const cuttingStock = await CuttingStock.findOne({ fabricLotId: lot._id }).session(
        session
      );
      if (!cuttingStock) {
        await CuttingStock.create(
          [
            {
              fabricLotId: lot._id,
              fabricType: lot.fabricType,
              currentKg: quantityKg,
              totalReceivedKg: quantityKg,
              lastReceivedDate: cuttingDate || new Date(),
              lastOperatorName: effectiveOperatorName,
            },
          ],
          { session }
        );
      } else {
        cuttingStock.currentKg += quantityKg;
        cuttingStock.totalReceivedKg += quantityKg;
        cuttingStock.lastReceivedDate = cuttingDate || new Date();
        cuttingStock.lastOperatorName = effectiveOperatorName;
        await cuttingStock.save({ session });
      }

      const movementLogDocs = await MovementLog.create(
        [
          {
            fromStage: "fabric_inventory",
            toStage: "cutting",
            lot: lot._id,
            quantity: quantityKg,
            unit: "kg",
            date: cuttingDate || new Date(),
            user: req.user?.email || effectiveOperatorName,
          },
        ],
        { session }
      );

      responsePayload = {
        fabricLot: lot,
        cuttingBatch,
        movementLog: movementLogDocs[0],
      };
    })();

    return sendSuccess(res, {
      data: responsePayload,
      message: "Transferred to cutting successfully",
    });
  } finally {
    session.endSession();
  }
});

module.exports = {
  createFabricLot,
  getFabricLots,
  getFabricLotById,
  updateFabricLot,
  deleteFabricLot,
  transferToCutting,
};
