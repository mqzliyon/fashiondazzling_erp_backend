const CuttingConversion = require("../models/CuttingConversion");
const ConversionRatio = require("../models/ConversionRatio");
const FabricLot = require("../models/FabricLot");
const CuttingBatch = require("../models/CuttingBatch");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { getPaginationFromQuery, paginateArray } = require("../utils/pagination");

async function getRatio({ ratioId, fabricType }) {
  if (ratioId) {
    return ConversionRatio.findById(ratioId);
  }

  const query = { isActive: true };
  if (fabricType) {
    query.fabricType = fabricType;
  }

  return ConversionRatio.findOne(query).sort({ isDefault: -1, createdAt: -1 });
}

const createCuttingConversion = asyncHandler(async (req, res) => {
  const { lotId, kg, ratioId, fabricType, date } = req.body;

  const lot = await FabricLot.findById(lotId);
  if (!lot) {
    const error = new Error("Lot not found");
    error.statusCode = 404;
    throw error;
  }

  const ratio = await getRatio({ ratioId, fabricType: fabricType || lot.fabricType });
  if (!ratio) {
    const error = new Error("No conversion ratio found");
    error.statusCode = 404;
    throw error;
  }

  const outputPieces = Number((kg * ratio.piecesPerKg).toFixed(2));

  const conversion = await CuttingConversion.create({
    lot: lot._id,
    inputKg: kg,
    outputPieces,
    conversionRatio: ratio.piecesPerKg,
    ratioRef: ratio._id,
    date: date || new Date(),
  });

  return sendSuccess(res, {
    status: 201,
    data: conversion,
    message: "Conversion created",
  });
});

const getCuttingConversions = asyncHandler(async (req, res) => {
  const query = {};

  if (req.query.lotId) {
    query.lot = req.query.lotId;
  }
  if (req.query.startDate || req.query.endDate) {
    query.date = {};
    if (req.query.startDate) {
      query.date.$gte = new Date(req.query.startDate);
    }
    if (req.query.endDate) {
      query.date.$lte = new Date(req.query.endDate);
    }
  }

  const conversions = await CuttingConversion.find(query)
    .populate("lot")
    .populate("cuttingBatchId", "isDeleted")
    .populate("ratioRef")
    .sort({ date: -1, createdAt: -1 });

  const activeLotIds = await CuttingBatch.distinct("fabricLotId", {
    isDeleted: { $ne: true },
  });
  const activeLotSet = new Set(activeLotIds.map((id) => String(id)));

  const filtered = conversions.filter((item) => {
    if (item.cuttingBatchId) {
      return item.cuttingBatchId.isDeleted !== true;
    }
    // Legacy conversions without cuttingBatchId: show only if lot still has active batch.
    return activeLotSet.has(String(item.lot?._id || item.lot || ""));
  });

  const { page, limit } = getPaginationFromQuery(req.query);
  const { data, total, pagination } = paginateArray(filtered, page, limit);
  return sendSuccess(res, {
    data,
    message: "",
    count: total,
    pagination,
  });
});

const getCuttingConversionById = asyncHandler(async (req, res) => {
  const conversion = await CuttingConversion.findById(req.params.id)
    .populate("lot")
    .populate("ratioRef");

  if (!conversion) {
    const error = new Error("Cutting conversion not found");
    error.statusCode = 404;
    throw error;
  }

  return sendSuccess(res, { data: conversion, message: "" });
});

module.exports = {
  createCuttingConversion,
  getCuttingConversions,
  getCuttingConversionById,
};
