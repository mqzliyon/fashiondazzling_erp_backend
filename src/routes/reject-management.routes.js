const express = require("express");
const {
  createRejectEntry,
  getRejectEntries,
  getRejectSummary,
  deleteRejectEntry,
} = require("../controllers/rejectManagementController");
const validateRequest = require("../middlewares/validateRequest");
const {
  createRejectEntrySchema,
  getRejectEntriesSchema,
  getRejectSummarySchema,
  deleteRejectEntrySchema,
} = require("../validations/reject-management.validation");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();
router.use(protect);

router.post("/", validateRequest(createRejectEntrySchema), createRejectEntry);
router.get("/", validateRequest(getRejectEntriesSchema), getRejectEntries);
router.get("/summary", validateRequest(getRejectSummarySchema), getRejectSummary);
router.delete("/:entryId", validateRequest(deleteRejectEntrySchema), deleteRejectEntry);

module.exports = router;
