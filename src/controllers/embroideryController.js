const mongoose = require("mongoose");
const CuttingConversion = require("../models/CuttingConversion");
const CuttingReject = require("../models/CuttingReject");
const RejectInventory = require("../models/RejectInventory");
const RejectManagement = require("../models/RejectManagement");
const EmbroideryInventory = require("../models/EmbroideryInventory");
const FactoryWarehouseInventory = require("../models/FactoryWarehouseInventory");
const EmbroideryTransaction = require("../models/EmbroideryTransaction");
const OfficeDispatch = require("../models/OfficeDispatch");
const MovementLog = require("../models/MovementLog");
const PieceLot = require("../models/PieceLot");
const FabricLot = require("../models/FabricLot");
const { isAdminUser, getOwnedFabricLotIds } = require("../utils/ownership");
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

const receiveFromCutting = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let responsePayload = null;

    await (async () => {
      const { conversionId, pieces, date, operatorName } = req.body;
      const effectiveDate = date || new Date();
      const effectiveOperator = operatorName || req.user?.name || req.user?.email || "system";

      const conversion = await CuttingConversion.findById(conversionId).populate("lot").session(session);
      if (!conversion) {
        const error = new Error("Cutting conversion not found");
        error.statusCode = 404;
        throw error;
      }

      const [cuttingRejected] = await CuttingReject.aggregate([
        { $match: { conversion: conversion._id } },
        { $group: { _id: "$conversion", totalRejected: { $sum: "$rejectedPieces" } } },
      ]).session(session);

      const [alreadySent] = await EmbroideryTransaction.aggregate([
        { $match: { conversion: conversion._id, actionType: "receive_from_cutting" } },
        { $group: { _id: "$conversion", totalSent: { $sum: "$pieces" } } },
      ]).session(session);

      const allowedPieces =
        conversion.outputPieces - (cuttingRejected?.totalRejected || 0) - (alreadySent?.totalSent || 0);

      if (pieces > allowedPieces) {
        const error = new Error("Cannot send more pieces than available from cutting conversion");
        error.statusCode = 400;
        throw error;
      }

      let inventory = await EmbroideryInventory.findOne({ lot: conversion.lot._id }).session(session);
      if (!inventory) {
        const docs = await EmbroideryInventory.create(
          [
            {
              lot: conversion.lot._id,
              fabricType: conversion.lot.fabricType,
              availablePieces: pieces,
              totalReceivedPieces: pieces,
              lastUpdatedDate: effectiveDate,
            },
          ],
          { session }
        );
        inventory = docs[0];
      } else {
        inventory.availablePieces += pieces;
        inventory.totalReceivedPieces += pieces;
        inventory.lastUpdatedDate = effectiveDate;
        await inventory.save({ session });
      }

      const txDocs = await EmbroideryTransaction.create(
        [
          {
            lot: conversion.lot._id,
            conversion: conversion._id,
            actionType: "receive_from_cutting",
            fromStage: "cutting",
            toStage: "embroidery",
            pieces,
            date: effectiveDate,
            operatorName: effectiveOperator,
          },
        ],
        { session }
      );

      const movementDocs = await MovementLog.create(
        [
          {
            fromStage: "cutting",
            toStage: "embroidery",
            lot: conversion.lot._id,
            quantity: pieces,
            unit: "pieces",
            date: effectiveDate,
            user: req.user?.email || effectiveOperator,
          },
        ],
        { session }
      );

      responsePayload = {
        inventory,
        transaction: txDocs[0],
        movementLog: movementDocs[0],
      };
    })();

    return sendSuccess(res, {
      message: "Pieces sent to embroidery successfully",
      data: responsePayload,
    });
  } finally {
    session.endSession();
  }
});

