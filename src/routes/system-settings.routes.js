const express = require("express");
const {
  getSystemSettings,
  upsertSystemSettings,
  updateRegistrationMode,
} = require("../controllers/systemSettingsController");
const { protect, adminOnly } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/", protect, getSystemSettings);
router.put("/", protect, adminOnly, upsertSystemSettings);
router.patch("/registration", protect, adminOnly, updateRegistrationMode);

module.exports = router;
