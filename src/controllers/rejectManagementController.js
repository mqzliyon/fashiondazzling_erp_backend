const mongoose = require("mongoose");
const RejectManagement = require("../models/RejectManagement");
const RejectInventory = require("../models/RejectInventory");
const EmbroideryInventory = require("../models/EmbroideryInventory");
const EmbroideryTransaction = require("../models/EmbroideryTransaction");
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

const createRejectEntry = asyncHandler(async (req, res) => {
  const reject = await RejectManagement.create(req.body);

  return sendSuccess(res, {
    status: 201,
    data: reject,
    message: "Reject entry created",
  });
});

const getRejectEntries = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  // Backfill embroidery rejects that were recorded in transaction history
  // before RejectManagement syncing was introduced.
  const embroideryRejectTx = await EmbroideryTransaction.find({
    actionType: "reject",
    ...(isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } }),
  })
    .select("lot pieces reason date")
    .lean();
  if (embroideryRejectTx.length > 0) {
    const existingEmbroideryEntries = await RejectManagement.find({
      stage: "embroidery",
      ...(isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } }),
    })
      .select("lot quantity date")
      .lean();
    const existingKeySet = new Set(
      existingEmbroideryEntries.map(
        (item) => `${String(item.lot)}|${Number(item.quantity)}|${new Date(item.date).toISOString()}`
      )
    );

    const missingDocs = embroideryRejectTx
      .filter((tx) => {
        const key = `${String(tx.lot)}|${Number(tx.pieces)}|${new Date(tx.date).toISOString()}`;
        return !existingKeySet.has(key);
      })
      .map((tx) => ({
        lot: tx.lot,
        stage: "embroidery",
        quantity: Number(tx.pieces || 0),
        reason: (tx.reason || "").trim(),
        date: tx.date || new Date(),
      }))
      .filter((doc) => doc.quantity > 0);

    if (missingDocs.length > 0) {
      await RejectManagement.insertMany(missingDocs, { ordered: false });
    }
  }

  const query = isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } };

  if (req.query.lot) {
    query.lot = req.query.lot;
  }
  if (req.query.stage) {
    query.stage = req.query.stage;
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

  const { page, limit, skip } = getPaginationFromQuery(req.query);
  const total = await RejectManagement.countDocuments(query);
  const entries = await RejectManagement.find(query)
    .sort({ date: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  const lotIds = entries.map((item) => item.lot).filter(Boolean);
  const pieceLots = await PieceLot.find({ _id: { $in: lotIds } }).select("_id lotNumber").lean();
  const pieceLotMap = new Map(pieceLots.map((item) => [String(item._id), item.lotNumber]));
  const data = entries.map((item) => ({
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

const getRejectSummary = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const match = isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } };
  if (req.query.startDate || req.query.endDate) {
    match.date = {};
    if (req.query.startDate) {
      match.date.$gte = new Date(req.query.startDate);
    }
    if (req.query.endDate) {
      match.date.$lte = new Date(req.query.endDate);
    }
  }

  const [overall] = await RejectManagement.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalRejected: { $sum: "$quantity" },
        entries: { $sum: 1 },
      },
    },
  ]);

  const byStage = await RejectManagement.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$stage",
        totalRejected: { $sum: "$quantity" },
        entries: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const byLot = await RejectManagement.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$lot",
        totalRejected: { $sum: "$quantity" },
        entries: { $sum: 1 },
      },
    },
    { $sort: { totalRejected: -1 } },
    { $limit: 20 },
    {
      $lookup: {
        from: "fabriclots",
        localField: "_id",
        foreignField: "_id",
        as: "lot",
      },
    },
    {
      $project: {
        _id: 1,
        totalRejected: 1,
        entries: 1,
        fabricType: { $arrayElemAt: ["$lot.fabricType", 0] },
      },
    },
  ]);

  return sendSuccess(res, {
    data: {
      overall: {
        totalRejected: overall?.totalRejected || 0,
        entries: overall?.entries || 0,
      },
      byStage,
      byLot,
    },
    message: "",
  });
});

module.exports = {
  createRejectEntry,
  getRejectEntries,
  getRejectSummary,
  deleteRejectEntry: asyncHandler(async (req, res) => {
    const session = await mongoose.startSession();
    try {
      let responsePayload = null;
      await (async () => {
        const ownedLotIds = await getOwnedFabricLotIds(req);
        const entry = await RejectManagement.findOne({
          _id: req.params.entryId,
          ...(isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } }),
        }).session(session);
        if (!entry) {
          const error = new Error("Reject entry not found");
          error.statusCode = 404;
          throw error;
        }

        if (entry.stage !== "embroidery") {
          const error = new Error("Only embroidery reject entries can be deleted");
          error.statusCode = 400;
          throw error;
        }

        const qty = Number(entry.quantity || 0);
        const lotId = entry.lot;

        const inventory = await EmbroideryInventory.findOne({ lot: lotId }).session(session);
        if (!inventory) {
          const error = new Error("Embroidery inventory not found for this lot");
          error.statusCode = 404;
          throw error;
        }

        inventory.availablePieces += qty;
        inventory.totalRejectedPieces = Math.max(Number(inventory.totalRejectedPieces || 0) - qty, 0);
        inventory.lastUpdatedDate = new Date();
        await inventory.save({ session });

        const rejectInventory = await RejectInventory.findOne({ lot: lotId }).session(session);
        if (rejectInventory) {
          rejectInventory.totalRejectedPieces = Math.max(
            Number(rejectInventory.totalRejectedPieces || 0) - qty,
            0
          );
          rejectInventory.lastRejectDate = new Date();
          await rejectInventory.save({ session });
        }

        await EmbroideryTransaction.deleteOne({
          lot: lotId,
          actionType: "reject",
          pieces: qty,
          date: entry.date,
        }).session(session);

        await MovementLog.create(
          [
            {
              fromStage: "reject_inventory",
              toStage: "embroidery",
              lot: lotId,
              quantity: qty,
              unit: "pieces",
              date: new Date(),
              user: req.user?.email || req.user?.name || "system",
            },
          ],
          { session }
        );

        await RejectManagement.deleteOne({ _id: entry._id }).session(session);

        responsePayload = {
          deletedEntryId: String(entry._id),
          lotId: String(lotId),
          restoredPieces: qty,
        };
      })();

      return sendSuccess(res, {
        message: "Reject entry deleted and quantity restored to embroidery stock",
        data: responsePayload,
      });
    } finally {
      session.endSession();
    }
  }),
};
