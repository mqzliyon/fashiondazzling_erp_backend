const express = require("express");
const {
  createCuttingConversion,
  getCuttingConversions,
  getCuttingConversionById,
} = require("../controllers/cuttingConversionController");
const validateRequest = require("../middlewares/validateRequest");
const {
  createCuttingConversionSchema,
  conversionIdSchema,
  listCuttingConversionSchema,
} = require("../validations/cutting-conversion.validation");

const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();
router.use(protect);

router.post("/", validateRequest(createCuttingConversionSchema), createCuttingConversion);
router.get("/", validateRequest(listCuttingConversionSchema), getCuttingConversions);
router.get("/:id", validateRequest(conversionIdSchema), getCuttingConversionById);

module.exports = router;
