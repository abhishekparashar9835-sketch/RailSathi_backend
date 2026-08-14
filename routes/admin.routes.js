const express = require("express");

const router =
  express.Router();

const adminController =
  require("../controllers/admin.controller");

const authMiddleware =
  require("../middleware/auth.middleware");

const adminMiddleware =
  require("../middleware/admin.middleware");

/*
 * ============================================================
 * ADMIN PROTECTION
 * ============================================================
 *
 * Every route below requires:
 *
 * 1. Valid JWT
 * 2. ADMIN role
 *
 */

router.use(
  authMiddleware,
  adminMiddleware
);

/*
 * ============================================================
 * DASHBOARD
 * ============================================================
 */

router.get(
  "/dashboard",
  adminController.getDashboard
);

/*
 * ============================================================
 * USERS
 * ============================================================
 */

router.get(
  "/users",
  adminController.getUsers
);

/*
 * ============================================================
 * TRAINS
 * ============================================================
 */

router.get(
  "/trains",
  adminController.getTrains
);

/*
 * ============================================================
 * JOURNEYS
 * ============================================================
 */

router.get(
  "/journeys",
  adminController.getJourneys
);

/*
 * ============================================================
 * BOOKINGS
 * ============================================================
 */

router.get(
  "/bookings",
  adminController.getBookings
);

module.exports = router;