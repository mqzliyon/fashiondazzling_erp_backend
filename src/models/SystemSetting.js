const mongoose = require("mongoose");

const systemSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: "default",
    },
    businessName: {
      type: String,
      default: "Fashion Dazzling ERP",
      trim: true,
    },
    businessAddress: {
      type: String,
      default: "",
      trim: true,
    },
    businessNumber: {
      type: String,
      default: "",
      trim: true,
    },
    businessLogoUrl: {
      type: String,
      default: "",
      trim: true,
    },
    registrationEnabled: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const SystemSetting = mongoose.model("SystemSetting", systemSettingSchema);

module.exports = SystemSetting;
