const mongoose = require("mongoose");
const FabricLot = require("../models/FabricLot");
const CuttingBatch = require("../models/CuttingBatch");
const CuttingStock = require("../models/CuttingStock");
const CuttingConversion = require("../models/CuttingConversion");
const MovementLog = require("../models/MovementLog");
const PieceLot = require("../models/PieceLot");
const { isAdminUser, getOwnedFabricLotIds } = require("../utils/ownership");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const {
  getPaginationFromQuery,
  buildPaginationMeta,
  paginateArray,
} = require("../utils/pagination");
const STOCK_EPSILON = 0.000001;

function withSessionOptions() {
  return {
    readConcern: { level: "snapshot" },
    writeConcern: { w: "majority" },
  };
}

function calculateFabricStock(receivedKg, transferredKg) {
  const availableRaw = receivedKg - transferredKg;
  const availableKg = availableRaw > STOCK_EPSILON ? availableRaw : 0;
  if (availableKg > 0) {
    return { availableKg, status: "Available" };
  }
  return { availableKg: 0, status: "Finished" };
}

function getLotQuantityKg(lot) {
  if (lot.quantityKg !== undefined && lot.quantityKg !== null) {
    return Number(lot.quantityKg);
  }
  return Number(lot.receivedKg || 0);
}

function toNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? NaN : parsed;
}

async function getLotConversionStats(lotIds) {
  if (!lotIds.length) {
    return new Map();
  }

  const stats = await CuttingConversion.aggregate([
    { $match: { lot: { $in: lotIds } } },
    {
      $group: {
        _id: "$lot",
        convertedKg: { $sum: "$inputKg" },
        outputPieces: { $sum: "$outputPieces" },
      },
    },
  ]);

  const map = new Map();
  for (const row of stats) {
    const convertedKg = Number(row.convertedKg || 0);
    const outputPieces = Number(row.outputPieces || 0);
    map.set(String(row._id), {
      convertedKg,
      outputPieces,
      yieldRatio: convertedKg > 0 ? Number((outputPieces / convertedKg).toFixed(4)) : 0,
    });
  }
  return map;
}

function getBatchConversionStats(batch) {
  const history = Array.isArray(batch.conversionHistory) ? batch.conversionHistory : [];
  const convertedKg = history.reduce((sum, item) => sum + Number(item.convertedKg || 0), 0);
  const outputPieces = history.reduce((sum, item) => sum + Number(item.outputPieces || 0), 0);
  const remainingKg = Math.max(Number(batch.quantityKg || 0) - convertedKg, 0);
  const yieldRatio = convertedKg > 0 ? Number((outputPieces / convertedKg).toFixed(4)) : 0;
  return { convertedKg, outputPieces, remainingKg, yieldRatio };
}

async function generatePieceLotNumber(session, completionDate) {
  const date = completionDate || new Date();
  const year = date.getFullYear();
  const start = new Date(`${year}-01-01T00:00:00.000Z`);
  const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);

  const count = await PieceLot.countDocuments({
    completionDate: { $gte: start, $lt: end },
  }).session(session);

  return `LOT-${year}-${String(count + 1).padStart(4, "0")}`;
}

