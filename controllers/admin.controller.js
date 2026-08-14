const adminService = require("../services/admin.service");

/*
 * ============================================================
 * ADMIN DASHBOARD
 * ============================================================
 */

const getDashboard = async (req, res) => {
  try {
    const dashboard =
      await adminService.getDashboard();

    return res.status(200).json({
      success: true,
      message:
        "Admin dashboard fetched successfully",
      data: dashboard,
    });
  } catch (error) {
    console.error(
      "ADMIN DASHBOARD ERROR:",
      error
    );

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.message ||
        "Unable to fetch admin dashboard",
    });
  }
};

/*
 * ============================================================
 * USERS
 * ============================================================
 */

const getUsers = async (req, res) => {
  try {
    const {
      role,
      status,
      search,
    } = req.query;

    const users =
      await adminService.getUsers({
        role,
        status,
        search,
      });

    return res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error(
      "ADMIN USERS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to fetch users",
    });
  }
};

/*
 * ============================================================
 * TRAINS
 * ============================================================
 */

const getTrains = async (req, res) => {
  try {
    const trains =
      await adminService.getTrains();

    return res.status(200).json({
      success: true,
      count: trains.length,
      data: trains,
    });
  } catch (error) {
    console.error(
      "ADMIN TRAINS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to fetch trains",
    });
  }
};

/*
 * ============================================================
 * JOURNEYS
 * ============================================================
 */

const getJourneys = async (
  req,
  res
) => {
  try {
    const journeys =
      await adminService.getJourneys();

    return res.status(200).json({
      success: true,
      count: journeys.length,
      data: journeys,
    });
  } catch (error) {
    console.error(
      "ADMIN JOURNEYS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to fetch journeys",
    });
  }
};

/*
 * ============================================================
 * BOOKINGS
 * ============================================================
 */

const getBookings = async (
  req,
  res
) => {
  try {
    const bookings =
      await adminService.getBookings();

    return res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error(
      "ADMIN BOOKINGS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to fetch bookings",
    });
  }
};

module.exports = {
  getDashboard,
  getUsers,
  getTrains,
  getJourneys,
  getBookings,
};