const express = require("express");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

// Simple health check endpoint to validate API availability
router.get(
  "/",
  asyncHandler(async (req, res) => {
    return res.status(200).json({
      success: true,
      data: { status: "ok" },
      message: "API Running",
    });
  })
);

module.exports = router;