const receiveTransferredFabric = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let responsePayload = null;

    await (async () => {
      const ownedLotIds = await getOwnedFabricLotIds(req);
      const { fabricLotId, quantityKg, transferDate, operatorName, notes } = req.body;
      if (!isAdminUser(req) && !(ownedLotIds || []).some((id) => String(id) === String(fabricLotId))) {
        const error = new Error("Fabric lot not found");
        error.statusCode = 404;
        throw error;
      }
      const effectiveOperatorName = operatorName || req.user?.name || req.user?.email || "system";
      const effectiveDate = transferDate || new Date();

      const lot = await FabricLot.findById(fabricLotId).session(session);
      if (!lot) {
        const error = new Error("Fabric lot not found");
        error.statusCode = 404;
        throw error;
      }

      if (quantityKg > lot.availableKg) {
        const error = new Error("Cannot transfer more than available stock");
        error.statusCode = 400;
        throw error;
      }

      const nextTransferredKg = lot.transferredKg + quantityKg;
      const stock = calculateFabricStock(lot.quantityKg, nextTransferredKg);

      lot.transferredKg = nextTransferredKg;
      lot.availableKg = stock.availableKg;
      lot.status = stock.status;
      await lot.save({ session });

      let cuttingBatch = await CuttingBatch.findOne({
        fabricLotId: lot._id,
        isDeleted: { $ne: true },
      }).session(session);
      if (!cuttingBatch) {
        const cuttingBatchDocs = await CuttingBatch.create(
          [
            {
              fabricLotId: lot._id,
              fabricType: lot.fabricType,
              quantityKg,
              batchDate: effectiveDate,
              operatorName: effectiveOperatorName,
              notes: notes || "",
              createdBy: req.user?.email || effectiveOperatorName,
              transferHistory: [
                {
                  quantityKg,
                  transferDate: effectiveDate,
                  notes: notes || "",
                  by: req.user?.email || effectiveOperatorName,
                },
              ],
            },
          ],
          { session }
        );
        cuttingBatch = cuttingBatchDocs[0];
      } else {
        cuttingBatch.quantityKg += quantityKg;
        cuttingBatch.fabricType = lot.fabricType;
        cuttingBatch.batchDate = effectiveDate;
        cuttingBatch.notes = notes || cuttingBatch.notes || "";
        cuttingBatch.transferHistory.push({
          quantityKg,
          transferDate: effectiveDate,
          notes: notes || "",
          by: req.user?.email || effectiveOperatorName,
        });
        await cuttingBatch.save({ session });
      }

      const cuttingStock = await CuttingStock.findOne({ fabricLotId: lot._id }).session(session);
      if (!cuttingStock) {
        await CuttingStock.create(
          [
            {
              fabricLotId: lot._id,
              fabricType: lot.fabricType,
              currentKg: quantityKg,
              totalReceivedKg: quantityKg,
              lastReceivedDate: effectiveDate,
              lastOperatorName: effectiveOperatorName,
            },
          ],
          { session }
        );
      } else {
        cuttingStock.currentKg += quantityKg;
        cuttingStock.totalReceivedKg += quantityKg;
        cuttingStock.lastReceivedDate = effectiveDate;
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
            date: effectiveDate,
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
      message: "Fabric received in cutting successfully",
      data: responsePayload,
    });
  } finally {
    session.endSession();
  }
});

const getCurrentCuttingStock = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const filter = isAdminUser(req) ? {} : { fabricLotId: { $in: ownedLotIds || [] } };
  const { page, limit, skip } = getPaginationFromQuery(req.query);
  const total = await CuttingStock.countDocuments(filter);
  const stock = await CuttingStock.find(filter)
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit);
  return sendSuccess(res, {
    data: stock,
    message: "",
    count: total,
    pagination: buildPaginationMeta({ total, page, limit }),
  });
});

const getCuttingStockSummary = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const batches = await CuttingBatch.find({
    isDeleted: { $ne: true },
    ...(isAdminUser(req) ? {} : { fabricLotId: { $in: ownedLotIds || [] } }),
  })
    .select("fabricLotId quantityKg")
    .lean();

  const totalLots = new Set(batches.map((batch) => String(batch.fabricLotId || ""))).size;
  const totalReceivedKg = batches.reduce(
    (sum, batch) => sum + Number(batch.quantityKg || 0),
    0
  );

  const totalCurrentKg = batches.reduce((sum, batch) => {
    const stats = getBatchConversionStats(batch);
    return sum + stats.remainingKg;
  }, 0);

  return sendSuccess(res, {
    data: {
      totalLots,
      totalCurrentKg,
      totalReceivedKg,
    },
    message: "",
  });
});

