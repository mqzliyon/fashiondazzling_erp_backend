const express = require("express");
const {
  downloadFabricStockReport,
  downloadLotHistoryReport,
  downloadCuttingReport,
  downloadRejectReport,
  downloadShipmentReport,
} = require("../controllers/pdfReportsController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();
router.use(protect);

router.get("/fabric-stock", downloadFabricStockReport);
router.get("/lot-history", downloadLotHistoryReport);
router.get("/cutting", downloadCuttingReport);
router.get("/reject", downloadRejectReport);
router.get("/shipment", downloadShipmentReport);

module.exports = router;
