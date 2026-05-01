const mongoose = require("mongoose");
const OfficeDispatch = require("../models/OfficeDispatch");
const EmbroideryInventory = require("../models/EmbroideryInventory");
const FactoryWarehouseInventory = require("../models/FactoryWarehouseInventory");
const MovementLog = require("../models/MovementLog");
const PieceLot = require("../models/PieceLot");
const EmbroideryTransaction = require("../models/EmbroideryTransaction");
const ForeignShipment = require("../models/ForeignShipment");
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

async function ensureFactoryInventory(session, lot, grade, effectiveDate) {
  let inventory = await FactoryWarehouseInventory.findOne({ lot, grade }).session(session);
  if (inventory) return inventory;

  const [receivedAgg] = await EmbroideryTransaction.aggregate([
    {
      $match: {
        lot: new mongoose.Types.ObjectId(String(lot)),
        actionType: "send_to_factory_warehouse",
        grade,
      },
    },
    { $group: { _id: null, total: { $sum: "$pieces" } } },
  ]).session(session);

  const [officeSentAgg] = await OfficeDispatch.aggregate([
    {
      $match: {
        lot: new mongoose.Types.ObjectId(String(lot)),
        source: "factory_warehouse",
        grade,
      },
    },
    { $group: { _id: null, total: { $sum: "$quantity" } } },
  ]).session(session);

  const [exportSentAgg] = await ForeignShipment.aggregate([
    {
      $match: {
        lot: new mongoose.Types.ObjectId(String(lot)),
        source: "factory_warehouse",
        grade,
      },
    },
    { $group: { _id: null, total: { $sum: "$quantity" } } },
  ]).session(session);

  const totalReceived = Number(receivedAgg?.total || 0);
  const totalSentOffice = Number(officeSentAgg?.total || 0);
  const totalSentExport = Number(exportSentAgg?.total || 0);
  const availablePieces = Math.max(totalReceived - totalSentOffice - totalSentExport, 0);

  const docs = await FactoryWarehouseInventory.create(
    [
      {
        lot,
        grade,
        availablePieces,
        totalReceivedPieces: totalReceived,
        totalSentOfficePieces: totalSentOffice,
        totalSentExportPieces: totalSentExport,
        lastUpdatedDate: effectiveDate || new Date(),
      },
    ],
    { session }
  );
  return docs[0];
}

const createOfficeDispatch = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let responsePayload = null;

    await (async () => {
      const ownedLotIds = await getOwnedFabricLotIds(req);
      const { office, lot, quantity, dispatchDate, referenceNo, status, source, grade } = req.body;
      if (!isAdminUser(req) && !(ownedLotIds || []).some((id) => String(id) === String(lot))) {
        const error = new Error("Lot not found");
        error.statusCode = 404;
        throw error;
      }
      const effectiveDate = dispatchDate || new Date();
      const effectiveStatus = status || "dispatched";
      const effectiveSource = source || "embroidery";

      let inventory = null;
      if (effectiveSource === "factory_warehouse") {
        if (!grade) {
          const error = new Error("grade is required when source is factory_warehouse");
          error.statusCode = 400;
          throw error;
        }
        inventory = await ensureFactoryInventory(session, lot, grade, effectiveDate);
        if (!inventory) {
          const error = new Error("Factory warehouse inventory not found for this lot and grade");
          error.statusCode = 404;
          throw error;
        }
        if (quantity > inventory.availablePieces) {
          const error = new Error("Cannot dispatch more than available factory warehouse pieces");
          error.statusCode = 400;
          throw error;
        }
        inventory.availablePieces -= quantity;
        inventory.totalSentOfficePieces += quantity;
        inventory.lastUpdatedDate = effectiveDate;
        await inventory.save({ session });
      } else {
        inventory = await EmbroideryInventory.findOne({ lot }).session(session);
        if (!inventory) {
          const error = new Error("Embroidery inventory not found for this lot");
          error.statusCode = 404;
          throw error;
        }
        if (quantity > inventory.availablePieces) {
          const error = new Error("Cannot dispatch more than available pieces");
          error.statusCode = 400;
          throw error;
        }
        inventory.availablePieces -= quantity;
        inventory.totalSentOfficePieces += quantity;
        inventory.lastUpdatedDate = effectiveDate;
        await inventory.save({ session });
      }

      const dispatchDocs = await OfficeDispatch.create(
        [
          {
            office,
            lot,
            quantity,
            dispatchDate: effectiveDate,
            referenceNo,
            status: effectiveStatus,
            source: effectiveSource,
            grade: grade || "",
          },
        ],
        { session }
      );

      const movementDocs = await MovementLog.create(
        [
          {
            fromStage: effectiveSource === "factory_warehouse" ? "factory_warehouse" : "embroidery",
            toStage: "office",
            lot,
            quantity,
            unit: "pieces",
            date: effectiveDate,
            user: req.user?.email || "system",
          },
        ],
        { session }
      );

      responsePayload = {
        dispatch: dispatchDocs[0],
        inventory,
        movementLog: movementDocs[0],
      };
    })();

    return sendSuccess(res, {
      status: 201,
      message: "Products dispatched to office successfully",
      data: responsePayload,
    });
  } finally {
    session.endSession();
  }
});