const getCuttingBatchHistory = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const query = isAdminUser(req) ? {} : { fabricLotId: { $in: ownedLotIds || [] } };

  if (req.query.operatorName) {
    query.operatorName = req.query.operatorName;
  }
  if (req.query.startDate || req.query.endDate) {
    query.batchDate = {};
    if (req.query.startDate) {
      query.batchDate.$gte = new Date(req.query.startDate);
    }
    if (req.query.endDate) {
      query.batchDate.$lte = new Date(req.query.endDate);
    }
  }

  const batches = await CuttingBatch.find({
    ...query,
    isDeleted: { $ne: true },
  })
    .populate("fabricLotId")
    .sort({ batchDate: -1, createdAt: -1 });

  const grouped = new Map();
  for (const batch of batches) {
    const lotId = String(batch.fabricLotId?._id || batch.fabricLotId || "");
    if (!grouped.has(lotId)) {
      grouped.set(lotId, {
        base: batch.toObject(),
        receivedKg: 0,
        convertedKg: 0,
        outputPieces: 0,
        transferHistory: [],
        conversionHistory: [],
      });
    }
    const row = grouped.get(lotId);
    row.receivedKg += Number(batch.quantityKg || 0);
    const stats = getBatchConversionStats(batch);
    row.convertedKg += stats.convertedKg;
    row.outputPieces += stats.outputPieces;
    row.transferHistory.push(...(batch.transferHistory || []));
    row.conversionHistory.push(...(batch.conversionHistory || []));
  }

  const data = Array.from(grouped.values()).map((row) => {
    const remainingKg = Math.max(row.receivedKg - row.convertedKg, 0);
    const yieldRatio = row.convertedKg > 0 ? Number((row.outputPieces / row.convertedKg).toFixed(4)) : 0;
    return {
      ...row.base,
      quantityKg: row.receivedKg,
      transferHistory: row.transferHistory,
      conversionHistory: row.conversionHistory,
      receivedKg: row.receivedKg,
      convertedKg: row.convertedKg,
      remainingKg,
      outputPieces: row.outputPieces,
      yieldRatio,
      status: remainingKg > 0 ? "Available Cutting" : "Cutting Completed",
      availableCuttingKg: remainingKg,
      canDelete: true,
      deleteBlockReason: null,
    };
  });

  const { page, limit } = getPaginationFromQuery(req.query);
  const { data: pageData, total, pagination } = paginateArray(data, page, limit);
  return sendSuccess(res, {
    data: pageData,
    message: "",
    count: total,
    pagination,
  });
});

