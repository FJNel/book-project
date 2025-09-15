const jwt = require("jsonwebtoken");

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || "default-access-secret";
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || "default-refresh-secret";
const ACCESS_TOKEN_EXPIRES_IN = "15m"; // Short-lived
const REFRESH_TOKEN_EXPIRES_IN = "7d"; // Long-lived

function generateAccessToken(user) {
  // Only include safe fields
  return jwt.sign(
    {
      id: user.id,
    //   email: user.email,
      role: user.role
    //   isVerified: user.is_verified,
    //   preferredName: user.preferred_name,
    //   fullName: user.full_name
    },
    ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
  );
}

function generateRefreshToken(user, fingerprint) {
  // Only include user id and fingerprint
  return jwt.sign(
    {
      id: user.id,
      fingerprint
    },
    REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_TOKEN_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_TOKEN_SECRET);
}

function requiresAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      status: "error",
      httpCode: 401,
      message: "AUTHENTICATION_REQUIRED",
      data: {},
      errors: ["AUTHENTICATION_REQUIRED_DETAILS"]
    });
  }
  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
    req.user = payload; // Attach user info to request
    next();
  } catch (err) {
    return res.status(401).json({
      status: "error",
      httpCode: 401,
      message: "ACCESS_TOKEN_ERROR",
      data: {},
      errors: ["ACCESS_TOKEN_FAILED"]
    });
  }
}

function requireRole(roles) {
  return function (req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        status: "error",
        httpCode: 403,
        message: "FORBIDDEN_NO_PERMISSIONS",
        data: {},
        errors: ["FORBIDDEN_NO_PERMISSIONS_DETAIL_1"]
      });
    }
    next();
  };
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  requiresAuth,
  requireRole
};
