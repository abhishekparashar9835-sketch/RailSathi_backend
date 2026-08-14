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
// POST /api/journeys
// ============================================================

router.post(
  "/",
  authMiddleware,
  authorizeRoles("ADMIN"),
  journeyController.createJourney
);

// ============================================================
// GET ALL JOURNEYS
// GET /api/journeys
// ============================================================

router.get(
  "/",
  journeyController.getAllJourneys
);

// ============================================================
// GET JOURNEY BY ID
// GET /api/journeys/:id
// ============================================================

router.get(
  "/:id",
  journeyController.getJourneyById
);

// ============================================================
// UPDATE JOURNEY
// PUT /api/journeys/:id
// ============================================================

router.put(
  "/:id",
  authMiddleware,
  authorizeRoles("ADMIN"),
  journeyController.updateJourney
);

// ============================================================
// DELETE JOURNEY
// DELETE /api/journeys/:id
// ADMIN CAN DELETE COMPLETED JOURNEYS
// ============================================================

router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles("ADMIN"),
  journeyController.deleteJourney
);

// ============================================================
// UPDATE JOURNEY STATUS
// PATCH /api/journeys/:id/status
// ============================================================

router.patch(
  "/:id/status",
  authMiddleware,
  authorizeRoles("ADMIN", "TTE"),
  journeyController.updateJourneyStatus
);

// ============================================================
// RESET ATTENDANCE
// PATCH /api/journeys/:id/reset-attendance
// ============================================================

router.patch(
  "/:id/reset-attendance",
  authMiddleware,
  authorizeRoles("ADMIN"),
  journeyController.resetAttendance
);

module.exports = router;