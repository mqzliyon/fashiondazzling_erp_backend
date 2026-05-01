const express = require("express");
const {
  getDashboardAnalytics,
  getQualityMetrics,
  getMonthlyProduction,
  getShipmentTotals,
  getOfficeDispatchTotals,
} = require("../controllers/analyticsController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();
router.use(protect);

router.get("/dashboard", getDashboardAnalytics);
router.get("/quality-metrics", getQualityMetrics);
router.get("/monthly-production", getMonthlyProduction);
router.get("/shipment-totals", getShipmentTotals);
router.get("/office-dispatch-totals", getOfficeDispatchTotals);

module.exports = router;
