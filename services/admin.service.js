const User = require("../models/User");
const Train = require("../models/Train");
const Journey = require("../models/Journey");
const Booking = require("../models/Booking");
const Passenger = require("../models/Passenger");

/*
 * ============================================================
 * GET ADMIN DASHBOARD
 * ============================================================
 */

const getDashboard = async () => {
  /*
   * ==========================================================
   * USER COUNTS
   * ==========================================================
   */

  const totalUsers =
    await User.countDocuments();

  const passengerUsers =
    await User.countDocuments({
      role: "PASSENGER",
    });

  const totalTTEs =
    await User.countDocuments({
      role: "TTE",
    });

  const totalAdmins =
    await User.countDocuments({
      role: "ADMIN",
    });

  /*
   * ==========================================================
   * TRAIN COUNTS
   * ==========================================================
   */

  const totalTrains =
    await Train.countDocuments();

  const activeTrains =
    await Train.countDocuments({
      isActive: true,
    });

  /*
   * ==========================================================
   * JOURNEY COUNTS
   * ==========================================================
   */

  const totalJourneys =
    await Journey.countDocuments();

  const activeJourneys =
    await Journey.countDocuments({
      isActive: true,
      currentStatus: {
        $ne: "COMPLETED",
      },
    });

  const completedJourneys =
    await Journey.countDocuments({
      currentStatus: "COMPLETED",
    });

  /*
   * ==========================================================
   * BOOKING COUNTS
   * ==========================================================
   */

  const totalBookings =
    await Booking.countDocuments();

  const activeBookings =
    await Booking.countDocuments({
      status: {
        $ne: "CANCELLED",
      },
    });

  const cancelledBookings =
    await Booking.countDocuments({
      status: "CANCELLED",
    });

  /*
   * ==========================================================
   * PASSENGER COUNTS
   * ==========================================================
   */

  const totalPassengerRecords =
    await Passenger.countDocuments();

  const activePassengers =
    await Passenger.countDocuments({
      status: "ACTIVE",
    });

  const confirmedPassengers =
    await Passenger.countDocuments({
      status: "ACTIVE",
      reservationStatus: "CONFIRMED",
    });

  const racPassengers =
    await Passenger.countDocuments({
      status: "ACTIVE",
      reservationStatus: "RAC",
    });

  /*
   * ==========================================================
   * ATTENDANCE
   * ==========================================================
   */

  const verifiedPassengers =
    await Passenger.countDocuments({
      status: "ACTIVE",
      attendanceStatus: "VERIFIED",
    });

  const pendingAttendance =
    await Passenger.countDocuments({
      status: "ACTIVE",
      reservationStatus: "CONFIRMED",
      attendanceStatus: {
        $ne: "VERIFIED",
      },
    });

  /*
   * ==========================================================
   * RECENT BOOKINGS
   * ==========================================================
   */

  const recentBookings =
    await Booking.find({})
      .populate({
        path: "bookedBy",
        select: "name email role",
      })
      .populate({
        path: "journey",
        populate: {
          path: "train",
          select:
            "trainNumber trainName source destination",
        },
      })
      .sort({
        createdAt: -1,
      })
      .limit(10)
      .select(
        "pnr status passengerCount totalAmount createdAt bookedBy journey"
      );

  /*
   * ==========================================================
   * RECENT JOURNEYS
   * ==========================================================
   */

  const recentJourneys =
    await Journey.find({})
      .populate({
        path: "train",
        select:
          "trainNumber trainName source destination",
      })
      .sort({
        departureDateTime: 1,
      })
      .limit(10)
      .select(
        "train departureDateTime arrivalDateTime platform currentStatus isActive"
      );

  /*
   * ==========================================================
   * RETURN DASHBOARD
   * ==========================================================
   */

  return {
    statistics: {
      users: {
        total: totalUsers,
        passengers: passengerUsers,
        ttes: totalTTEs,
        admins: totalAdmins,
      },

      trains: {
        total: totalTrains,
        active: activeTrains,
      },

      journeys: {
        total: totalJourneys,
        active: activeJourneys,
        completed: completedJourneys,
      },

      bookings: {
        total: totalBookings,
        active: activeBookings,
        cancelled: cancelledBookings,
      },

      passengers: {
        total: totalPassengerRecords,
        active: activePassengers,
        confirmed: confirmedPassengers,
        rac: racPassengers,
      },

      attendance: {
        verified: verifiedPassengers,
        pending: pendingAttendance,
      },
    },

    recentBookings,

    recentJourneys,
  };
};

/*
 * ============================================================
 * GET ALL USERS
 * ============================================================
 */

const getUsers = async ({
  role,
  status,
  search,
}) => {
  const filter = {};

  if (role) {
    filter.role = role;
  }

  if (status) {
    filter.status = status;
  }

  if (search) {
    filter.$or = [
      {
        name: {
          $regex: search,
          $options: "i",
        },
      },
      {
        email: {
          $regex: search,
          $options: "i",
        },
      },
    ];
  }

  const users =
    await User.find(filter)
      .select("-password -__v")
      .sort({
        createdAt: -1,
      });

  return users;
};

/*
 * ============================================================
 * GET ALL TRAINS
 * ============================================================
 */

const getTrains = async () => {
  const trains =
    await Train.find({})
      .sort({
        createdAt: -1,
      });

  return trains;
};

/*
 * ============================================================
 * GET ALL JOURNEYS
 * ============================================================
 */

const getJourneys = async () => {
  const journeys =
    await Journey.find({})
      .populate({
        path: "train",
        select:
          "trainNumber trainName source destination",
      })
      .sort({
        departureDateTime: 1,
      });

  return journeys;
};

/*
 * ============================================================
 * GET ALL BOOKINGS
 * ============================================================
 */

const getBookings = async () => {
  const bookings =
    await Booking.find({})
      .populate({
        path: "bookedBy",
        select: "name email",
      })
      .populate({
        path: "journey",
        populate: {
          path: "train",
          select:
            "trainNumber trainName source destination",
        },
      })
      .sort({
        createdAt: -1,
      });

  return bookings;
};

/*
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {
  getDashboard,
  getUsers,
  getTrains,
  getJourneys,
  getBookings,
};
module.exports = {
  getDashboard,
  getUsers,
  getTrains,
  getJourneys,
  getBookings,
  
};