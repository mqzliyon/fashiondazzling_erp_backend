const express = require("express");
const {
  receiveTransferredFabric,
  getCurrentCuttingStock,
  getCuttingStockSummary,
  getCuttingBatchHistory,
  getCompletedCuttingSummary,
  getCuttingBatchById,
  completeCuttingBatch,
  deleteCuttingBatch,
  deleteCompletedCuttingByFabricType,
  sendCompletedCuttingToLot,
} = require("../controllers/cuttingController");
const validateRequest = require("../middlewares/validateRequest");
const {
  receiveTransferredFabricSchema,
  getCuttingBatchHistorySchema,
  getCurrentCuttingStockSchema,
  getCuttingStockSummarySchema,
  getCompletedCuttingSummarySchema,
  cuttingBatchIdSchema,
  completeCuttingBatchSchema,
  sendCompletedToLotSchema,
} = require("../validations/cutting.validation");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();
router.use(protect);

router.post(
  "/receive-transfer",
  validateRequest(receiveTransferredFabricSchema),
  receiveTransferredFabric
);
router.get(
  "/stock/current",
  validateRequest(getCurrentCuttingStockSchema),
  getCurrentCuttingStock
);
router.get(
  "/stock/summary",
  validateRequest(getCuttingStockSummarySchema),
  getCuttingStockSummary
);
router.get(
  "/batches/history",
  validateRequest(getCuttingBatchHistorySchema),
  getCuttingBatchHistory
);
router.get(
  "/completed/summary",
  validateRequest(getCompletedCuttingSummarySchema),
  getCompletedCuttingSummary
);
router.delete("/completed/by-fabric-type/:fabricType", deleteCompletedCuttingByFabricType);
router.post(
  "/completed/:fabricType/send-to-lot",
  validateRequest(sendCompletedToLotSchema),
  sendCompletedCuttingToLot
);
router.get("/batches/:id", validateRequest(cuttingBatchIdSchema), getCuttingBatchById);
router.post(
  "/batches/:id/complete-cutting",
  validateRequest(completeCuttingBatchSchema),
  completeCuttingBatch
);
router.delete("/batches/:id", validateRequest(cuttingBatchIdSchema), deleteCuttingBatch);

module.exports = router;
