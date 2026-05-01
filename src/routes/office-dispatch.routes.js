const express = require("express");
const {
  createOfficeDispatch,
  getOfficeDispatches,
  getOfficeDispatchById,
  updateOfficeDispatchStatus,
  deleteOfficeDispatch,
} = require("../controllers/officeDispatchController");
const validateRequest = require("../middlewares/validateRequest");
const {
  createOfficeDispatchSchema,
  getOfficeDispatchesSchema,
  getOfficeDispatchByIdSchema,
  updateOfficeDispatchStatusSchema,
  deleteOfficeDispatchSchema,
} = require("../validations/office-dispatch.validation");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();
router.use(protect);

router.post("/", validateRequest(createOfficeDispatchSchema), createOfficeDispatch);
router.get("/", validateRequest(getOfficeDispatchesSchema), getOfficeDispatches);
router.get("/:id", validateRequest(getOfficeDispatchByIdSchema), getOfficeDispatchById);
router.patch(
  "/:id/status",
  validateRequest(updateOfficeDispatchStatusSchema),
  updateOfficeDispatchStatus
);
router.delete("/:id", validateRequest(deleteOfficeDispatchSchema), deleteOfficeDispatch);

module.exports = router;
