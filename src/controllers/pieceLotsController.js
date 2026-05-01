const mongoose = require("mongoose");
const PieceLot = require("../models/PieceLot");
const MovementLog = require("../models/MovementLog");
const CuttingBatch = require("../models/CuttingBatch");
const EmbroideryInventory = require("../models/EmbroideryInventory");
const EmbroideryTransaction = require("../models/EmbroideryTransaction");
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

const createPieceLot = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let created = null;
    await (async () => {
      const lotNumber = req.body.lotNumber.trim();
      const date = req.body.date || new Date();
      const notes = req.body.notes || "";

      const docs = await PieceLot.create(
        [
          {
            lotNumber,
            completionDate: date,
            notes,
            fabricType: "Manual",
            fabricSource: "Manual",
            createdByUserId: req.user?._id || null,
            convertedKg: 0,
            outputPieces: 0,
            yieldRatio: 0,
            status: "Available",
          },
        ],
        { session }
      );
      created = docs[0];
    })();

    return sendSuccess(res, {
      status: 201,
      data: created,
      message: "Piece lot created",
    });
  } finally {
    session.endSession();
  }
});

const getPieceLots = asyncHandler(async (req, res) => {
  const includeAuto =
    String(req.query.includeAuto || "false").toLowerCase() === "true";
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const filter = {
    isDeleted: { $ne: true },
    ...(includeAuto ? {} : { fabricSource: "Manual" }),
    ...(isAdminUser(req)
      ? {}
      : {
          $or: [
            { createdByUserId: req.user?._id || null },
            { fabricLotId: { $in: ownedLotIds || [] } },
          ],
        }),
  };

  const { page, limit, skip } = getPaginationFromQuery(req.query);
  const total = await PieceLot.countDocuments(filter);
  const lots = await PieceLot.find(filter)
    .sort({
      completionDate: -1,
      createdAt: -1,
    })
    .skip(skip)
    .limit(limit);
  const data = lots.map((lot) => {
    const obj = lot.toObject();
    const sent = Number(obj.sentToEmbroideryPieces || 0);
    const total = Number(obj.outputPieces || 0);
    return {
      ...obj,
      availablePieces: Math.max(total - sent, 0),
    };
  });
  return sendSuccess(res, {
    data,
    message: "",
    count: total,
    pagination: buildPaginationMeta({ total, page, limit }),
  });
});

const getPieceLotById = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const lot = await PieceLot.findOne({
    _id: req.params.id,
    isDeleted: { $ne: true },
    ...(isAdminUser(req)
      ? {}
      : {
          $or: [
            { createdByUserId: req.user?._id || null },
            { fabricLotId: { $in: ownedLotIds || [] } },
          ],
        }),
  });
  if (!lot) {
    const error = new Error("Lot not found");
    error.statusCode = 404;
    throw error;
  }

  const movementHistory = await MovementLog.find({ lot: lot._id })
    .sort({ date: -1, createdAt: -1 })
    .select("fromStage toStage quantity unit date user createdAt");

  const lotObj = lot.toObject();
  const sent = Number(lotObj.sentToEmbroideryPieces || 0);
  const total = Number(lotObj.outputPieces || 0);
  return sendSuccess(res, {
    data: {
      lot: {
        ...lotObj,
        availablePieces: Math.max(total - sent, 0),
      },
      movementHistory,
    },
    message: "",
  });
});

const updatePieceLot = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let updated = null;
    await (async () => {
      const lot = await PieceLot.findOne({ _id: req.params.id, isDeleted: { $ne: true } }).session(
        session
      );
      const ownedLotIds = await getOwnedFabricLotIds(req);
      const ownershipOk =
        isAdminUser(req) ||
        String(lot?.createdByUserId || "") === String(req.user?._id || "") ||
        (lot?.fabricLotId && (ownedLotIds || []).some((id) => String(id) === String(lot.fabricLotId)));
      if (!ownershipOk) {
        const error = new Error("Lot not found");
        error.statusCode = 404;
        throw error;
      }
      if (!lot) {
        const error = new Error("Lot not found");
        error.statusCode = 404;
        throw error;
      }

      if (req.body.lotNumber !== undefined) lot.lotNumber = req.body.lotNumber.trim();
      if (req.body.date !== undefined) lot.completionDate = req.body.date;
      if (req.body.notes !== undefined) lot.notes = req.body.notes;
      await lot.save({ session });
      updated = lot;
    })();

    return sendSuccess(res, { data: updated, message: "Piece lot updated" });
  } finally {
    session.endSession();
  }
});

