const mongoose = require("mongoose");

// Centralized 404 handler for unknown routes
function notFoundHandler(req, res, next) {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function resolveStatusAndMessage(err) {
  if (err instanceof mongoose.Error.CastError || err.name === "CastError") {
    return { statusCode: 400, message: "Invalid id format" };
  }
  if (err instanceof SyntaxError && "body" in err) {
    return { statusCode: 400, message: "Invalid JSON body" };
  }
  const statusCode = err.statusCode || err.status || 500;
  const message =
    statusCode === 500
      ? "Internal Server Error"
      : err.message || "Something went wrong";
  return { statusCode, message };
}

// Centralized error handler — JSON only, no HTML, no stack traces to clients
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const { statusCode, message } = resolveStatusAndMessage(err);
  if (statusCode >= 500 && process.env.NODE_ENV !== "test") {
    // eslint-disable-next-line no-console
    console.error("[API Error]", err);
  }

  const response = {
    success: false,
    data: {},
    message,
  };

  if (err.flatten && typeof err.flatten === "object") {
    response.errors = err.flatten;
  } else if (Array.isArray(err.errors) && err.errors.length) {
    response.errors = err.errors;
  }

  res.status(statusCode).json(response);
}

module.exports = {
  notFoundHandler,
  errorHandler,
};

