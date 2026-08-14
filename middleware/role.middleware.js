const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // 1. Flatten nested arrays (handles authorizeRoles("TTE") AND authorizeRoles(["TTE"]))
    // 2. Normalize to uppercase for safe comparison
    const normalizedAllowed = allowedRoles.flat().map((r) => String(r).toUpperCase());
    const normalizedUserRole = req.user.role ? String(req.user.role).toUpperCase() : "";

    if (!normalizedAllowed.includes(normalizedUserRole)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions",
      });
    }

    next();
  };
};

module.exports = authorizeRoles;