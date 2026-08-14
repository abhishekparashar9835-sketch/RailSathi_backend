const attendanceService = require("../services/attendance.service");

const verifyAttendance = async (req, res) => {
  try {
    const {
      journeyId,
      qrToken,
      identityLast4,
    } = req.body;

    const result =
      await attendanceService.verifyAttendance({
        journeyId,
        qrToken,
        identityLast4,
      });

    res.status(200).json({
      success: true,
      message: "Attendance marked successfully",
      data: result,
    });
  } catch (error) {
    console.error(
      "Attendance verification error:",
      error
    );

    res.status(error.statusCode || 400).json({
      success: false,
      message:
        error.message ||
        "Attendance verification failed",
    });
  }
};

module.exports = {
  verifyAttendance,
};