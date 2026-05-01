const express = require("express");
const {
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
} = require("../controllers/embroideryController");
const validateRequest = require("../middlewares/validateRequest");
const {
  receiveFromCuttingSchema,
  rejectFromEmbroiderySchema,
  dispatchFromEmbroiderySchema,
  factoryWarehouseTransferSchema,
  embroideryLotIdSchema,
  factoryInventoryIdSchema,
  getEmbroideryHistorySchema,
  getEmbroideryStockSchema,
  getFactoryWarehouseStockSchema,
  getEmbroideryStockSummarySchema,
} = require("../validations/embroidery.validation");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();
router.use(protect);

router.post("/receive", validateRequest(receiveFromCuttingSchema), receiveFromCutting);
router.post("/reject", validateRequest(rejectFromEmbroiderySchema), rejectFromEmbroidery);
router.post("/dispatch", validateRequest(dispatchFromEmbroiderySchema), dispatchFromEmbroidery);
router.post(
  "/factory-warehouse-transfer",
  validateRequest(factoryWarehouseTransferSchema),
  transferToFactoryWarehouse
);
router.delete(
  "/factory-warehouse/:inventoryId",
  validateRequest(factoryInventoryIdSchema),
  returnFactoryWarehouseToEmbroidery
);
router.get(
  "/factory-warehouse/current",
  validateRequest(getFactoryWarehouseStockSchema),
  getFactoryWarehouseStock
);
router.get("/stock/current", validateRequest(getEmbroideryStockSchema), getEmbroideryStock);
router.get(
  "/stock/summary",
  validateRequest(getEmbroideryStockSummarySchema),
  getEmbroideryStockSummary
);
router.get("/stock/:lotId/details", validateRequest(embroideryLotIdSchema), getEmbroideryLotDetails);
router.patch("/stock/:lotId/archive", validateRequest(embroideryLotIdSchema), archiveEmbroideryLot);
router.delete("/stock/:lotId", validateRequest(embroideryLotIdSchema), deleteEmbroideryLot);
router.get("/history", validateRequest(getEmbroideryHistorySchema), getEmbroideryHistory);

module.exports = router;
