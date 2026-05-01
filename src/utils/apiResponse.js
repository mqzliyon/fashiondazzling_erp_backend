/**
 * Standard JSON envelope for mobile / React Native clients.
 * Shape: { success, data, message, count?, pagination? }
 */

function sendSuccess(res, options = {}) {
  const {
    status = 200,
    data = {},
    message = "",
    count,
    pagination,
  } = options;

  const payload = {
    success: true,
    data,
    message: message || "",
  };

  if (count !== undefined && count !== null) {
    payload.count = count;
  }
  if (pagination) {
    payload.pagination = pagination;
  }

  return res.status(status).json(payload);
}

module.exports = { sendSuccess };
