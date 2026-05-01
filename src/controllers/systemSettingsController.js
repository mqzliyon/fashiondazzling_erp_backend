const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/apiResponse");
const SystemSetting = require("../models/SystemSetting");

async function getOrCreateDefaultSettings() {
  let settings = await SystemSetting.findOne({ key: "default" });
  if (!settings) {
    settings = await SystemSetting.create({ key: "default" });
  }
  return settings;
}

function parseRegistrationEnabled(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  }
  return fallback;
}

const getSystemSettings = asyncHandler(async (req, res) => {
  const settings = await getOrCreateDefaultSettings();
  return sendSuccess(res, { data: settings, message: "" });
});

const upsertSystemSettings = asyncHandler(async (req, res) => {
  const { businessName, businessNumber, businessAddress, businessLogoUrl, registrationEnabled } = req.body;
  const settings = await getOrCreateDefaultSettings();

  if (typeof businessName === "string") {
    settings.businessName = businessName.trim();
  }
  if (typeof businessAddress === "string") {
    settings.businessAddress = businessAddress.trim();
  }
  if (typeof businessNumber === "string") {
    settings.businessNumber = businessNumber.trim();
  }
  if (typeof businessLogoUrl === "string") {
    settings.businessLogoUrl = businessLogoUrl.trim();
  }
  if (registrationEnabled !== undefined) {
    settings.registrationEnabled = parseRegistrationEnabled(
      registrationEnabled,
      settings.registrationEnabled
    );
  }

  await settings.save();

  return sendSuccess(res, {
    message: "System settings updated successfully",
    data: settings,
  });
});

const updateRegistrationMode = asyncHandler(async (req, res) => {
  const { registrationEnabled } = req.body;
  const settings = await getOrCreateDefaultSettings();
  if (registrationEnabled === undefined) {
    const error = new Error("registrationEnabled is required");
    error.statusCode = 400;
    throw error;
  }
  settings.registrationEnabled = parseRegistrationEnabled(
    registrationEnabled,
    settings.registrationEnabled
  );
  await settings.save();

  return sendSuccess(res, {
    message: "Registration mode updated",
    data: settings,
  });
});

module.exports = {
  getSystemSettings,
  upsertSystemSettings,
  updateRegistrationMode,
};