const getOfficeDispatches = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const query = isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } };
  if (req.query.office) {
    query.office = req.query.office;
  }
  if (req.query.status) {
    query.status = req.query.status;
  }

  const { page, limit, skip } = getPaginationFromQuery(req.query);
  const total = await OfficeDispatch.countDocuments(query);
  const dispatches = await OfficeDispatch.find(query)
    .sort({ dispatchDate: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  const lotIds = dispatches.map((item) => item.lot).filter(Boolean);
  const pieceLots = await PieceLot.find({ _id: { $in: lotIds } }).select("_id lotNumber").lean();
  const pieceLotMap = new Map(pieceLots.map((item) => [String(item._id), item.lotNumber]));
  const data = dispatches.map((item) => ({
    ...item,
    lot: {
      _id: String(item.lot || ""),
      lotNumber: pieceLotMap.get(String(item.lot || "")) || `LOT-${String(item.lot || "").slice(-6)}`,
    },
  }));

  return sendSuccess(res, {
    data,
    message: "",
    count: total,
    pagination: buildPaginationMeta({ total, page, limit }),
  });
});

const getOfficeDispatchById = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const dispatch = await OfficeDispatch.findOne({
    _id: req.params.id,
    ...(isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } }),
  }).lean();
  if (!dispatch) {
    const error = new Error("Office dispatch not found");
    error.statusCode = 404;
    throw error;
  }
  const pieceLot = await PieceLot.findById(dispatch.lot).select("lotNumber").lean();

  return sendSuccess(res, {
    data: {
      ...dispatch,
      lot: {
        _id: String(dispatch.lot || ""),
        lotNumber:
          pieceLot?.lotNumber || `LOT-${String(dispatch.lot || "").slice(-6)}`,
      },
    },
    message: "",
  });
});

const updateOfficeDispatchStatus = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const dispatch = await OfficeDispatch.findOne({
    _id: req.params.id,
    ...(isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } }),
  });
  if (!dispatch) {
    const error = new Error("Office dispatch not found");
    error.statusCode = 404;
    throw error;
  }

  dispatch.status = req.body.status;
  await dispatch.save();

  return sendSuccess(res, { data: dispatch, message: "Status updated" });
});

const deleteOfficeDispatch = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let responsePayload = null;
    await (async () => {
      const ownedLotIds = await getOwnedFabricLotIds(req);
      const dispatch = await OfficeDispatch.findOne({
        _id: req.params.id,
        ...(isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } }),
      }).session(session);
      if (!dispatch) {
        const error = new Error("Office dispatch not found");
        error.statusCode = 404;
        throw error;
      }

      const qty = Number(dispatch.quantity || 0);
      const effectiveDate = new Date();
      let restoredInventory = null;

      if (dispatch.source === "factory_warehouse") {
        if (!dispatch.grade) {
          const error = new Error("Dispatch grade is missing");
          error.statusCode = 400;
          throw error;
        }
        restoredInventory = await FactoryWarehouseInventory.findOne({
          lot: dispatch.lot,
          grade: dispatch.grade,
        }).session(session);
        if (!restoredInventory) {
          const error = new Error("Factory warehouse inventory not found for rollback");
          error.statusCode = 404;
          throw error;
        }
        restoredInventory.availablePieces += qty;
        restoredInventory.totalSentOfficePieces = Math.max(
          Number(restoredInventory.totalSentOfficePieces || 0) - qty,
          0
        );
        restoredInventory.lastUpdatedDate = effectiveDate;
        await restoredInventory.save({ session });
      } else {
        restoredInventory = await EmbroideryInventory.findOne({ lot: dispatch.lot }).session(session);
        if (!restoredInventory) {
          const error = new Error("Embroidery inventory not found for rollback");
          error.statusCode = 404;
          throw error;
        }
        restoredInventory.availablePieces += qty;
        restoredInventory.totalSentOfficePieces = Math.max(
          Number(restoredInventory.totalSentOfficePieces || 0) - qty,
          0
        );
        restoredInventory.lastUpdatedDate = effectiveDate;
        await restoredInventory.save({ session });
      }

      await MovementLog.create(
        [
          {
            fromStage: "office",
            toStage: dispatch.source === "factory_warehouse" ? "factory_warehouse" : "embroidery",
            lot: dispatch.lot,
            quantity: qty,
            unit: "pieces",
            date: effectiveDate,
            user: req.user?.email || req.user?.name || "system",
          },
        ],
        { session }
      );

      await OfficeDispatch.deleteOne({ _id: dispatch._id }).session(session);
      responsePayload = {
        deletedDispatchId: String(dispatch._id),
        lotId: String(dispatch.lot),
        restoredPieces: qty,
        restoredTo: dispatch.source || "embroidery",
      };
    })();

    return sendSuccess(res, {
      message: "Office dispatch deleted and quantity restored to source stock",
      data: responsePayload,
    });
  } finally {
    session.endSession();
  }
});

module.exports = {
  createOfficeDispatch,
  getOfficeDispatches,
  getOfficeDispatchById,
  updateOfficeDispatchStatus,
  deleteOfficeDispatch,
};