const getCompletedCuttingSummary = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const batches = await CuttingBatch.find({
    isDeleted: { $ne: true },
    ...(isAdminUser(req) ? {} : { fabricLotId: { $in: ownedLotIds || [] } }),
  })
    .select("fabricType conversionHistory fabricLotId")
    .lean();

  const grouped = new Map();
  for (const batch of batches) {
    const fabricType = (batch.fabricType || "Unknown").trim();
    if (!grouped.has(fabricType)) {
      grouped.set(fabricType, {
        _id: String(batch._id),
        fabricType,
        totalConvertedKg: 0,
        totalPieces: 0,
        totalSentPieces: 0,
        conversionCount: 0,
        conversionHistory: [],
      });
    }
    const row = grouped.get(fabricType);
    if (!row._id) {
      row._id = String(batch._id);
    }
    const history = Array.isArray(batch.conversionHistory) ? batch.conversionHistory : [];
    for (const item of history) {
      const convertedKg = Number(item.convertedKg || 0);
      const outputPieces = Number(item.outputPieces || 0);
      if (convertedKg <= 0 || outputPieces <= 0) continue;
      row.totalConvertedKg += convertedKg;
      row.totalPieces += outputPieces;
      row.totalSentPieces += Number(item.sentPieces || 0);
      row.conversionCount += 1;
      row.conversionHistory.push({
        convertedKg,
        outputPieces,
        sentPieces: Number(item.sentPieces || 0),
        yieldRatio:
          convertedKg > 0 ? Number((outputPieces / convertedKg).toFixed(4)) : Number(item.yieldRatio || 0),
        completionDate: item.completionDate || item.createdAt || new Date(),
      });
    }
  }

  const data = Array.from(grouped.values())
    .filter((row) => row.conversionCount > 0)
    .map((row) => ({
      ...row,
      averageYield:
        row.totalConvertedKg > 0
          ? Number((row.totalPieces / row.totalConvertedKg).toFixed(4))
          : 0,
      availablePieces: Math.max(row.totalPieces - row.totalSentPieces, 0),
      status: "Completed",
      conversionHistory: row.conversionHistory.sort(
        (a, b) => new Date(b.completionDate) - new Date(a.completionDate)
      ),
    }))
    .sort((a, b) => a.fabricType.localeCompare(b.fabricType));

  const { page, limit } = getPaginationFromQuery(req.query);
  const { data: pageData, total, pagination } = paginateArray(data, page, limit);
  return sendSuccess(res, {
    data: pageData,
    message: "",
    count: total,
    pagination,
  });
});

const sendCompletedCuttingToLot = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let responsePayload = null;
    await (async () => {
      const fabricType = String(req.params.fabricType || "").trim();
      const { pieceLotId, pieces, option, date } = req.body;
      const effectiveDate = date || new Date();

      const batches = await CuttingBatch.find({
        fabricType,
        isDeleted: { $ne: true },
      }).session(session);
      if (!batches.length) {
        const error = new Error("No completed cutting found for this fabric type");
        error.statusCode = 404;
        throw error;
      }

      const targetLot = await PieceLot.findOne({ _id: pieceLotId, isDeleted: { $ne: true } }).session(
        session
      );
      if (!targetLot) {
        const error = new Error("Target lot not found");
        error.statusCode = 404;
        throw error;
      }

      const historyPointers = [];
      let availablePieces = 0;
      for (const batch of batches) {
        const history = Array.isArray(batch.conversionHistory) ? batch.conversionHistory : [];
        history.forEach((item, idx) => {
          const itemAvailable = Math.max(Number(item.outputPieces || 0) - Number(item.sentPieces || 0), 0);
          if (itemAvailable > 0) {
            availablePieces += itemAvailable;
            historyPointers.push({ batch, idx, available: itemAvailable });
          }
        });
      }

      if (pieces > availablePieces) {
        const error = new Error("Requested pieces exceed available quantity");
        error.statusCode = 400;
        throw error;
      }

      let remaining = pieces;
      for (const pointer of historyPointers) {
        if (remaining <= 0) break;
        const useQty = Math.min(pointer.available, remaining);
        const row = pointer.batch.conversionHistory[pointer.idx];
        row.sentPieces = Number(row.sentPieces || 0) + useQty;
        remaining -= useQty;
      }

      await Promise.all(batches.map((batch) => batch.save({ session })));

      targetLot.outputPieces = Number(targetLot.outputPieces || 0) + Number(pieces || 0);
      targetLot.receivedFromCompletePieces =
        Number(targetLot.receivedFromCompletePieces || 0) + Number(pieces || 0);
      if (!targetLot.fabricType || targetLot.fabricType === "Manual") {
        targetLot.fabricType = fabricType;
      }
      if (option) {
        targetLot.notes = `${targetLot.notes || ""}${targetLot.notes ? "\n" : ""}Option: ${option}`;
      }
      await targetLot.save({ session });

      const movementDocs = await MovementLog.create(
        [
          {
            fromStage: "complete_cutting",
            toStage: "piece_lot",
            lot: targetLot._id,
            quantity: pieces,
            unit: "pieces",
            date: effectiveDate,
            user: req.user?.email || req.user?.name || "system",
          },
        ],
        { session }
      );

      responsePayload = {
        fabricType,
        pieceLotId: targetLot._id,
        piecesSent: pieces,
        availablePiecesAfter: availablePieces - pieces,
        movementLog: movementDocs[0],
      };
    })();

    return sendSuccess(res, {
      message: "Completed cutting pieces sent to selected lot",
      data: responsePayload,
    });
  } finally {
    session.endSession();
  }
});

