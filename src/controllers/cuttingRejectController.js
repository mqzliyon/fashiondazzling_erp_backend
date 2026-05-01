const mongoose = require("mongoose");
const CuttingConversion = require("../models/CuttingConversion");
const CuttingReject = require("../models/CuttingReject");
const RejectInventory = require("../models/RejectInventory");
const RejectManagement = require("../models/RejectManagement");
const MovementLog = require("../models/MovementLog");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const {
  getPaginationFromQuery,
  buildPaginationMeta,
} = require("../utils/pagination");

function withSessionOptions() {
  return {
    readConcern: { level: "snapshot" },
    writeConcern: { w: "majority" },
  };
}

const rejectFromCutting = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let responsePayload = null;

    await (async () => {
      const { conversionId, rejectedPieces, reason, date, operatorName } = req.body;
      const effectiveDate = date || new Date();
      const effectiveOperator = operatorName || req.user?.name || req.user?.email || "system";

      const conversion = await CuttingConversion.findById(conversionId).session(session);
      if (!conversion) {
        const error = new Error("Cutting conversion not found");
        error.statusCode = 404;
        throw error;
      }

      const aggregated = await CuttingReject.aggregate([
        { $match: { conversion: conversion._id } },
        { $group: { _id: "$conversion", totalRejected: { $sum: "$rejectedPieces" } } },
      ]).session(session);

      const alreadyRejected = aggregated[0]?.totalRejected || 0;
      const remainingPieces = conversion.outputPieces - alreadyRejected;

      if (rejectedPieces > remainingPieces) {
        const error = new Error("Rejected pieces exceed available converted pieces");
        error.statusCode = 400;
        throw error;
      }

      const rejectDocs = await CuttingReject.create(
        [
          {
            lot: conversion.lot,
            conversion: conversion._id,
            rejectedPieces,
            reason,
            date: effectiveDate,
            operatorName: effectiveOperator,
          },
        ],
        { session }
      );
      const rejectRecord = rejectDocs[0];

      const rejectInventory = await RejectInventory.findOne({ lot: conversion.lot }).session(
        session
      );
      if (!rejectInventory) {
        await RejectInventory.create(
          [
            {
              lot: conversion.lot,
              totalRejectedPieces: rejectedPieces,
              lastRejectDate: effectiveDate,
              lastReason: reason,
            },
          ],
          { session }
        );
      } else {
        rejectInventory.totalRejectedPieces += rejectedPieces;
        rejectInventory.lastRejectDate = effectiveDate;
        rejectInventory.lastReason = reason;
        await rejectInventory.save({ session });
      }

      const movementDocs = await MovementLog.create(
        [
          {
            fromStage: "cutting",
            toStage: "reject_inventory",
            lot: conversion.lot,
            quantity: rejectedPieces,
            unit: "pieces",
            date: effectiveDate,
            user: req.user?.email || effectiveOperator,
          },
        ],
        { session }
      );

      await RejectManagement.create(
        [
          {
            lot: conversion.lot,
            stage: "cutting",
            quantity: rejectedPieces,
            reason,
            date: effectiveDate,
          },
        ],
        { session }
      );

      responsePayload = {
        reject: rejectRecord,
        movementLog: movementDocs[0],
      };
    })();

    return sendSuccess(res, {
      status: 201,
      message: "Rejected pieces moved to reject inventory",
      data: responsePayload,
    });
  } finally {
    session.endSession();
  }
});

const getRejectInventory = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationFromQuery(req.query);
  const total = await RejectInventory.countDocuments({});
  const inventory = await RejectInventory.find({})
    .populate("lot")
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit);

  return sendSuccess(res, {
    data: inventory,
    message: "",
    count: total,
    pagination: buildPaginationMeta({ total, page, limit }),
  });
});

const getCuttingRejectHistory = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.conversionId) {
    query.conversion = req.query.conversionId;
  }
  if (req.query.lotId) {
    query.lot = req.query.lotId;
  }

  const { page, limit, skip } = getPaginationFromQuery(req.query);
  const total = await CuttingReject.countDocuments(query);
  const history = await CuttingReject.find(query)
    .populate("lot")
    .populate("conversion")
    .sort({ date: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return sendSuccess(res, {
    data: history,
    message: "",
    count: total,
    pagination: buildPaginationMeta({ total, page, limit }),
  });
});

module.exports = {
  rejectFromCutting,
  getRejectInventory,
  getCuttingRejectHistory,
};
