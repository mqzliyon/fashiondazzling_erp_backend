const mongoose = require("mongoose");
const ForeignShipment = require("../models/ForeignShipment");
const EmbroideryInventory = require("../models/EmbroideryInventory");
const FactoryWarehouseInventory = require("../models/FactoryWarehouseInventory");
const MovementLog = require("../models/MovementLog");
const PieceLot = require("../models/PieceLot");
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

const createForeignShipment = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let responsePayload = null;

    await (async () => {
      const ownedLotIds = await getOwnedFabricLotIds(req);
      const {
        country,
        buyerName,
        buyerPhone,
        shipmentNumber,
        lot,
        quantity,
        shipmentDate,
        status,
        source,
        grade,
      } = req.body;
      if (!isAdminUser(req) && !(ownedLotIds || []).some((id) => String(id) === String(lot))) {
        const error = new Error("Lot not found");
        error.statusCode = 404;
        throw error;
      }
      const effectiveDate = shipmentDate || new Date();
      const effectiveSource = source || "embroidery";

      let inventory = null;
      if (effectiveSource === "factory_warehouse") {
        if (!grade) {
          const error = new Error("grade is required when source is factory_warehouse");
          error.statusCode = 400;
          throw error;
        }
        inventory = await FactoryWarehouseInventory.findOne({ lot, grade }).session(session);
        if (!inventory) {
          const error = new Error("Factory warehouse inventory not found for this lot and grade");
          error.statusCode = 404;
          throw error;
        }
        if (quantity > inventory.availablePieces) {
          const error = new Error("Cannot ship more than available factory warehouse pieces");
          error.statusCode = 400;
          throw error;
        }
        inventory.availablePieces -= quantity;
        inventory.totalSentExportPieces += quantity;
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
          const error = new Error("Cannot ship more than available pieces");
          error.statusCode = 400;
          throw error;
        }
        inventory.availablePieces -= quantity;
        if (inventory.availablePieces < 0) {
          const error = new Error("Negative stock is not allowed");
          error.statusCode = 400;
          throw error;
        }
        inventory.totalSentExportPieces += quantity;
        inventory.lastUpdatedDate = effectiveDate;
        await inventory.save({ session });
      }

      const shipmentDocs = await ForeignShipment.create(
        [
          {
            country,
            buyerName: buyerName || "",
            buyerPhone: buyerPhone || "",
            shipmentNumber,
            lot,
            quantity,
            shipmentDate: effectiveDate,
            status: status || "Packed",
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
            toStage: "export",
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
        shipment: shipmentDocs[0],
        inventory,
        movementLog: movementDocs[0],
      };
    })();

    return sendSuccess(res, {
      status: 201,
      message: "Foreign shipment created successfully",
      data: responsePayload,
    });
  } finally {
    session.endSession();
  }
});

const getForeignShipments = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const query = isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } };
  if (req.query.country) {
    query.country = req.query.country;
  }
  if (req.query.status) {
    query.status = req.query.status;
  }

  const { page, limit, skip } = getPaginationFromQuery(req.query);
  const total = await ForeignShipment.countDocuments(query);
  const shipments = await ForeignShipment.find(query)
    .sort({ shipmentDate: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  const lotIds = shipments.map((item) => item.lot).filter(Boolean);
  const pieceLots = await PieceLot.find({ _id: { $in: lotIds } }).select("_id lotNumber").lean();
  const pieceLotMap = new Map(pieceLots.map((item) => [String(item._id), item.lotNumber]));
  const data = shipments.map((item) => ({
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

const getForeignShipmentById = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const shipment = await ForeignShipment.findOne({
    _id: req.params.id,
    ...(isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } }),
  }).lean();
  if (!shipment) {
    const error = new Error("Foreign shipment not found");
    error.statusCode = 404;
    throw error;
  }

  const pieceLot = await PieceLot.findById(shipment.lot).select("lotNumber").lean();

  return sendSuccess(res, {
    data: {
      ...shipment,
      lot: {
        _id: String(shipment.lot || ""),
        lotNumber:
          pieceLot?.lotNumber || `LOT-${String(shipment.lot || "").slice(-6)}`,
      },
    },
    message: "",
  });
});

const updateForeignShipmentStatus = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const shipment = await ForeignShipment.findOne({
    _id: req.params.id,
    ...(isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } }),
  });
  if (!shipment) {
    const error = new Error("Foreign shipment not found");
    error.statusCode = 404;
    throw error;
  }

  shipment.status = req.body.status;
  await shipment.save();

  return sendSuccess(res, { data: shipment, message: "Status updated" });
});

const deleteForeignShipment = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let responsePayload = null;
    await (async () => {
      const ownedLotIds = await getOwnedFabricLotIds(req);
      const shipment = await ForeignShipment.findOne({
        _id: req.params.id,
        ...(isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } }),
      }).session(session);
      if (!shipment) {
        const error = new Error("Foreign shipment not found");
        error.statusCode = 404;
        throw error;
      }

      const qty = Number(shipment.quantity || 0);
      const effectiveDate = new Date();
      let restoredInventory = null;

      if (shipment.source === "factory_warehouse") {
        if (!shipment.grade) {
          const error = new Error("Shipment grade is missing for factory rollback");
          error.statusCode = 400;
          throw error;
        }
        restoredInventory = await FactoryWarehouseInventory.findOne({
          lot: shipment.lot,
          grade: shipment.grade,
        }).session(session);
        if (!restoredInventory) {
          const error = new Error("Factory warehouse inventory not found for rollback");
          error.statusCode = 404;
          throw error;
        }
        restoredInventory.availablePieces += qty;
        restoredInventory.totalSentExportPieces = Math.max(
          Number(restoredInventory.totalSentExportPieces || 0) - qty,
          0
        );
        restoredInventory.lastUpdatedDate = effectiveDate;
        await restoredInventory.save({ session });
      } else {
        restoredInventory = await EmbroideryInventory.findOne({ lot: shipment.lot }).session(session);
        if (!restoredInventory) {
          const error = new Error("Embroidery inventory not found for rollback");
          error.statusCode = 404;
          throw error;
        }
        restoredInventory.availablePieces += qty;
        restoredInventory.totalSentExportPieces = Math.max(
          Number(restoredInventory.totalSentExportPieces || 0) - qty,
          0
        );
        restoredInventory.lastUpdatedDate = effectiveDate;
        await restoredInventory.save({ session });
      }

      await MovementLog.create(
        [
          {
            fromStage: "export",
            toStage: shipment.source === "factory_warehouse" ? "factory_warehouse" : "embroidery",
            lot: shipment.lot,
            quantity: qty,
            unit: "pieces",
            date: effectiveDate,
            user: req.user?.email || req.user?.name || "system",
          },
        ],
        { session }
      );

      await ForeignShipment.deleteOne({ _id: shipment._id }).session(session);

      responsePayload = {
        deletedShipmentId: String(shipment._id),
        lotId: String(shipment.lot),
        restoredPieces: qty,
        restoredTo: shipment.source || "embroidery",
        grade: shipment.grade || "",
      };
    })();

    return sendSuccess(res, {
      message: "Foreign shipment deleted and quantity restored to source stock",
      data: responsePayload,
    });
  } finally {
    session.endSession();
  }
});

module.exports = {
  createForeignShipment,
  getForeignShipments,
  getForeignShipmentById,
  updateForeignShipmentStatus,
  deleteForeignShipment,
};