const rejectFromEmbroidery = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let responsePayload = null;

    await (async () => {
      const { lotId, pieces, reason, date, operatorName } = req.body;
      const effectiveDate = date || new Date();
      const effectiveOperator = operatorName || req.user?.name || req.user?.email || "system";
      const rejectReason = (reason || "").trim();

      const inventory = await EmbroideryInventory.findOne({ lot: lotId }).session(session);
      if (!inventory) {
        const error = new Error("Embroidery inventory not found for this lot");
        error.statusCode = 404;
        throw error;
      }

      if (pieces > inventory.availablePieces) {
        const error = new Error("Rejected pieces exceed available embroidery stock");
        error.statusCode = 400;
        throw error;
      }

      inventory.availablePieces -= pieces;
      inventory.totalRejectedPieces += pieces;
      inventory.lastUpdatedDate = effectiveDate;
      await inventory.save({ session });

      let rejectInventory = await RejectInventory.findOne({ lot: lotId }).session(session);
      if (!rejectInventory) {
        const docs = await RejectInventory.create(
          [
            {
              lot: lotId,
              totalRejectedPieces: pieces,
              lastRejectDate: effectiveDate,
              lastReason: rejectReason,
            },
          ],
          { session }
        );
        rejectInventory = docs[0];
      } else {
        rejectInventory.totalRejectedPieces += pieces;
        rejectInventory.lastRejectDate = effectiveDate;
        rejectInventory.lastReason = rejectReason;
        await rejectInventory.save({ session });
      }

      const txDocs = await EmbroideryTransaction.create(
        [
          {
            lot: lotId,
            actionType: "reject",
            fromStage: "embroidery",
            toStage: "reject_inventory",
            pieces,
            reason: rejectReason,
            date: effectiveDate,
            operatorName: effectiveOperator,
          },
        ],
        { session }
      );

      const movementDocs = await MovementLog.create(
        [
          {
            fromStage: "embroidery",
            toStage: "reject_inventory",
            lot: lotId,
            quantity: pieces,
            unit: "pieces",
            date: effectiveDate,
            user: req.user?.email || effectiveOperator,
          },
        ],
        { session }
      );

      responsePayload = {
        inventory,
        rejectInventory,
        transaction: txDocs[0],
        movementLog: movementDocs[0],
      };
    })();

    return sendSuccess(res, {
      message: "Embroidery rejects moved to reject inventory",
      data: responsePayload,
    });
  } finally {
    session.endSession();
  }
});

const dispatchFromEmbroidery = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let responsePayload = null;

    await (async () => {
      const { lotId, pieces, destination, date, operatorName } = req.body;
      const effectiveDate = date || new Date();
      const effectiveOperator = operatorName || req.user?.name || req.user?.email || "system";
      const toStage = destination === "office" ? "office" : "export";
      const actionType = destination === "office" ? "send_to_office" : "send_to_export";

      const inventory = await EmbroideryInventory.findOne({ lot: lotId }).session(session);
      if (!inventory) {
        const error = new Error("Embroidery inventory not found for this lot");
        error.statusCode = 404;
        throw error;
      }

      if (pieces > inventory.availablePieces) {
        const error = new Error("Dispatch pieces exceed available embroidery stock");
        error.statusCode = 400;
        throw error;
      }

      inventory.availablePieces -= pieces;
      inventory.lastUpdatedDate = effectiveDate;
      if (destination === "office") {
        inventory.totalSentOfficePieces += pieces;
      } else {
        inventory.totalSentExportPieces += pieces;
      }
      await inventory.save({ session });

      const txDocs = await EmbroideryTransaction.create(
        [
          {
            lot: lotId,
            actionType,
            fromStage: "embroidery",
            toStage,
            pieces,
            date: effectiveDate,
            operatorName: effectiveOperator,
          },
        ],
        { session }
      );

      let officeDispatchRecord = null;
      if (destination === "office") {
        const officeDocs = await OfficeDispatch.create(
          [
            {
              office: "Main Office",
              lot: lotId,
              quantity: pieces,
              dispatchDate: effectiveDate,
              referenceNo: `OFF-EMB-${Date.now()}-${String(lotId).slice(-4)}`,
              status: "dispatched",
              source: "embroidery",
              grade: "",
            },
          ],
          { session }
        );
        officeDispatchRecord = officeDocs[0];
      }

      const movementDocs = await MovementLog.create(
        [
          {
            fromStage: "embroidery",
            toStage,
            lot: lotId,
            quantity: pieces,
            unit: "pieces",
            date: effectiveDate,
            user: req.user?.email || effectiveOperator,
          },
        ],
        { session }
      );

      responsePayload = {
        inventory,
        transaction: txDocs[0],
        officeDispatch: officeDispatchRecord,
        movementLog: movementDocs[0],
      };
    })();

    return sendSuccess(res, {
      message: "Pieces dispatched from embroidery successfully",
      data: responsePayload,
    });
  } finally {
    session.endSession();
  }
});

