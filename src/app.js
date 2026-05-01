const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const { notFoundHandler, errorHandler } = require("./middlewares/error.middleware");
const apiRequestLogger = require("./middlewares/apiRequestLogger");
const healthRouter = require("./routes/health.routes");
const { loadRoutes } = require("./utils/routeLoader");
const { mountCanonicalApiRoutes } = require("./bootstrap/canonicalApiMount");

// Create and configure Express application instance
function createApp() {
  const app = express();

  // API-only: CSP is not needed; avoids interfering with some mobile WebViews
  app.use(helmet({ contentSecurityPolicy: false }));
  // React Native / Expo: allow any origin (no browser cookie reliance for mobile)
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(compression());
  app.use(cookieParser());

  // HTTP request logging - more verbose in development
  if (process.env.NODE_ENV !== "test") {
    app.use(
      morgan(process.env.NODE_ENV === "production" ? "combined" : "dev")
    );
    app.use(apiRequestLogger);
  }

  // JSON body parsing (invalid JSON → error middleware, never HTML)
  app.use(express.json({ limit: "10mb" }));

  // Mount base routes
  app.use("/api/health", healthRouter);
  app.use("/api/auth", require("./routes/authRoutes"));

  // Canonical aliases for mobile apps (/api/fabric, /api/lots, …)
  mountCanonicalApiRoutes(app);

  // Automatically load additional modular routes (e.g. ERP modules)
  loadRoutes(app);

  // Not Found handler for unmatched routes
  app.use(notFoundHandler);

  // Centralized error handler
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };

