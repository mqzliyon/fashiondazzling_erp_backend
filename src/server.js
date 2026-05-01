require("dotenv").config();

const http = require("http");
const mongoose = require("mongoose");
const { createApp } = require("./app");
const { connectDB, disconnectDB } = require("./config/db");
const { ensureDemoAdmin } = require("./seeds/ensureDemoAdmin");

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";

// Keep a reference to the server instance for graceful shutdown
let server;

// Log startup configuration once at boot
function logStartupBanner() {
  // Use a minimal but clear startup banner for production
  // without leaking sensitive configuration values.
  const bannerLines = [
    "=======================================",
    ` ERP Backend`,
    "=======================================",
    ` Environment : ${NODE_ENV}`,
    ` Port        : ${PORT}`,
    ` Mongo URI   : ${process.env.MONGO_URI ? "Configured" : "Missing"}`,
    "=======================================",
  ];

  // eslint-disable-next-line no-console
  console.log(bannerLines.join("\n"));
}

async function startServer() {
  try {
    logStartupBanner();

    // Initialize database connection with retry logic
    await connectDB();
    await ensureDemoAdmin();

    const app = createApp();

    server = http.createServer(app);

    server.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(
        `[Server] Listening on port ${PORT} in ${NODE_ENV} mode`
      );
    });

    // Handle unexpected errors centrally
    process.on("unhandledRejection", (reason) => {
      // eslint-disable-next-line no-console
      console.error("[Process] Unhandled Rejection:", reason);
    });

    process.on("uncaughtException", (error) => {
      // eslint-disable-next-line no-console
      console.error("[Process] Uncaught Exception:", error);
    });

    // Graceful shutdown on process termination signals
    const shutdownSignals = ["SIGINT", "SIGTERM", "SIGQUIT"];
    shutdownSignals.forEach((signal) => {
      process.on(signal, async () => {
        // eslint-disable-next-line no-console
        console.log(`[Process] Received ${signal}, shutting down gracefully...`);

        try {
          if (server) {
            await new Promise((resolve, reject) => {
              server.close((err) => {
                if (err) {
                  return reject(err);
                }
                return resolve();
              });
            });
          }

          await disconnectDB();

          // eslint-disable-next-line no-console
          console.log("[Process] Shutdown complete. Exiting.");
          process.exit(0);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[Process] Error during shutdown:", err);
          process.exit(1);
        }
      });
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[Startup] Failed to start server:", err);
    mongoose.connection.readyState && disconnectDB().finally(() => {
      process.exit(1);
    });
  }
}

// Execute startup
startServer();

