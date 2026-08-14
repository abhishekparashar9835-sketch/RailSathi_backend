const express = require("express");

const router = express.Router();

const tteController = require("../controllers/tte.controller");

const authMiddleware = require("../middleware/auth.middleware");

const authorizeRoles = require("../middleware/role.middleware");

/*
 * ============================================================
 * TTE AUTHENTICATION
 * ============================================================
 *
 * Every TTE API requires:
 *
 * 1. Valid JWT
 * 2. TTE or ADMIN role
 *
 */

router.use(authMiddleware);

router.use(
  authorizeRoles("TTE", "ADMIN")
);

/*
 * ============================================================
 * DASHBOARD
 * ============================================================
 */

router.get(
  "/dashboard/:journeyId",
  tteController.getDashboard
);

/*
 * ============================================================
 * JOURNEY SUMMARY
 * ============================================================
 */

router.get(
  "/summary/:journeyId",
  tteController.getJourneySummary
);

/*
 * ============================================================
 * RAC PASSENGERS
 * ============================================================
 *
 * Returns all passengers currently waiting in RAC.
 *
 * Example:
 *
 * GET
 * /api/tte/journey/:journeyId/rac
 *
 */

router.get(
  "/journey/:journeyId/rac",
  tteController.getRACPassengers
);

/*
 * ============================================================
 * TODAY'S JOURNEYS
 * ============================================================
 */

router.get(
  "/journeys/today",
  tteController.getTodayJourneys
);

/*
 * ============================================================
 * START ATTENDANCE
 * ============================================================
 *
 * TTE clicks "Start Attendance".
 *
 */

router.post(
  "/journey/:journeyId/start-attendance",
  tteController.startAttendance
);

/*
 * ============================================================
 * ATTENDANCE STATUS
 * ============================================================
 *
 * Returns:
 *
 * NOT_STARTED
 * ACTIVE
 * READY_FOR_PROCESSING
 * CLOSED
 *
 */

router.get(
  "/journey/:journeyId/attendance-status",
  tteController.getAttendanceStatus
);

/*
 * ============================================================
 * COMPLETE JOURNEY
 * ============================================================
 */

router.patch(
  "/journey/:journeyId/complete",
  tteController.completeJourney
);

/*
 * ============================================================
 * EXPORT
 * ============================================================
 */

module.exports = router;