const getCuttingBatchById = asyncHandler(async (req, res) => {
  const batch = await CuttingBatch.findOne({
    _id: req.params.id,
    isDeleted: { $ne: true },
  }).populate("fabricLotId");
  if (!batch) {
    const error = new Error("Cutting batch not found");
    error.statusCode = 404;
    throw error;
  }

  const siblingBatches = await CuttingBatch.find({
    fabricLotId: batch.fabricLotId?._id || batch.fabricLotId,
    isDeleted: { $ne: true },
  }).populate("fabricLotId");

  const movementHistory = await MovementLog.find({
    lot: batch.fabricLotId?._id || batch.fabricLotId,
    $or: [{ toStage: "cutting" }, { fromStage: "cutting" }],
  })
    .sort({ date: -1, createdAt: -1 })
    .select("fromStage toStage quantity unit date user createdAt");

  const transferHistory = siblingBatches
    .flatMap((item) => item.transferHistory || [])
    .sort((a, b) => new Date(b.transferDate || b.createdAt) - new Date(a.transferDate || a.createdAt));
  const mergedConversionRaw = siblingBatches.flatMap((item) => item.conversionHistory || []);
  const conversionHistory = mergedConversionRaw
    .map((item) => ({
      _id: String(item._id || item.conversionId || new mongoose.Types.ObjectId()),
      inputKg: Number(item.convertedKg || 0),
      outputPieces: Number(item.outputPieces || 0),
      conversionRatio: Number(item.yieldRatio || 0),
      date: item.completionDate || item.createdAt || new Date(),
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const receivedKg = siblingBatches.reduce((sum, item) => sum + Number(item.quantityKg || 0), 0);
  const convertedKg = conversionHistory.reduce((sum, item) => sum + Number(item.inputKg || 0), 0);
  const outputPieces = conversionHistory.reduce((sum, item) => sum + Number(item.outputPieces || 0), 0);
  const yieldRatio = convertedKg > 0 ? Number((outputPieces / convertedKg).toFixed(4)) : 0;
  const remainingKg = Math.max(receivedKg - convertedKg, 0);
  const data = {
    ...batch.toObject(),
    quantityKg: receivedKg,
    transferHistory,
    receivedKg,
    convertedKg,
    remainingKg,
    outputPieces,
    yieldRatio,
    status: remainingKg > 0 ? "Available Cutting" : "Cutting Completed",
    convertedToPieces: convertedKg > 0,
    canDelete: true,
    deleteBlockReason: null,
  };

  return sendSuccess(res, {
    data: {
      batch: data,
      movementHistory,
      conversionHistory,
    },
    message: "",
  });
});

const completeCuttingBatch = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let responsePayload = null;

    await (async () => {
      const batch = await CuttingBatch.findOne({
        _id: req.params.id,
        isDeleted: { $ne: true },
      }).session(session);
      if (!batch) {
        const error = new Error("Cutting batch not found");
        error.statusCode = 404;
        throw error;
      }

      const siblingBatches = await CuttingBatch.find({
        fabricLotId: batch.fabricLotId,
        isDeleted: { $ne: true },
      }).session(session);
      const totalReceivedKg = siblingBatches.reduce(
        (sum, item) => sum + Number(item.quantityKg || 0),
        0
      );
      const totalConvertedKg = siblingBatches.reduce(
        (sum, item) =>
          sum +
          (item.conversionHistory || []).reduce(
            (historySum, row) => historySum + Number(row.convertedKg || 0),
            0
          ),
        0
      );

      const convertedKg = toNumber(req.body.convertedKg, NaN);
      const outputPieces = toNumber(req.body.outputPieces, NaN);
      const completionDate = req.body.completionDate || new Date();
      const notes = req.body.notes || "";

      if (Number.isNaN(convertedKg) || convertedKg <= 0) {
        const error = new Error("convertedKg must be a positive number");
        error.statusCode = 400;
        throw error;
      }
      if (Number.isNaN(outputPieces) || outputPieces <= 0) {
        const error = new Error("outputPieces must be a positive number");
        error.statusCode = 400;
        throw error;
      }

      const cuttingStock = await CuttingStock.findOne({ fabricLotId: batch.fabricLotId }).session(
        session
      );
      const availableFromHistory = Math.max(totalReceivedKg - totalConvertedKg, 0);
      const availableCuttingKg = Number(cuttingStock?.currentKg || availableFromHistory);
      if (convertedKg > availableCuttingKg) {
        const error = new Error("Cannot convert more than available cutting stock");
        error.statusCode = 400;
        throw error;
      }

      const yieldRatio = Number((outputPieces / convertedKg).toFixed(4));

      const conversionDocs = await CuttingConversion.create(
        [
          {
            lot: batch.fabricLotId,
            cuttingBatchId: batch._id,
            inputKg: convertedKg,
            outputPieces,
            conversionRatio: yieldRatio,
            date: completionDate,
          },
        ],
        { session }
      );
      const conversion = conversionDocs[0];

      if (cuttingStock) {
        cuttingStock.currentKg = Math.max(availableCuttingKg - convertedKg, 0);
        await cuttingStock.save({ session });
      }

      const pieceLotNumber = await generatePieceLotNumber(session, completionDate);
      const pieceLotDocs = await PieceLot.create(
        [
          {
            lotNumber: pieceLotNumber,
            fabricLotId: batch.fabricLotId,
            cuttingBatchId: batch._id,
            createdByUserId: req.user?._id || null,
            fabricType: batch.fabricType || "Manual",
            fabricSource: "Cutting Conversion",
            convertedKg,
            outputPieces,
            yieldRatio,
            completionDate,
            notes,
            status: "Available",
          },
        ],
        { session }
      );
      const pieceLot = pieceLotDocs[0];

      batch.conversionHistory.push({
        convertedKg,
        outputPieces,
        yieldRatio,
        completionDate,
        notes,
        conversionId: conversion._id,
        pieceLotId: pieceLot._id,
      });
      await batch.save({ session });

      const movementLogDocs = await MovementLog.create(
        [
          {
            fromStage: "cutting",
            toStage: "piece_lot",
            lot: batch.fabricLotId,
            quantity: convertedKg,
            unit: "kg",
            date: completionDate,
            user: req.user?.email || req.user?.name || "system",
          },
        ],
        { session }
      );

      responsePayload = {
        conversion,
        pieceLot,
        movementLog: movementLogDocs[0],
        availableCuttingKgAfter: cuttingStock ? cuttingStock.currentKg : 0,
      };
    })();

    return sendSuccess(res, {
      message: "Cutting converted to pieces successfully",
      data: responsePayload,
    });
  } finally {
    session.endSession();
  }
});

