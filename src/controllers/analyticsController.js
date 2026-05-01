const CuttingConversion = require("../models/CuttingConversion");
const RejectManagement = require("../models/RejectManagement");
const ForeignShipment = require("../models/ForeignShipment");
const OfficeDispatch = require("../models/OfficeDispatch");
const { isAdminUser, getOwnedFabricLotIds } = require("../utils/ownership");
const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const { getPaginationFromQuery, paginateArray } = require("../utils/pagination");

async function getProductionAndRejectTotals(match = {}) {
  const [productionAgg, rejectAgg] = await Promise.all([
    CuttingConversion.aggregate([
      ...(Object.keys(match).length ? [{ $match: match }] : []),
      {
        $group: {
          _id: null,
          totalProducedPieces: { $sum: "$outputPieces" },
          totalInputKg: { $sum: "$inputKg" },
        },
      },
    ]),
    RejectManagement.aggregate([
      ...(Object.keys(match).length ? [{ $match: match }] : []),
      {
        $group: {
          _id: null,
          totalRejectedPieces: { $sum: "$quantity" },
        },
      },
    ]),
  ]);

  const totalProducedPieces = productionAgg[0]?.totalProducedPieces || 0;
  const totalInputKg = productionAgg[0]?.totalInputKg || 0;
  const totalRejectedPieces = rejectAgg[0]?.totalRejectedPieces || 0;

  const goodPieces = Math.max(totalProducedPieces - totalRejectedPieces, 0);
  const productionYield =
    totalProducedPieces > 0 ? (goodPieces / totalProducedPieces) * 100 : 0;
  const rejectRate =
    totalProducedPieces > 0 ? (totalRejectedPieces / totalProducedPieces) * 100 : 0;

  return {
    totalProducedPieces,
    totalInputKg,
    totalRejectedPieces,
    goodPieces,
    productionYield: Number(productionYield.toFixed(2)),
    rejectRate: Number(rejectRate.toFixed(2)),
  };
}

const getQualityMetrics = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const lotMatch = isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } };
  const metrics = await getProductionAndRejectTotals(lotMatch);
  return sendSuccess(res, {
    data: {
      productionYield: metrics.productionYield,
      rejectRate: metrics.rejectRate,
      totalProducedPieces: metrics.totalProducedPieces,
      totalRejectedPieces: metrics.totalRejectedPieces,
      goodPieces: metrics.goodPieces,
    },
    message: "",
  });
});

const getMonthlyProduction = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const lotMatch = isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } };
  const monthly = await CuttingConversion.aggregate([
    ...(Object.keys(lotMatch).length ? [{ $match: lotMatch }] : []),
    {
      $group: {
        _id: {
          year: { $year: "$date" },
          month: { $month: "$date" },
        },
        totalOutputPieces: { $sum: "$outputPieces" },
        totalInputKg: { $sum: "$inputKg" },
        conversions: { $sum: 1 },
      },
    },
    {
      $sort: {
        "_id.year": 1,
        "_id.month": 1,
      },
    },
  ]);

  const mapped = monthly.map((item) => ({
    year: item._id.year,
    month: item._id.month,
    totalOutputPieces: Number(item.totalOutputPieces.toFixed(2)),
    totalInputKg: Number(item.totalInputKg.toFixed(2)),
    conversions: item.conversions,
  }));
  const { page, limit } = getPaginationFromQuery(req.query);
  const { data, total, pagination } = paginateArray(mapped, page, limit);
  return sendSuccess(res, {
    data,
    message: "",
    count: total,
    pagination,
  });
});

const getShipmentTotals = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const lotMatch = isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } };
  const [overall, byStatus, byCountry] = await Promise.all([
    ForeignShipment.aggregate([
      ...(Object.keys(lotMatch).length ? [{ $match: lotMatch }] : []),
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: "$quantity" },
          totalShipments: { $sum: 1 },
        },
      },
    ]),
    ForeignShipment.aggregate([
      ...(Object.keys(lotMatch).length ? [{ $match: lotMatch }] : []),
      {
        $group: {
          _id: "$status",
          quantity: { $sum: "$quantity" },
          shipments: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    ForeignShipment.aggregate([
      ...(Object.keys(lotMatch).length ? [{ $match: lotMatch }] : []),
      {
        $group: {
          _id: "$country",
          quantity: { $sum: "$quantity" },
          shipments: { $sum: 1 },
        },
      },
      { $sort: { quantity: -1 } },
    ]),
  ]);

  return sendSuccess(res, {
    data: {
      overall: {
        totalQuantity: overall[0]?.totalQuantity || 0,
        totalShipments: overall[0]?.totalShipments || 0,
      },
      byStatus: byStatus.map((item) => ({
        status: item._id,
        quantity: item.quantity,
        shipments: item.shipments,
      })),
      byCountry: byCountry.map((item) => ({
        country: item._id,
        quantity: item.quantity,
        shipments: item.shipments,
      })),
    },
    message: "",
  });
});

