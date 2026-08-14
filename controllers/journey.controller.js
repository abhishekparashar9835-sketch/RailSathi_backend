const journeyService = require("../services/journey.service");

// ============================================================
// CREATE JOURNEY
// POST /api/journeys
// ============================================================

const createJourney = async (req, res) => {
  try {
    const journey = await journeyService.createJourney(req.body);

    return res.status(201).json({
      success: true,
      message: "Journey created successfully",
      data: journey,
    });
  } catch (error) {
    console.error("CREATE JOURNEY ERROR:", error);

    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || "Unable to create journey",
    });
  }
};

// ============================================================
// GET ALL JOURNEYS
// GET /api/journeys
// ============================================================

const getAllJourneys = async (req, res) => {
  try {
    const journeys = await journeyService.getAllJourneys();

    return res.status(200).json({
      success: true,
      count: journeys.length,
      data: journeys,
    });
  } catch (error) {
    console.error("GET ALL JOURNEYS ERROR:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to fetch journeys",
    });
  }
};

// ============================================================
// GET JOURNEY BY ID
// GET /api/journeys/:id
// ============================================================

const getJourneyById = async (req, res) => {
  try {
    const journey = await journeyService.getJourneyById(
      req.params.id
    );

    return res.status(200).json({
      success: true,
      data: journey,
    });
  } catch (error) {
    console.error("GET JOURNEY ERROR:", error);

    return res.status(error.statusCode || 404).json({
      success: false,
      message: error.message || "Journey not found",
    });
  }
};

// ============================================================
// UPDATE JOURNEY
// PUT /api/journeys/:id
// ADMIN ONLY
// ============================================================

const updateJourney = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("========================================");
    console.log("UPDATE JOURNEY REQUEST");
    console.log("Journey ID:", id);
    console.log("Payload:", req.body);
    console.log("========================================");

    const journey = await journeyService.updateJourney(
      id,
      req.body
    );

    return res.status(200).json({
      success: true,
      message: "Journey updated successfully",
      data: journey,
    });
  } catch (error) {
    console.error("UPDATE JOURNEY ERROR:", error);

    return res.status(error.statusCode || 400).json({
      success: false,
      message:
        error.message || "Unable to update journey",
    });
  }
};

// ============================================================
// UPDATE JOURNEY STATUS
// PATCH /api/journeys/:id/status
// ADMIN / TTE
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
      "UPDATE JOURNEY STATUS ERROR:",
      error
    );

    return res.status(error.statusCode || 400).json({
      success: false,
      message:
        error.message ||
        "Unable to update journey status",
    });
  }
};

// ============================================================
// RESET ATTENDANCE
// PATCH /api/journeys/:id/reset-attendance
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
      "RESET ATTENDANCE ERROR:",
      error
    );

    return res.status(error.statusCode || 400).json({
      success: false,
      message:
        error.message ||
        "Unable to reset attendance",
    });
  }
};

// ============================================================
// DELETE JOURNEY
// DELETE /api/journeys/:id
// ADMIN ONLY
//
// COMPLETED JOURNEYS CAN BE DELETED
// ============================================================

const deleteJourney = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("========================================");
    console.log("DELETE JOURNEY REQUEST");
    console.log("Journey ID:", id);
    console.log("========================================");

    const deletedJourney =
      await journeyService.deleteJourney(id);

    return res.status(200).json({
      success: true,
      message: "Journey deleted successfully",
      data: deletedJourney,
    });
  } catch (error) {
    console.error(
      "DELETE JOURNEY ERROR:",
      error
    );

    return res.status(error.statusCode || 500).json({
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
  updateJourney,
  updateJourneyStatus,
  resetAttendance,
  deleteJourney,
};