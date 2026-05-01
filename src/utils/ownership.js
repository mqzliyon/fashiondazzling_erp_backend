const FabricLot = require("../models/FabricLot");
const { ROLES } = require("../config/rbac");

function isAdminUser(req) {
  return String(req.user?.role || "").toLowerCase() === ROLES.ADMIN;
}

async function getOwnedFabricLotIds(req) {
  if (isAdminUser(req)) return null;
  const lots = await FabricLot.find({ createdByUserId: req.user?._id })
    .select("_id")
    .lean();
  return lots.map((item) => item._id);
}

module.exports = {
  isAdminUser,
  getOwnedFabricLotIds,
};