const getEmbroideryStock = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const filter = {
    isArchived: { $ne: true },
    ...(isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } }),
  };
  const { page, limit, skip } = getPaginationFromQuery(req.query);
  const total = await EmbroideryInventory.countDocuments(filter);
  const stock = await EmbroideryInventory.find(filter)
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  const lotIds = stock.map((item) => item.lot).filter(Boolean);

  const [pieceLots, fabricLots] = await Promise.all([
    PieceLot.find({ _id: { $in: lotIds } }).select("_id lotNumber").lean(),
    FabricLot.find({ _id: { $in: lotIds } }).select("_id fabricType").lean(),
  ]);
  const pieceLotMap = new Map(pieceLots.map((item) => [String(item._id), item]));
  const fabricLotMap = new Map(fabricLots.map((item) => [String(item._id), item]));

  const data = stock.map((item) => {
    const lotKey = String(item.lot || "");
    const pieceLot = pieceLotMap.get(lotKey);
    const fabricLot = fabricLotMap.get(lotKey);
    return {
      ...item,
      lotNumber: pieceLot?.lotNumber || `LOT-${lotKey.slice(-6)}`,
      fabricType: item.fabricType || fabricLot?.fabricType || "Manual",
    };
  });
  return sendSuccess(res, {
    data,
    message: "",
    count: total,
    pagination: buildPaginationMeta({ total, page, limit }),
  });
});

const getFactoryWarehouseStock = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const filter = isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } };
  const { page, limit, skip } = getPaginationFromQuery(req.query);
  const total = await FactoryWarehouseInventory.countDocuments(filter);
  const stock = await FactoryWarehouseInventory.find(filter)
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  const lotIds = stock.map((item) => item.lot).filter(Boolean);
  const pieceLots = await PieceLot.find({ _id: { $in: lotIds } }).select("_id lotNumber").lean();
  const pieceLotMap = new Map(pieceLots.map((item) => [String(item._id), item]));

  const data = stock.map((item) => {
    const lotKey = String(item.lot || "");
    const pieceLot = pieceLotMap.get(lotKey);
    return {
      ...item,
      lot: {
        _id: lotKey,
        lotNumber: pieceLot?.lotNumber || `LOT-${lotKey.slice(-6)}`,
      },
      transferredOfficePieces: Number(item.totalSentOfficePieces || 0),
      transferredExportPieces: Number(item.totalSentExportPieces || 0),
      transferredTotalPieces:
        Number(item.totalSentOfficePieces || 0) + Number(item.totalSentExportPieces || 0),
    };
  });

  return sendSuccess(res, {
    data,
    message: "",
    count: total,
    pagination: buildPaginationMeta({ total, page, limit }),
  });
});

const getEmbroideryStockSummary = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const match = {
    isArchived: { $ne: true },
    ...(isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } }),
  };
  const [summary] = await EmbroideryInventory.aggregate([
    ...(Object.keys(match).length ? [{ $match: match }] : []),
    {
      $group: {
        _id: null,
        totalLots: { $sum: 1 },
        availablePieces: { $sum: "$availablePieces" },
        totalReceivedPieces: { $sum: "$totalReceivedPieces" },
        totalRejectedPieces: { $sum: "$totalRejectedPieces" },
        totalSentOfficePieces: { $sum: "$totalSentOfficePieces" },
        totalSentExportPieces: { $sum: "$totalSentExportPieces" },
      },
    },
  ]);

  return sendSuccess(res, {
    data: {
      totalLots: summary?.totalLots || 0,
      availablePieces: summary?.availablePieces || 0,
      totalReceivedPieces: summary?.totalReceivedPieces || 0,
      totalRejectedPieces: summary?.totalRejectedPieces || 0,
      totalSentOfficePieces: summary?.totalSentOfficePieces || 0,
      totalSentExportPieces: summary?.totalSentExportPieces || 0,
    },
    message: "",
  });
});

