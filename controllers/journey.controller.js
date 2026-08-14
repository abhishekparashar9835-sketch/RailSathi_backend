const journeyService = require("../services/journey.service");

// ============================================================
// CREATE JOURNEY
// ============================================================

const createJourney = async (req, res) => {
  try {
    const journey =
      await journeyService.createJourney(req.body);

    return res.status(201).json({
      success: true,
      message: "Journey created successfully",
      data: journey,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// GET ALL JOURNEYS
// ============================================================

const getAllJourneys = async (req, res) => {
  try {
    const journeys =
      await journeyService.getAllJourneys();

    return res.status(200).json({
      success: true,
      count: journeys.length,
      data: journeys,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// GET JOURNEY BY ID
// ============================================================

const getJourneyById = async (req, res) => {
  try {
    const journey =
      await journeyService.getJourneyById(
        req.params.id
      );

    return res.status(200).json({
      success: true,
      data: journey,
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// RESET ATTENDANCE
// ============================================================

const resetAttendance = async (req, res) => {
  try {
    const journey =
      await journeyService.resetAttendance(
        req.params.id
      );

    return res.status(200).json({
      success: true,
      message: "Attendance reset successfully",
      data: journey,
    });
  } catch (error) {
    console.error(
      "Reset Attendance Error:",
      error
    );

    return res.status(
      error.statusCode || 400
    ).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// UPDATE JOURNEY STATUS
// ============================================================

const updateJourneyStatus = async (req, res) => {
  try {
    const journey =
      await journeyService.updateJourneyStatus(
        req.params.id
      );

    return res.status(200).json({
      success: true,
      message: "Journey status updated successfully",
      data: journey,
    });
  } catch (error) {
    console.error(
      "Update Journey Status Error:",
      error
    );

    return res.status(
      error.statusCode || 400
    ).json({
      success: false,
      message: error.message,
    });
  }
};


const deleteJourney = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedJourney =
      await journeyService.deleteJourney(id);

    return res.status(200).json({
      success: true,
      message: "Journey deleted successfully",
      data: deletedJourney,
    });
  } catch (error) {
    console.error("DELETE JOURNEY ERROR:", error);

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.message ||
        "Unable to delete journey",
    });
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createJourney,
  getAllJourneys,
  getJourneyById,
  resetAttendance,
  updateJourneyStatus,
  deleteJourney,
};