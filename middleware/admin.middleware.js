/*
 * ============================================================
 * ADMIN AUTHORIZATION MIDDLEWARE
 * ============================================================
 *
 * Authentication middleware should run BEFORE this middleware.
 *
 * Expected:
 * req.user = {
 *   id: "...",
 *   role: "ADMIN"
 * }
 *
 */

const adminMiddleware = (req, res, next) => {
  try {
    // User must already be authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Only ADMIN can access admin routes
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    next();
  } catch (error) {
    console.error(
      "ADMIN MIDDLEWARE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Authorization failed",
    });
  }
};

module.exports = adminMiddleware;