const getEmbroideryHistory = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const query = isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } };
  if (req.query.lotId) {
    query.lot = req.query.lotId;
  }
  if (req.query.actionType) {
    query.actionType = req.query.actionType;
  }

  const { page, limit, skip } = getPaginationFromQuery(req.query);
  const total = await EmbroideryTransaction.countDocuments(query);
  const history = await EmbroideryTransaction.find(query)
    .populate("conversion")
    .sort({
      date: -1,
      createdAt: -1,
    })
    .skip(skip)
    .limit(limit);
  const lotIds = history.map((item) => item.lot).filter(Boolean);
  const [pieceLots, fabricLots] = await Promise.all([
    PieceLot.find({ _id: { $in: lotIds } }).select("_id lotNumber").lean(),
    FabricLot.find({ _id: { $in: lotIds } }).select("_id fabricType").lean(),
  ]);
  const pieceLotMap = new Map(pieceLots.map((item) => [String(item._id), item]));
  const fabricLotMap = new Map(fabricLots.map((item) => [String(item._id), item]));

  const data = history.map((item) => {
    const lotKey = String(item.lot || "");
    const pieceLot = pieceLotMap.get(lotKey);
    const fabricLot = fabricLotMap.get(lotKey);
    return {
      ...item.toObject(),
      lot: {
        _id: lotKey,
        lotNumber: pieceLot?.lotNumber || `LOT-${lotKey.slice(-6)}`,
        fabricType: fabricLot?.fabricType || "",
      },
    };
  });

  return sendSuccess(res, {
    data,
    message: "",
    count: total,
    pagination: buildPaginationMeta({ total, page, limit }),
  });
});

const getEmbroideryLotDetails = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const stock = await EmbroideryInventory.findOne({
    lot: req.params.lotId,
    isArchived: { $ne: true },
    ...(isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } }),
  }).lean();
  if (!stock) {
    const error = new Error("Embroidery lot not found");
    error.statusCode = 404;
    throw error;
  }

  const [pieceLot, fabricLot, history] = await Promise.all([
    PieceLot.findById(req.params.lotId).select("lotNumber").lean(),
    FabricLot.findById(req.params.lotId).select("fabricType").lean(),
    EmbroideryTransaction.find({ lot: req.params.lotId }).sort({ date: -1, createdAt: -1 }).lean(),
  ]);

  return sendSuccess(res, {
    data: {
      stock: {
        ...stock,
        lotNumber: pieceLot?.lotNumber || `LOT-${String(req.params.lotId).slice(-6)}`,
        fabricType: stock.fabricType || fabricLot?.fabricType || "Manual",
      },
      history,
    },
    message: "",
  });
});

const archiveEmbroideryLot = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const inventory = await EmbroideryInventory.findOne({
    lot: req.params.lotId,
    isArchived: { $ne: true },
    ...(isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } }),
  });
  if (!inventory) {
    const error = new Error("Embroidery lot not found");
    error.statusCode = 404;
    throw error;
  }

  inventory.isArchived = true;
  inventory.archivedAt = new Date();
  inventory.archivedBy = req.user?.email || req.user?.name || "system";
  inventory.lastUpdatedDate = new Date();
  await inventory.save();

  return sendSuccess(res, {
    data: {
      lotId: req.params.lotId,
      archived: true,
      archivedAt: inventory.archivedAt,
    },
    message: "Embroidery lot archived successfully",
  });
});

