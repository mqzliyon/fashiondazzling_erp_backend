const express = require("express");
const {
  createConversionRatio,
  getConversionRatios,
  getConversionRatioById,
  updateConversionRatio,
  convertKgToPieces,
} = require("../controllers/convertToPiecesController");
const validateRequest = require("../middlewares/validateRequest");
const {
  createConversionRatioSchema,
  getConversionRatioByIdSchema,
  listConversionRatioSchema,
  updateConversionRatioSchema,
  convertToPiecesSchema,
} = require("../validations/convertToPieces.validation");

const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();
router.use(protect);

router.post("/ratios", validateRequest(createConversionRatioSchema), createConversionRatio);
router.get("/ratios", validateRequest(listConversionRatioSchema), getConversionRatios);
router.get("/ratios/:id", validateRequest(getConversionRatioByIdSchema), getConversionRatioById);
router.put("/ratios/:id", validateRequest(updateConversionRatioSchema), updateConversionRatio);
router.post("/convert", validateRequest(convertToPiecesSchema), convertKgToPieces);

module.exports = router;
