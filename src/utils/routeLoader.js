const fs = require("fs");
const path = require("path");

// Automatically discover and register route modules in the routes directory.
// This keeps the main app setup clean, while still allowing modular ERP modules.
function loadRoutes(app) {
  const routesDir = path.join(__dirname, "..", "routes");

  if (!fs.existsSync(routesDir)) {
    return;
  }

  const files = fs.readdirSync(routesDir);

  files
    .filter(
      (file) =>
        // Only auto-load files following the *.routes.js naming convention
        file.endsWith(".routes.js") &&
        file !== "health.routes.js" // health route is mounted explicitly
    )
    .forEach((file) => {
      const routePath = path.join(routesDir, file);

      // Example convention: user.routes.js -> /api/users
      const baseName = file.replace(".routes.js", "");
      const basePath = `/api/${baseName}`;

      // eslint-disable-next-line global-require, import/no-dynamic-require
      const router = require(routePath);
      app.use(basePath, router);
    });
}

module.exports = { loadRoutes };

