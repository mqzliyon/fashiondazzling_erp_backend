const jwt = require("jsonwebtoken");

// Generate a signed JWT token for a user session
function generateToken(payload, options = {}) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured in environment variables");
  }

  const defaultOptions = {
    expiresIn: "7d",
  };

  return jwt.sign(payload, secret, { ...defaultOptions, ...options });
}

// Verify and decode a JWT token
function verifyToken(token) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured in environment variables");
  }

  return jwt.verify(token, secret);
}

module.exports = {
  generateToken,
  verifyToken,
};

