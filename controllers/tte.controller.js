const tteService = require("../services/tte.service");
const journeyService = require("../services/journey.service");

/*
 * ============================================================
 * GET TTE DASHBOARD
 * ============================================================
 */

const getDashboard = async (req, res) => {
  try {
    const { journeyId } = req.params;

    const data = await tteService.getDashboard(journeyId);

    return res.status(200).json({
      success: true,
      message: "TTE dashboard fetched successfully",
      data,
    });
  } catch (error) {
    console.error("TTE Dashboard Error:", error);

    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

/*
 * ============================================================
 * GET JOURNEY SUMMARY
 * ============================================================
 */

const getJourneySummary = async (req, res) => {
  try {
    const { journeyId } = req.params;

    const data = await tteService.getJourneySummary(journeyId);

    return res.status(200).json({
      success: true,
      message: "Journey summary fetched successfully",
      data,
    });
  } catch (error) {
    console.error("TTE Journey Summary Error:", error);

    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

/*
 * ============================================================
 * GET RAC PASSENGERS
 * ============================================================
 */

const getRACPassengers = async (req, res) => {
  try {
    const { journeyId } = req.params;

    const data = await tteService.getRACPassengers(journeyId);

    return res.status(200).json({
      success: true,
      message: "RAC passengers fetched successfully",
      data,
    });
  } catch (error) {
    console.error("TTE RAC Passengers Error:", error);

    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

/*
 * ============================================================
 * GET TODAY'S JOURNEYS
 * ============================================================
 */

const getTodayJourneys = async (req, res) => {
  try {
    const journeys = await tteService.getTodayJourneys();

    return res.status(200).json({
      success: true,
      count: journeys.length,
      data: journeys,
    });
  } catch (error) {
    console.error("Today's Journeys Error:", error);

    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

/*
 * ============================================================
 * COMPLETE JOURNEY
 * ============================================================
 *
 * Business rules are enforced inside journeyService.completeJourney()
 *
 * Expected flow:
 *
 * SCHEDULED
 *      ↓
 * BOARDING
 *      ↓
 * DEPARTED
 *      ↓
 * RUNNING
 *      ↓
 * ARRIVED
 *      ↓
 * COMPLETED
 *
 */

const completeJourney = async (req, res) => {
  try {
    const { journeyId } = req.params;

    if (!journeyId) {
      return res.status(400).json({
        success: false,
        message: "Journey ID is required",
      });
    }

    const journey =
      await journeyService.completeJourney(journeyId);

    return res.status(200).json({
      success: true,
      message: "Journey completed successfully",
      data: journey,
    });
  } catch (error) {
    console.error("Complete Journey Error:", error);

    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

/*
 * ============================================================
 * START ATTENDANCE
 * ============================================================
 *
 * Business rules are enforced inside
 * journeyService.startAttendance()
 *
 * Attendance should only start during:
 *
 * BOARDING
 *
 * It must NOT start during:
 *
 * SCHEDULED
 * DEPARTED
 * RUNNING
 * ARRIVED
 * COMPLETED
 * CANCELLED
 *
 */

const startAttendance = async (req, res) => {
  try {
    const { journeyId } = req.params;

    if (!journeyId) {
      return res.status(400).json({
        success: false,
        message: "Journey ID is required",
      });
    }

    const result =
      await journeyService.startAttendance(journeyId);

    return res.status(200).json({
      success: true,
      message: "Attendance started successfully",
      data: result,
    });
  } catch (error) {
    console.error("Start Attendance Error:", error);

    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

/*
 * ============================================================
 * GET ATTENDANCE STATUS
 * ============================================================
 */

const getAttendanceStatus = async (req, res) => {
  try {
    const { journeyId } = req.params;

    if (!journeyId) {
      return res.status(400).json({
        success: false,
        message: "Journey ID is required",
      });
    }

    const result =
      await journeyService.getAttendanceStatus(journeyId);

    return res.status(200).json({
      success: true,
      message: "Attendance status fetched successfully",
      data: result,
    });
  } catch (error) {
    console.error("Attendance Status Error:", error);

    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

/*
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {
  getDashboard,
  getJourneySummary,
  getRACPassengers,
  getTodayJourneys,
  completeJourney,
  startAttendance,
  getAttendanceStatus,
};