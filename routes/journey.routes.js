const express = require("express");

const router = express.Router();

const journeyController =
  require("../controllers/journey.controller");

const authMiddleware =
  require("../middleware/auth.middleware");

const authorizeRoles =
  require("../middleware/role.middleware");


// ============================================================
// CREATE JOURNEY
// ============================================================

router.post(
  "/",
  authMiddleware,
  authorizeRoles("ADMIN"),
  journeyController.createJourney
);


// ============================================================
// GET ALL JOURNEYS
// ============================================================

router.get(
  "/",
  journeyController.getAllJourneys
);


// ============================================================
// GET JOURNEY BY ID
// ============================================================

router.get(
  "/:id",
  journeyController.getJourneyById
);


// ============================================================
// DELETE JOURNEY
// ============================================================

router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles("ADMIN"),
  journeyController.deleteJourney
);


// ============================================================
// UPDATE JOURNEY STATUS
// ============================================================

router.patch(
  "/:id/status",
  authMiddleware,
  authorizeRoles("ADMIN", "TTE"),
  journeyController.updateJourneyStatus
);


// ============================================================
// RESET ATTENDANCE
// ============================================================

router.patch(
  "/:id/reset-attendance",
  journeyController.resetAttendance
);


module.exports = router;