const deleteEmbroideryLot = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let responsePayload = null;
    await (async () => {
      const ownedLotIds = await getOwnedFabricLotIds(req);
      const inventory = await EmbroideryInventory.findOne({
        lot: req.params.lotId,
        isArchived: { $ne: true },
        ...(isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } }),
      }).session(session);
      if (!inventory) {
        const error = new Error("Embroidery lot not found");
        error.statusCode = 404;
        throw error;
      }

      const blockedQty =
        Number(inventory.totalRejectedPieces || 0) +
        Number(inventory.totalSentOfficePieces || 0) +
        Number(inventory.totalSentExportPieces || 0) +
        Number(inventory.totalSentFactoryPieces || 0);
      if (blockedQty > 0) {
        const error = new Error(
          "Cannot delete embroidery lot after reject/dispatch/factory transfer operations"
        );
        error.statusCode = 400;
        throw error;
      }

      const rollbackPieces = Number(inventory.totalReceivedPieces || 0);
      const pieceLot = await PieceLot.findOne({ _id: req.params.lotId, isDeleted: { $ne: true } }).session(
        session
      );
      if (pieceLot) {
        pieceLot.sentToEmbroideryPieces = Math.max(
          Number(pieceLot.sentToEmbroideryPieces || 0) - rollbackPieces,
          0
        );
        pieceLot.status = "Available";
        await pieceLot.save({ session });
      }

      await EmbroideryTransaction.deleteMany({ lot: req.params.lotId }).session(session);
      await EmbroideryInventory.deleteOne({ _id: inventory._id }).session(session);

      await MovementLog.create(
        [
          {
            fromStage: "embroidery",
            toStage: "piece_lot",
            lot: req.params.lotId,
            quantity: rollbackPieces,
            unit: "pieces",
            date: new Date(),
            user: req.user?.email || req.user?.name || "system",
          },
        ],
        { session }
      );

      responsePayload = {
        lotId: req.params.lotId,
        restoredToAllLotsPieces: rollbackPieces,
      };
    })();

    return sendSuccess(res, {
      message: "Embroidery lot deleted and quantity restored to all lots",
      data: responsePayload,
    });
  } finally {
    session.endSession();
  }
});

const transferToFactoryWarehouse = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let responsePayload = null;
    await (async () => {
      const { lotId, pieces, grade, notes, date, operatorName } = req.body;
      const ownedLotIds = await getOwnedFabricLotIds(req);
      if (!isAdminUser(req) && !(ownedLotIds || []).some((id) => String(id) === String(lotId))) {
        const error = new Error("Embroidery lot not found");
        error.statusCode = 404;
        throw error;
      }
      const effectiveDate = date || new Date();
      const effectiveOperator = operatorName || req.user?.name || req.user?.email || "system";
      const inventory = await EmbroideryInventory.findOne({ lot: lotId }).session(session);
      if (!inventory) {
        const error = new Error("Embroidery lot not found");
        error.statusCode = 404;
        throw error;
      }
      if (pieces > inventory.availablePieces) {
        const error = new Error("Transfer pieces exceed available embroidery stock");
        error.statusCode = 400;
        throw error;
      }

      inventory.availablePieces -= pieces;
      inventory.totalSentFactoryPieces += pieces;
      inventory.lastUpdatedDate = effectiveDate;
      await inventory.save({ session });

      let factoryInventory = await FactoryWarehouseInventory.findOne({ lot: lotId, grade }).session(
        session
      );
      if (!factoryInventory) {
        const docs = await FactoryWarehouseInventory.create(
          [
            {
              lot: lotId,
              grade,
              availablePieces: pieces,
              totalReceivedPieces: pieces,
              lastUpdatedDate: effectiveDate,
            },
          ],
          { session }
        );
        factoryInventory = docs[0];
      } else {
        factoryInventory.availablePieces += pieces;
        factoryInventory.totalReceivedPieces += pieces;
        factoryInventory.lastUpdatedDate = effectiveDate;
        await factoryInventory.save({ session });
      }

      const txDocs = await EmbroideryTransaction.create(
        [
          {
            lot: lotId,
            actionType: "send_to_factory_warehouse",
            fromStage: "embroidery",
            toStage: "factory_warehouse",
            pieces,
            grade,
            notes: notes || "",
            date: effectiveDate,
            operatorName: effectiveOperator,
          },
        ],
        { session }
      );

      const movementDocs = await MovementLog.create(
        [
          {
            fromStage: "embroidery",
            toStage: "factory_warehouse",
            lot: lotId,
            quantity: pieces,
            unit: "pieces",
            date: effectiveDate,
            user: req.user?.email || effectiveOperator,
          },
        ],
        { session }
      );

      responsePayload = {
        inventory,
        factoryInventory,
        transaction: txDocs[0],
        movementLog: movementDocs[0],
      };
    })();

    return sendSuccess(res, {
      message: "Pieces sent to factory warehouse successfully",
      data: responsePayload,
    });
  } finally {
    session.endSession();
  }
});

