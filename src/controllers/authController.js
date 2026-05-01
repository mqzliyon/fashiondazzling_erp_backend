const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/User");
const SystemSetting = require("../models/SystemSetting");
const { ROLES } = require("../config/rbac");
const { generateToken } = require("../utils/jwt");
const { sendSuccess } = require("../utils/apiResponse");

// Helper to send auth response consistently (mobile: use data.token with Bearer header)
function sendAuthResponse(res, user, statusCode = 200) {
  const tokenPayload = {
    sub: user._id.toString(),
    role: user.role,
    organizationId: user.organizationId,
    permissions: user.permissions || [],
  };

  const token = generateToken(tokenPayload);

  // In production, consider setting secure: true and sameSite configuration
  const isProduction = process.env.NODE_ENV === "production";

  res.status(statusCode).cookie("token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return sendSuccess(res, {
    status: statusCode,
    data: { token, user },
    message: statusCode === 201 ? "Registration successful" : "Login successful",
  });
}

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const {
    firstName,
    lastName,
    businessName,
    businessNumber,
    businessAddress,
    businessLogoUrl,
    email,
    password,
    organizationId,
  } = req.body;

  const settings = await SystemSetting.findOne({ key: "default" });
  const registrationDisabled =
    settings &&
    (settings.registrationEnabled === false ||
      String(settings.registrationEnabled).trim().toLowerCase() === "false" ||
      Number(settings.registrationEnabled) === 0);
  if (registrationDisabled) {
    const error = new Error("Public registration is currently disabled");
    error.statusCode = 403;
    throw error;
  }

  if (!firstName || !lastName || !email || !password || !businessName || !businessNumber || !businessAddress) {
    const error = new Error(
      "First name, last name, business name, business number, business address, email and password are required"
    );
    error.statusCode = 400;
    throw error;
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const error = new Error("User with this email already exists");
    error.statusCode = 409;
    throw error;
  }

  const name = `${String(firstName).trim()} ${String(lastName).trim()}`.trim();
  const user = await User.create({
    name,
    email,
    password,
    role: ROLES.ADMIN,
    organizationId,
  });

  await SystemSetting.findOneAndUpdate(
    { key: "default" },
    {
      key: "default",
      businessName: String(businessName || "").trim(),
      businessNumber: String(businessNumber || "").trim(),
      businessAddress: String(businessAddress || "").trim(),
      ...(businessLogoUrl ? { businessLogoUrl: String(businessLogoUrl).trim() } : {}),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return sendAuthResponse(res, user.toJSON(), 201);
});

// @route   GET /api/auth/registration-status
// @desc    Check whether public registration is enabled
// @access  Public
const getRegistrationStatus = asyncHandler(async (_req, res) => {
  const settings = await SystemSetting.findOne({ key: "default" });
  const registrationEnabled = !(
    settings &&
    (settings.registrationEnabled === false ||
      String(settings.registrationEnabled).trim().toLowerCase() === "false" ||
      Number(settings.registrationEnabled) === 0)
  );

  return sendSuccess(res, {
    data: { registrationEnabled },
    message: "",
  });
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    const error = new Error("Email and password are required");
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({ email });

  if (!user) {
    const error = new Error("Invalid credentials");
    error.statusCode = 401;
    throw error;
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    const error = new Error("Invalid credentials");
    error.statusCode = 401;
    throw error;
  }

  if (user.isActive === false) {
    const error = new Error("This user is currently disabled. Contact admin.");
    error.statusCode = 403;
    throw error;
  }

  return sendAuthResponse(res, user.toJSON(), 200);
});

// @route   POST /api/auth/logout
// @desc    Logout user (clear auth cookie)
// @access  Private (optional)
const logoutUser = asyncHandler(async (req, res) => {
  res.clearCookie("token");
  return sendSuccess(res, {
    data: {},
    message: "Logged out successfully",
  });
});

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
const getCurrentUser = asyncHandler(async (req, res) => {
  // `req.user` is set by authentication middleware
  return sendSuccess(res, {
    data: { user: req.user },
    message: "",
  });
});

// @route   PATCH /api/auth/profile
// @desc    Update current user's name/password
// @access  Private
const updateMyProfile = asyncHandler(async (req, res) => {
  const { name, password } = req.body;
  const user = await User.findById(req.user._id);

  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  if (typeof name === "string" && name.trim()) {
    user.name = name.trim();
  }
  if (typeof password === "string" && password.trim()) {
    if (password.trim().length < 6) {
      const error = new Error("Password must be at least 6 characters");
      error.statusCode = 400;
      throw error;
    }
    user.password = password.trim();
  }

  await user.save();

  return sendSuccess(res, {
    message: "Profile updated successfully",
    data: { user: user.toJSON() },
  });
});

module.exports = {
  registerUser,
  getRegistrationStatus,
  loginUser,
  logoutUser,
  getCurrentUser,
  updateMyProfile,
};

