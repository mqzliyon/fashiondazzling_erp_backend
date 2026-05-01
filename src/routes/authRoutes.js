const express = require("express");
const {
  registerUser,
  getRegistrationStatus,
  loginUser,
  logoutUser,
  getCurrentUser,
  updateMyProfile,
} = require("../controllers/authController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

// Public auth routes
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/registration-status", getRegistrationStatus);

// Authenticated user routes
router.post("/logout", protect, logoutUser);
router.get("/me", protect, getCurrentUser);
router.patch("/profile", protect, updateMyProfile);

module.exports = router;