const returnFactoryWarehouseToEmbroidery = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let responsePayload = null;
    await (async () => {
      const { inventoryId } = req.params;
      const factoryInventory = await FactoryWarehouseInventory.findById(inventoryId).session(session);
      if (!factoryInventory) {
        const error = new Error("Factory warehouse inventory not found");
        error.statusCode = 404;
        throw error;
      }

      const ownedLotIds = await getOwnedFabricLotIds(req);
      if (
        !isAdminUser(req) &&
        !(ownedLotIds || []).some((id) => String(id) === String(factoryInventory.lot))
      ) {
        const error = new Error("Factory warehouse inventory not found");
        error.statusCode = 404;
        throw error;
      }

      const returnPieces = Number(factoryInventory.availablePieces || 0);
      if (returnPieces <= 0) {
        const error = new Error("No available factory quantity to return");
        error.statusCode = 400;
        throw error;
      }

      const embroideryInventory = await EmbroideryInventory.findOne({
        lot: factoryInventory.lot,
        isArchived: { $ne: true },
      }).session(session);
      if (!embroideryInventory) {
        const error = new Error("Embroidery lot not found");
        error.statusCode = 404;
        throw error;
      }

      embroideryInventory.availablePieces += returnPieces;
      embroideryInventory.totalSentFactoryPieces = Math.max(
        Number(embroideryInventory.totalSentFactoryPieces || 0) - returnPieces,
        0
      );
      embroideryInventory.lastUpdatedDate = new Date();
      await embroideryInventory.save({ session });

      factoryInventory.availablePieces = 0;
      factoryInventory.totalReceivedPieces = Math.max(
        Number(factoryInventory.totalReceivedPieces || 0) - returnPieces,
        0
      );
      factoryInventory.lastUpdatedDate = new Date();

      if (
        Number(factoryInventory.availablePieces || 0) <= 0 &&
        Number(factoryInventory.totalSentOfficePieces || 0) <= 0 &&
        Number(factoryInventory.totalSentExportPieces || 0) <= 0
      ) {
        await FactoryWarehouseInventory.deleteOne({ _id: factoryInventory._id }).session(session);
      } else {
        await factoryInventory.save({ session });
      }

      const effectiveOperator = req.user?.name || req.user?.email || "system";
      const txDocs = await EmbroideryTransaction.create(
        [
          {
            lot: factoryInventory.lot,
            actionType: "return_from_factory_warehouse",
            fromStage: "factory_warehouse",
            toStage: "embroidery",
            pieces: returnPieces,
            grade: factoryInventory.grade || "",
            notes: "Returned from factory balance",
            date: new Date(),
            operatorName: effectiveOperator,
          },
        ],
        { session }
      );

      const movementDocs = await MovementLog.create(
        [
          {
            fromStage: "factory_warehouse",
            toStage: "embroidery",
            lot: factoryInventory.lot,
            quantity: returnPieces,
            unit: "pieces",
            date: new Date(),
            user: req.user?.email || effectiveOperator,
          },
        ],
        { session }
      );

      responsePayload = {
        inventoryId,
        lotId: String(factoryInventory.lot),
        restoredPieces: returnPieces,
        embroideryInventory,
        transaction: txDocs[0],
        movementLog: movementDocs[0],
      };
    })();

    return sendSuccess(res, {
      message: "Factory balance quantity returned to embroidery successfully",
      data: responsePayload,
    });
  } finally {
    session.endSession();
  }
});

module.exports = {
  receiveFromCutting,
  rejectFromEmbroidery,
  dispatchFromEmbroidery,
  getEmbroideryStock,
  getFactoryWarehouseStock,
  getEmbroideryStockSummary,
  getEmbroideryHistory,
  getEmbroideryLotDetails,
  archiveEmbroideryLot,
  deleteEmbroideryLot,
  transferToFactoryWarehouse,
  returnFactoryWarehouseToEmbroidery,
};
