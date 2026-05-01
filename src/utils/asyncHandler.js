// Wrap async route handlers to forward errors to the centralized error handler
// without repeating try/catch blocks in each controller.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;