const getOfficeDispatchTotals = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const lotMatch = isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } };
  const [overall, byStatus, byOffice] = await Promise.all([
    OfficeDispatch.aggregate([
      ...(Object.keys(lotMatch).length ? [{ $match: lotMatch }] : []),
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: "$quantity" },
          totalDispatches: { $sum: 1 },
        },
      },
    ]),
    OfficeDispatch.aggregate([
      ...(Object.keys(lotMatch).length ? [{ $match: lotMatch }] : []),
      {
        $group: {
          _id: "$status",
          quantity: { $sum: "$quantity" },
          dispatches: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    OfficeDispatch.aggregate([
      ...(Object.keys(lotMatch).length ? [{ $match: lotMatch }] : []),
      {
        $group: {
          _id: "$office",
          quantity: { $sum: "$quantity" },
          dispatches: { $sum: 1 },
        },
      },
      { $sort: { quantity: -1 } },
    ]),
  ]);

  return sendSuccess(res, {
    data: {
      overall: {
        totalQuantity: overall[0]?.totalQuantity || 0,
        totalDispatches: overall[0]?.totalDispatches || 0,
      },
      byStatus: byStatus.map((item) => ({
        status: item._id,
        quantity: item.quantity,
        dispatches: item.dispatches,
      })),
      byOffice: byOffice.map((item) => ({
        office: item._id,
        quantity: item.quantity,
        dispatches: item.dispatches,
      })),
    },
    message: "",
  });
});

const getDashboardAnalytics = asyncHandler(async (req, res) => {
  const ownedLotIds = await getOwnedFabricLotIds(req);
  const lotMatch = isAdminUser(req) ? {} : { lot: { $in: ownedLotIds || [] } };
  const [quality, monthlyProductionRes, shipmentTotalsRes, officeTotalsRes] =
    await Promise.all([
      getProductionAndRejectTotals(lotMatch),
      CuttingConversion.aggregate([
        ...(Object.keys(lotMatch).length ? [{ $match: lotMatch }] : []),
        {
          $group: {
            _id: {
              year: { $year: "$date" },
              month: { $month: "$date" },
            },
            totalOutputPieces: { $sum: "$outputPieces" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      ForeignShipment.aggregate([
        ...(Object.keys(lotMatch).length ? [{ $match: lotMatch }] : []),
        {
          $group: {
            _id: null,
            totalQuantity: { $sum: "$quantity" },
            totalShipments: { $sum: 1 },
          },
        },
      ]),
      OfficeDispatch.aggregate([
        ...(Object.keys(lotMatch).length ? [{ $match: lotMatch }] : []),
        {
          $group: {
            _id: null,
            totalQuantity: { $sum: "$quantity" },
            totalDispatches: { $sum: 1 },
          },
        },
      ]),
    ]);

  return sendSuccess(res, {
    data: {
      productionYield: quality.productionYield,
      rejectRate: quality.rejectRate,
      monthlyProduction: monthlyProductionRes.map((item) => ({
        year: item._id.year,
        month: item._id.month,
        totalOutputPieces: Number(item.totalOutputPieces.toFixed(2)),
      })),
      shipmentTotals: {
        totalQuantity: shipmentTotalsRes[0]?.totalQuantity || 0,
        totalShipments: shipmentTotalsRes[0]?.totalShipments || 0,
      },
      officeDispatchTotals: {
        totalQuantity: officeTotalsRes[0]?.totalQuantity || 0,
        totalDispatches: officeTotalsRes[0]?.totalDispatches || 0,
      },
    },
    message: "",
  });
});

module.exports = {
  getDashboardAnalytics,
  getQualityMetrics,
  getMonthlyProduction,
  getShipmentTotals,
  getOfficeDispatchTotals,
};
