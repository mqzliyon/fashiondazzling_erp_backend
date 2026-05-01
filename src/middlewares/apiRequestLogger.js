/**
 * Logs every API request (method, path, query) for debugging mobile clients.
 */
function apiRequestLogger(req, res, next) {
  if (req.path === "/favicon.ico") {
    return next();
  }
  const q =
    req.query && Object.keys(req.query).length
      ? ` ?${new URLSearchParams(req.query).toString()}`
      : "";
  // eslint-disable-next-line no-console
  console.log(`[API] ${req.method} ${req.originalUrl || req.url}${q}`);
  next();
}

module.exports = apiRequestLogger;
