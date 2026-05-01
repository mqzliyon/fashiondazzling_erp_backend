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
  await ensureDatabaseConnection();
  return appHandler(req, res);
};
