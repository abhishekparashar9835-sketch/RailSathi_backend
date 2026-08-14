const express = require("express");

const router = express.Router();

const attendanceController = require(
  "../controllers/attendance.controller"
);

const authMiddleware = require(
  "../middleware/auth.middleware"
);

router.post(
  "/verify",
  authMiddleware,
  attendanceController.verifyAttendance
);

module.exports = router;