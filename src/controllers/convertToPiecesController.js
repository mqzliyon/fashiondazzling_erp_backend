const ConversionRatio = require("../models/ConversionRatio");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { getPaginationFromQuery, paginateArray } = require("../utils/pagination");

async function ensureSingleDefault(idToKeep) {
  await ConversionRatio.updateMany(
    { _id: { $ne: idToKeep }, isDefault: true },
    { $set: { isDefault: false } }
  );
}

const createConversionRatio = asyncHandler(async (req, res) => {
  const ratio = await ConversionRatio.create(req.body);

  if (ratio.isDefault) {
    await ensureSingleDefault(ratio._id);
  }

  return sendSuccess(res, {
    status: 201,
    data: ratio,
    message: "Conversion ratio created",
  });
});

const getConversionRatios = asyncHandler(async (req, res) => {
  const filters = {};
  if (req.query.isActive !== undefined) {
    filters.isActive = req.query.isActive === "true";
  }
  if (req.query.fabricType) {
    filters.fabricType = req.query.fabricType;
  }

  const ratios = await ConversionRatio.find(filters).sort({
    isDefault: -1,
    createdAt: -1,
  });

  const { page, limit } = getPaginationFromQuery(req.query);
  const { data, total, pagination } = paginateArray(ratios, page, limit);
  return sendSuccess(res, {
    data,
    message: "",
    count: total,
    pagination,
  });
});

const getConversionRatioById = asyncHandler(async (req, res) => {
  const ratio = await ConversionRatio.findById(req.params.id);
  if (!ratio) {
    const error = new Error("Conversion ratio not found");
    error.statusCode = 404;
    throw error;
  }

  return sendSuccess(res, { data: ratio, message: "" });
});

const updateConversionRatio = asyncHandler(async (req, res) => {
  const ratio = await ConversionRatio.findById(req.params.id);
  if (!ratio) {
    const error = new Error("Conversion ratio not found");
    error.statusCode = 404;
    throw error;
  }

  Object.assign(ratio, req.body);
  await ratio.save();

  if (ratio.isDefault) {
    await ensureSingleDefault(ratio._id);
  }

  return sendSuccess(res, { data: ratio, message: "Conversion ratio updated" });
});

const convertKgToPieces = asyncHandler(async (req, res) => {
  const { kg, ratioId, fabricType } = req.body;

  let ratio = null;

  if (ratioId) {
    ratio = await ConversionRatio.findById(ratioId);
  } else {
    const ratioQuery = {
      isActive: true,
    };

    if (fabricType) {
      ratioQuery.fabricType = fabricType;
    }

    ratio = await ConversionRatio.findOne(ratioQuery).sort({
      isDefault: -1,
      createdAt: -1,
    });
  }

  if (!ratio) {
    const error = new Error("No conversion ratio found for this conversion");
    error.statusCode = 404;
    throw error;
  }

  const pieces = Number((kg * ratio.piecesPerKg).toFixed(2));

  return sendSuccess(res, {
    message: "",
    data: {
      kg,
      pieces,
      unit: "pieces",
      ratio: {
        id: ratio._id,
        name: ratio.name,
        piecesPerKg: ratio.piecesPerKg,
        fabricType: ratio.fabricType,
      },
    },
  });
});

module.exports = {
  createConversionRatio,
  getConversionRatios,
  getConversionRatioById,
  updateConversionRatio,
  convertKgToPieces,
};
