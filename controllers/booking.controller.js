const bookingService = require("../services/booking.service");

// ============================================================
// CREATE BOOKING
// ============================================================

const createBooking = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const booking =
      await bookingService.createBooking({
        ...req.body,
        bookedBy: req.user.id,
      });

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Booking Error:", error);

    return res.status(
      error.statusCode || 400
    ).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// GET PASSENGERS BY PNR
// ============================================================

const getPassengersByPNR = async (req, res) => {
  try {
    const { pnr } = req.params;

    if (!pnr) {
      return res.status(400).json({
        success: false,
        message: "PNR is required",
      });
    }

    const data =
      await bookingService.getPassengersByPNR(
        pnr
      );

    return res.status(200).json({
      success: true,
      message:
        "Passenger details fetched successfully",
      data,
    });
  } catch (error) {
    console.error(
      "Passenger Lookup Error:",
      error
    );

    return res.status(
      error.statusCode || 404
    ).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// GET MY BOOKINGS
// ============================================================

const getMyBookings = async (req, res) => {
  try {
    console.log(
      "GET MY BOOKINGS - req.user:",
      req.user
    );

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required. User ID not found.",
      });
    }

    console.log(
      "GET MY BOOKINGS - userId:",
      req.user.id
    );

    const bookings =
      await bookingService.getMyBookings(
        req.user.id
      );

    return res.status(200).json({
      success: true,
      message:
        "My bookings fetched successfully",
      data: bookings,
    });
  } catch (error) {
    console.error(
      "My Bookings Error:",
      error
    );

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// CANCEL BOOKING
// ============================================================

const cancelBooking = async (req, res) => {
  try {
    const { pnr } = req.params;

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const data =
      await bookingService.cancelBooking(
        pnr,
        req.user.id
      );

    return res.status(200).json({
      success: true,
      message:
        "Booking cancelled successfully",
      data,
    });
  } catch (error) {
    console.error(
      "Cancel Booking Error:",
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
// EXPORTS
// ============================================================

module.exports = {
  createBooking,
  getPassengersByPNR,
  getMyBookings,
  cancelBooking,
};