const deleteCuttingBatch = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let responsePayload = null;
    let responseMessage = "Cutting batch deleted and quantity restored to fabric inventory";

    await (async () => {
      const batch = await CuttingBatch.findOne({
        _id: req.params.id,
        isDeleted: { $ne: true },
      }).session(session);
      if (!batch) {
        const error = new Error("Cutting batch not found");
        error.statusCode = 404;
        throw error;
      }

      const targetBatches = await CuttingBatch.find({
        fabricLotId: batch.fabricLotId,
        isDeleted: { $ne: true },
      }).session(session);

      const lot = await FabricLot.findById(batch.fabricLotId).session(session);

      const targetBatchIds = targetBatches.map((item) => item._id);
      const batchConversions = await CuttingConversion.find({
        cuttingBatchId: { $in: targetBatchIds },
      }).session(session);
      const totalConvertedKgForBatch = batchConversions.reduce(
        (sum, item) => sum + Number(item.inputKg || 0),
        0
      );
      const totalProducedPiecesForBatch = batchConversions.reduce(
        (sum, item) => sum + Number(item.outputPieces || 0),
        0
      );

      const rollbackQty = targetBatches.reduce((sum, item) => sum + Number(item.quantityKg || 0), 0);
      if (lot) {
        const nextTransferredKg = Math.max(Number(lot.transferredKg || 0) - rollbackQty, 0);
        const stock = calculateFabricStock(getLotQuantityKg(lot), nextTransferredKg);

        lot.transferredKg = nextTransferredKg;
        lot.availableKg = stock.availableKg;
        lot.status = stock.status;
        await lot.save({ session });
      }

      const cuttingStock = await CuttingStock.findOne({ fabricLotId: batch.fabricLotId }).session(
        session
      );
      if (cuttingStock) {
        const remainingKgForBatch = Math.max(rollbackQty - totalConvertedKgForBatch, 0);
        cuttingStock.currentKg = Math.max(
          Number(cuttingStock.currentKg || 0) - remainingKgForBatch,
          0
        );
        cuttingStock.totalReceivedKg = Math.max(
          Number(cuttingStock.totalReceivedKg || 0) - rollbackQty,
          0
        );
        await cuttingStock.save({ session });
      }

      await PieceLot.deleteMany({ cuttingBatchId: { $in: targetBatchIds } }).session(session);
      await CuttingConversion.deleteMany({ cuttingBatchId: { $in: targetBatchIds } }).session(session);

      if (lot) {
        await MovementLog.create(
          [
            ...(totalConvertedKgForBatch > 0
              ? [
                  {
                    fromStage: "piece_lot",
                    toStage: "cutting",
                    lot: lot._id,
                    quantity: totalConvertedKgForBatch,
                    unit: "kg",
                    date: new Date(),
                    user: req.user?.email || req.user?.name || "system",
                  },
                ]
              : []),
            {
              fromStage: "cutting",
              toStage: "fabric_inventory",
              lot: lot._id,
              quantity: rollbackQty,
              unit: "kg",
              date: new Date(),
              user: req.user?.email || req.user?.name || "system",
            },
          ],
          { session, ordered: true }
        );
      }

      for (const item of targetBatches) {
        item.isDeleted = true;
        item.deletedAt = new Date();
        item.deletedBy = req.user?.email || req.user?.name || "system";
        await item.save({ session });
      }

      responsePayload = {
        restoredToFabricKg: rollbackQty,
        removedConvertedKg: totalConvertedKgForBatch,
        removedProducedPieces: totalProducedPiecesForBatch,
        fabricLot: lot || null,
        warning: lot
          ? null
          : "Fabric lot was already missing. Cutting batch was deleted and cutting stock was cleaned up.",
      };
      if (!lot) {
        responseMessage = "Cutting batch deleted and orphan references cleaned up";
      }
    })();

    return sendSuccess(res, {
      message: responseMessage,
      data: responsePayload,
    });
  } finally {
    session.endSession();
  }
});

