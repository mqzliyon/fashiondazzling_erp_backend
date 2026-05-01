const express = require("express");
const {
  createForeignShipment,
  getForeignShipments,
  getForeignShipmentById,
  updateForeignShipmentStatus,
  deleteForeignShipment,
} = require("../controllers/foreignShipmentController");
const validateRequest = require("../middlewares/validateRequest");
const {
  listForeignShipmentsSchema,
  foreignShipmentIdSchema,
  updateForeignShipmentStatusSchema,
} = require("../validations/foreign-shipment.validation");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();
router.use(protect);

router.post("/", createForeignShipment);
router.get("/", validateRequest(listForeignShipmentsSchema), getForeignShipments);
router.get("/:id", validateRequest(foreignShipmentIdSchema), getForeignShipmentById);
router.patch(
  "/:id/status",
  validateRequest(updateForeignShipmentStatusSchema),
  updateForeignShipmentStatus
);
router.delete("/:id", validateRequest(foreignShipmentIdSchema), deleteForeignShipment);

module.exports = router;