const deletePieceLot = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await (async () => {
      const lot = await PieceLot.findOne({ _id: req.params.id, isDeleted: { $ne: true } }).session(
        session
      );
      const ownedLotIds = await getOwnedFabricLotIds(req);
      const ownershipOk =
        isAdminUser(req) ||
        String(lot?.createdByUserId || "") === String(req.user?._id || "") ||
        (lot?.fabricLotId && (ownedLotIds || []).some((id) => String(id) === String(lot.fabricLotId)));
      if (!ownershipOk) {
        const error = new Error("Lot not found");
        error.statusCode = 404;
        throw error;
      }
      if (!lot) {
        const error = new Error("Lot not found");
        error.statusCode = 404;
        throw error;
      }

      const rollbackPieces = Number(lot.receivedFromCompletePieces || 0);
      const fabricType = String(lot.fabricType || "").trim();
      if (rollbackPieces > 0 && fabricType && fabricType !== "Manual") {
        const batches = await CuttingBatch.find({
          fabricType,
          isDeleted: { $ne: true },
        }).session(session);

        const historyPointers = [];
        for (const batch of batches) {
          const history = Array.isArray(batch.conversionHistory) ? batch.conversionHistory : [];
          history.forEach((item, idx) => {
            const sentQty = Number(item.sentPieces || 0);
            if (sentQty > 0) {
              historyPointers.push({ batch, idx, sentQty });
            }
          });
        }

        let remaining = rollbackPieces;
        for (const pointer of historyPointers) {
          if (remaining <= 0) break;
          const takeBack = Math.min(pointer.sentQty, remaining);
          const row = pointer.batch.conversionHistory[pointer.idx];
          row.sentPieces = Math.max(Number(row.sentPieces || 0) - takeBack, 0);
          remaining -= takeBack;
        }

        await Promise.all(batches.map((batch) => batch.save({ session })));

        await MovementLog.create(
          [
            {
              fromStage: "piece_lot",
              toStage: "complete_cutting",
              lot: lot._id,
              quantity: rollbackPieces,
              unit: "pieces",
              date: new Date(),
              user: req.user?.email || req.user?.name || "system",
            },
          ],
          { session }
        );
      }

      lot.isDeleted = true;
      lot.deletedAt = new Date();
      lot.deletedBy = req.user?.email || req.user?.name || "system";
      await lot.save({ session });
    })();
    return sendSuccess(res, {
      data: { id: String(req.params.id) },
      message: "Lot deleted successfully",
    });
  } finally {
    session.endSession();
  }
});

const sendPieceLotToEmbroidery = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let responsePayload = null;
    await (async () => {
      const lot = await PieceLot.findOne({ _id: req.params.id, isDeleted: { $ne: true } }).session(
        session
      );
      const ownedLotIds = await getOwnedFabricLotIds(req);
      const ownershipOk =
        isAdminUser(req) ||
        String(lot?.createdByUserId || "") === String(req.user?._id || "") ||
        (lot?.fabricLotId && (ownedLotIds || []).some((id) => String(id) === String(lot.fabricLotId)));
      if (!ownershipOk) {
        const error = new Error("Lot not found");
        error.statusCode = 404;
        throw error;
      }
      if (!lot) {
        const error = new Error("Lot not found");
        error.statusCode = 404;
        throw error;
      }
      const pieces = Number(req.body.pieces || 0);
      if (Number.isNaN(pieces) || pieces <= 0) {
        const error = new Error("pieces must be a positive number");
        error.statusCode = 400;
        throw error;
      }
      const availablePieces = Math.max(
        Number(lot.outputPieces || 0) - Number(lot.sentToEmbroideryPieces || 0),
        0
      );
      if (pieces > availablePieces) {
        const error = new Error("Cannot send more than available pieces");
        error.statusCode = 400;
        throw error;
      }

      lot.sentToEmbroideryPieces = Number(lot.sentToEmbroideryPieces || 0) + pieces;
      const nextAvailable = Math.max(
        Number(lot.outputPieces || 0) - Number(lot.sentToEmbroideryPieces || 0),
        0
      );
      lot.status = nextAvailable <= 0 ? "Sent to Embroidery" : "Available";
      if (req.body.notes) {
        lot.notes = `${lot.notes || ""}${lot.notes ? "\n" : ""}Embroidery: ${req.body.notes}`;
      }
      await lot.save({ session });

      let embroideryInventory = await EmbroideryInventory.findOne({ lot: lot._id }).session(
        session
      );
      if (!embroideryInventory) {
        const docs = await EmbroideryInventory.create(
          [
            {
              lot: lot._id,
              fabricType: lot.fabricType || "Manual",
              availablePieces: pieces,
              totalReceivedPieces: pieces,
              lastUpdatedDate: req.body.date || new Date(),
            },
          ],
          { session }
        );
        embroideryInventory = docs[0];
      } else {
        embroideryInventory.availablePieces += pieces;
        embroideryInventory.totalReceivedPieces += pieces;
        embroideryInventory.lastUpdatedDate = req.body.date || new Date();
        await embroideryInventory.save({ session });
      }

      const txDocs = await EmbroideryTransaction.create(
        [
          {
            lot: lot._id,
            actionType: "receive_from_cutting",
            fromStage: "piece_lot",
            toStage: "embroidery",
            pieces,
            reason: req.body.notes || "",
            date: req.body.date || new Date(),
            operatorName: req.user?.email || req.user?.name || "system",
          },
        ],
        { session }
      );

      const movementDocs = await MovementLog.create(
        [
          {
            fromStage: "piece_lot",
            toStage: "embroidery",
            lot: lot._id,
            quantity: pieces,
            unit: "pieces",
            date: req.body.date || new Date(),
            user: req.user?.email || req.user?.name || "system",
          },
        ],
        { session }
      );

      responsePayload = {
        lot,
        sentPieces: pieces,
        availablePiecesAfter: Math.max(
          Number(lot.outputPieces || 0) - Number(lot.sentToEmbroideryPieces || 0),
          0
        ),
        embroideryInventory,
        embroideryTransaction: txDocs[0],
        movementLog: movementDocs[0],
      };
    })();

    return sendSuccess(res, {
      data: responsePayload,
      message: "Lot sent to embroidery successfully",
    });
  } finally {
    session.endSession();
  }
});

module.exports = {
  createPieceLot,
  getPieceLots,
  getPieceLotById,
  updatePieceLot,
  deletePieceLot,
  sendPieceLotToEmbroidery,
};

