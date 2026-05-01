const express = require("express");
const {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
} = require("../controllers/usersController");
const validateRequest = require("../middlewares/validateRequest");
const { listUsersSchema } = require("../validations/users.validation");
const { protect, adminOnly } = require("../middlewares/authMiddleware");

const router = express.Router();

router.use(protect, adminOnly);
router.get("/", validateRequest(listUsersSchema), listUsers);
router.post("/", createUser);
router.put("/:id", updateUser);
router.patch("/:id/toggle-status", toggleUserStatus);
router.delete("/:id", deleteUser);

module.exports = router;
