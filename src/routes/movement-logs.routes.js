const express = require("express");
const {
  createMovementLog,
  getMovementLogs,
  getMovementLogById,
} = require("../controllers/movementLogController");
const validateRequest = require("../middlewares/validateRequest");
const {
  createMovementLogSchema,
  movementLogIdSchema,
  getMovementLogsSchema,
} = require("../validations/movementLog.validation");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();
router.use(protect);

router.post("/", validateRequest(createMovementLogSchema), createMovementLog);
router.get("/", validateRequest(getMovementLogsSchema), getMovementLogs);
router.get("/:id", validateRequest(movementLogIdSchema), getMovementLogById);

module.exports = router;
