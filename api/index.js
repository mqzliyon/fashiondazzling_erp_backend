const serverless = require("serverless-http");
const { createApp } = require("../src/app");
const { connectDB } = require("../src/config/db");

const app = createApp();
const appHandler = serverless(app);

let dbReadyPromise;

async function ensureDatabaseConnection() {
  if (!dbReadyPromise) {
    dbReadyPromise = connectDB().catch((error) => {
      dbReadyPromise = undefined;
      throw error;
    });
  }
  await dbReadyPromise;
}

module.exports = async (req, res) => {
  const requestPath = String(req.url || "");
  const isHealthRequest =
    requestPath === "/api/health" || requestPath.startsWith("/api/health?");

  // Allow health checks even if DB is temporarily unavailable/misconfigured.
  if (!isHealthRequest) {
    try {
      await ensureDatabaseConnection();
    } catch (error) {
      return res.status(503).json({
        success: false,
        message: "Database connection failed.",
        error: error?.message || "Unknown database error",
      });
    }
  }

  return appHandler(req, res);
};
