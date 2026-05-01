const express = require("express");
const validateRequest = require("../middlewares/validateRequest");
const {
  createPieceLot,
  getPieceLots,
  getPieceLotById,
  updatePieceLot,
  deletePieceLot,
  sendPieceLotToEmbroidery,
} = require("../controllers/pieceLotsController");
const {
  getPieceLotsSchema,
  createPieceLotSchema,
  updatePieceLotSchema,
  pieceLotIdSchema,
  sendToEmbroiderySchema,
} = require("../validations/piece-lots.validation");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();
router.use(protect);

router.get("/", validateRequest(getPieceLotsSchema), getPieceLots);
router.post("/", validateRequest(createPieceLotSchema), createPieceLot);
router.get("/:id", validateRequest(pieceLotIdSchema), getPieceLotById);
router.put("/:id", validateRequest(updatePieceLotSchema), updatePieceLot);
router.delete("/:id", validateRequest(pieceLotIdSchema), deletePieceLot);
router.post(
  "/:id/send-to-embroidery",
  validateRequest(sendToEmbroiderySchema),
  sendPieceLotToEmbroidery
);

module.exports = router;

