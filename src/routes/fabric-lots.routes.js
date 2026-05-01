const express = require("express");
const {
  createFabricLot,
  getFabricLots,
  getFabricLotById,
  updateFabricLot,
  deleteFabricLot,
  transferToCutting,
} = require("../controllers/fabricLotController");
const validateRequest = require("../middlewares/validateRequest");
const {
  listFabricLotsSchema,
  createFabricLotSchema,
  updateFabricLotSchema,
  fabricLotIdSchema,
  transferToCuttingSchema,
} = require("../validations/fabricLot.validation");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/", protect, validateRequest(createFabricLotSchema), createFabricLot);
router.get("/", protect, validateRequest(listFabricLotsSchema), getFabricLots);
router.get("/:id", protect, validateRequest(fabricLotIdSchema), getFabricLotById);
router.put("/:id", protect, validateRequest(updateFabricLotSchema), updateFabricLot);
router.delete("/:id", protect, validateRequest(fabricLotIdSchema), deleteFabricLot);
router.post(
  "/:id/transfer-to-cutting",
  protect,
  validateRequest(transferToCuttingSchema),
  transferToCutting
);

module.exports = router;
