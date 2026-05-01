const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/User");
const { sendSuccess } = require("../utils/apiResponse");
const {
  getPaginationFromQuery,
  buildPaginationMeta,
} = require("../utils/pagination");

const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationFromQuery(req.query);
  const total = await User.countDocuments({});
  const users = await User.find()
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  return sendSuccess(res, {
    data: users.map((item) => item.toJSON()),
    message: "",
    count: total,
    pagination: buildPaginationMeta({ total, page, limit }),
  });
});

const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, permissions, isActive } = req.body;

  if (!name || !email || !password || !role) {
    const error = new Error("Name, email, password and role are required");
    error.statusCode = 400;
    throw error;
  }

  const exists = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (exists) {
    const error = new Error("User with this email already exists");
    error.statusCode = 409;
    throw error;
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
    permissions: Array.isArray(permissions) ? permissions : [],
    isActive: typeof isActive === "boolean" ? isActive : true,
  });

  return sendSuccess(res, {
    status: 201,
    message: "User created successfully",
    data: user.toJSON(),
  });
});

const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, password, role, permissions, isActive } = req.body;

  const user = await User.findById(id);
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  if (typeof name === "string") user.name = name.trim();
  if (typeof email === "string") user.email = email.toLowerCase().trim();
  if (typeof role === "string") user.role = role;
  if (Array.isArray(permissions)) user.permissions = permissions;
  if (typeof isActive === "boolean") user.isActive = isActive;
  if (typeof password === "string" && password.trim().length >= 6) {
    user.password = password.trim();
  }

  await user.save();

  return sendSuccess(res, {
    message: "User updated successfully",
    data: user.toJSON(),
  });
});

const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  await user.deleteOne();

  return sendSuccess(res, {
    data: { id: String(id) },
    message: "User deleted successfully",
  });
});

const toggleUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  user.isActive = !user.isActive;
  await user.save();

  return sendSuccess(res, {
    message: "User status updated",
    data: user.toJSON(),
  });
});

module.exports = {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
};
