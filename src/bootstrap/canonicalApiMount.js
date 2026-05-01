const express = require("express");

/**
 * Mobile-friendly canonical paths (in addition to auto-loaded /api/* names).
 * - /api/fabric → fabric lots
 * - /api/lots → piece lots
 * - /api/reject → reject management
 * - /api/shipment/foreign | /office → shipment modules
 * - /api/settings → system settings
 */
function mountCanonicalApiRoutes(app) {
  const fabricLotsRouter = require("../routes/fabric-lots.routes");
  const pieceLotsRouter = require("../routes/piece-lots.routes");
  const rejectRouter = require("../routes/reject-management.routes");
  const foreignShipmentsRouter = require("../routes/foreign-shipments.routes");
  const officeDispatchRouter = require("../routes/office-dispatch.routes");
  const systemSettingsRouter = require("../routes/system-settings.routes");

  app.use("/api/fabric", fabricLotsRouter);
  app.use("/api/lots", pieceLotsRouter);
  app.use("/api/reject", rejectRouter);

  const shipmentRouter = express.Router();
  shipmentRouter.use("/foreign", foreignShipmentsRouter);
  shipmentRouter.use("/office", officeDispatchRouter);
  app.use("/api/shipment", shipmentRouter);

  app.use("/api/settings", systemSettingsRouter);
}

module.exports = { mountCanonicalApiRoutes };
