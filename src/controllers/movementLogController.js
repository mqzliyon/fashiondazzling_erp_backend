const MovementLog = require("../models/MovementLog");
const { isAdminUser, getOwnedFabricLotIds } = require("../utils/ownership");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const {
  getPaginationFromQuery,
  buildPaginationMeta,
} = require("../utils/pagination");

const createMovementLog = asyncHandler(async (req, res) => {
  const movementLog = await MovementLog.create(req.body);

  return sendSuccess(res, {
    status: 201,
    data: movementLog,
    message: "Movement log created",
  });
});

const getMovementLogs = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const filters = isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } };

  if (req.query.lot) {
    filters.lot = req.query.lot;
  }
  if (req.query.fromStage) {
    filters.fromStage = req.query.fromStage;
  }
  if (req.query.toStage) {
    filters.toStage = req.query.toStage;
  }

  const { page, limit, skip } = getPaginationFromQuery(req.query);
  const total = await MovementLog.countDocuments(filters);
  const movementLogs = await MovementLog.find(filters)
    .populate("lot")
    .sort({ date: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit);

  return sendSuccess(res, {
    data: movementLogs,
    message: "",
    count: total,
    pagination: buildPaginationMeta({ total, page, limit }),
  });
});

const getMovementLogById = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const movementLog = await MovementLog.findOne({
    _id: req.params.id,
    ...(isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } }),
  }).populate("lot");

  if (!movementLog) {
    const error = new Error("Movement log not found");
    error.statusCode = 404;
    throw error;
  }

  return sendSuccess(res, { data: movementLog, message: "" });
});

module.exports = {
  createMovementLog,
  getMovementLogs,
  getMovementLogById,
};
