const express = require("express");
const {
  rejectFromCutting,
  getRejectInventory,
  getCuttingRejectHistory,
} = require("../controllers/cuttingRejectController");
const validateRequest = require("../middlewares/validateRequest");
const {
  rejectFromCuttingSchema,
  listCuttingRejectHistorySchema,
  getRejectInventorySchema,
} = require("../validations/cutting-reject.validation");

const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();
router.use(protect);

router.post("/", validateRequest(rejectFromCuttingSchema), rejectFromCutting);
router.get("/inventory", validateRequest(getRejectInventorySchema), getRejectInventory);
router.get("/history", validateRequest(listCuttingRejectHistorySchema), getCuttingRejectHistory);

module.exports = router;