const deleteCompletedCuttingByFabricType = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let responsePayload = null;
    await (async () => {
      const fabricType = String(req.params.fabricType || "").trim();
      if (!fabricType) {
        const error = new Error("fabricType is required");
        error.statusCode = 400;
        throw error;
      }

      const targetBatches = await CuttingBatch.find({
        fabricType,
        isDeleted: { $ne: true },
      }).session(session);
      if (!targetBatches.length) {
        const error = new Error("No active completed cutting found for this fabric type");
        error.statusCode = 404;
        throw error;
      }

      const targetBatchIds = targetBatches.map((item) => item._id);
      const lotIds = [...new Set(targetBatches.map((item) => String(item.fabricLotId)))];

      const allConversions = await CuttingConversion.find({
        cuttingBatchId: { $in: targetBatchIds },
      }).session(session);
      const conversionMap = new Map();
      for (const conversion of allConversions) {
        const key = String(conversion.cuttingBatchId);
        if (!conversionMap.has(key)) conversionMap.set(key, []);
        conversionMap.get(key).push(conversion);
      }

      await PieceLot.deleteMany({ cuttingBatchId: { $in: targetBatchIds } }).session(session);
      await CuttingConversion.deleteMany({ cuttingBatchId: { $in: targetBatchIds } }).session(session);

      const logs = [];
      let restoredToAvailableCuttingKg = 0;
      let removedConvertedKg = 0;
      let removedProducedPieces = 0;

      for (const lotId of lotIds) {
        const lotBatches = targetBatches.filter(
          (item) => String(item.fabricLotId) === String(lotId)
        );

        let totalConvertedKgForLot = 0;
        let totalProducedPiecesForLot = 0;
        for (const batch of lotBatches) {
          const batchConversions = conversionMap.get(String(batch._id)) || [];
          totalConvertedKgForLot += batchConversions.reduce(
            (sum, item) => sum + Number(item.inputKg || 0),
            0
          );
          totalProducedPiecesForLot += batchConversions.reduce(
            (sum, item) => sum + Number(item.outputPieces || 0),
            0
          );
        }

        const lotObjectId = new mongoose.Types.ObjectId(lotId);
        const cuttingStock = await CuttingStock.findOne({ fabricLotId: lotObjectId }).session(session);
        if (cuttingStock) {
          cuttingStock.currentKg = Number(cuttingStock.currentKg || 0) + totalConvertedKgForLot;
          await cuttingStock.save({ session });
        } else if (totalConvertedKgForLot > 0) {
          await CuttingStock.create(
            [
              {
                fabricLotId: lotObjectId,
                fabricType,
                currentKg: totalConvertedKgForLot,
                totalReceivedKg: totalConvertedKgForLot,
                lastReceivedDate: new Date(),
                lastOperatorName: req.user?.email || req.user?.name || "system",
              },
            ],
            { session }
          );
        }

        if (totalConvertedKgForLot > 0) {
          logs.push({
            fromStage: "piece_lot",
            toStage: "cutting",
            lot: lotObjectId,
            quantity: totalConvertedKgForLot,
            unit: "kg",
            date: new Date(),
            user: req.user?.email || req.user?.name || "system",
          });
        }

        restoredToAvailableCuttingKg += totalConvertedKgForLot;
        removedConvertedKg += totalConvertedKgForLot;
        removedProducedPieces += totalProducedPiecesForLot;
      }

      for (const batch of targetBatches) {
        batch.conversionHistory = [];
        batch.notes = "";
        await batch.save({ session });
      }

      if (logs.length) {
        await MovementLog.create(logs, { session, ordered: true });
      }

      responsePayload = {
        fabricType,
        restoredToAvailableCuttingKg,
        removedConvertedKg,
        removedProducedPieces,
      };
    })();

    return sendSuccess(res, {
      message:
        "Completed cutting deleted and converted quantity restored to available cutting",
      data: responsePayload,
    });
  } finally {
    session.endSession();
  }
});

module.exports = {
  receiveTransferredFabric,
  getCurrentCuttingStock,
  getCuttingStockSummary,
  getCuttingBatchHistory,
  getCompletedCuttingSummary,
  getCuttingBatchById,
  completeCuttingBatch,
  deleteCuttingBatch,
  deleteCompletedCuttingByFabricType,
  sendCompletedCuttingToLot,
};
