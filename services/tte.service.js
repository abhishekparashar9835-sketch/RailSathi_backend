const Journey = require("../models/Journey");
const Passenger = require("../models/Passenger");

/*
 * ============================================================
 * GET TTE DASHBOARD
 * ============================================================
 *
 * Returns the complete TTE dashboard:
 *
 * 1. Journey information
 * 2. Passenger summary
 * 3. RAC passengers
 * 4. Promoted-from-RAC passengers
 * 5. Physical coach/seat map
 * 6. Attendance information
 *
 */
const getDashboard = async (journeyId) => {
  /*
   * ==========================================================
   * FIND JOURNEY
   * ==========================================================
   */

  const journey = await Journey.findById(journeyId).populate({
    path: "train",
    select: "trainNumber trainName source destination",
  });

  if (!journey) {
    const error = new Error("Journey not found");
    error.statusCode = 404;
    throw error;
  }

  /*
   * ==========================================================
   * GET ACTIVE PASSENGERS
   * ==========================================================
   *
   * Include:
   *
   * CONFIRMED passengers
   * RAC passengers
   *
   * Cancelled passenger records are excluded.
   */

  const passengers = await Passenger.find({
    journey: journeyId,
    status: "ACTIVE",
  })
    .populate({
      path: "seat",
      select:
        "coachName coachType seatNumber displaySeat berthType",
    })
    .populate({
      path: "booking",
      select: "pnr",
    })
    .select(
      "name age gender seat reservationStatus wasPromotedFromRAC racPromotedAt attendanceStatus attendanceVerifiedAt booking createdAt"
    );

  /*
   * ==========================================================
   * COUNTERS
   * ==========================================================
   */

  let verified = 0;
  let pending = 0;

  let confirmed = 0;
  let rac = 0;

  let promotedFromRAC = 0;

  /*
   * ==========================================================
   * RAC PASSENGERS
   * ==========================================================
   */

  const racPassengers = [];

  /*
   * ==========================================================
   * PROMOTED PASSENGERS
   * ==========================================================
   */

  const promotedPassengers = [];

  /*
   * ==========================================================
   * COACH MAP
   * ==========================================================
   */

  const coaches = {};

  /*
   * ==========================================================
   * PROCESS PASSENGERS
   * ==========================================================
   */

  for (const passenger of passengers) {
    /*
     * --------------------------------------------------------
     * BASIC INFORMATION
     * --------------------------------------------------------
     */

    const pnr = passenger.booking
      ? passenger.booking.pnr
      : null;

    /*
     * --------------------------------------------------------
     * RAC PASSENGER
     * --------------------------------------------------------
     */

    if (passenger.reservationStatus === "RAC") {
      rac++;

      racPassengers.push({
        id: passenger._id,

        name: passenger.name,

        age: passenger.age,

        gender: passenger.gender,

        pnr,

        racPosition: null,

        reservationStatus:
          passenger.reservationStatus,

        attendanceStatus:
          passenger.attendanceStatus,

        attendanceVerifiedAt:
          passenger.attendanceVerifiedAt,

        seat: null,

        createdAt: passenger.createdAt,
      });

      /*
       * RAC passengers don't occupy a
       * physical confirmed seat.
       */

      continue;
    }

    /*
     * --------------------------------------------------------
     * CONFIRMED PASSENGER
     * --------------------------------------------------------
     */

    if (
      passenger.reservationStatus ===
      "CONFIRMED"
    ) {
      confirmed++;
    }

    /*
     * --------------------------------------------------------
     * RAC PROMOTION
     * --------------------------------------------------------
     *
     * This is the important part.
     *
     * wasPromotedFromRAC = true means:
     *
     * RAC passenger received a physical seat.
     */

    if (
      passenger.wasPromotedFromRAC === true
    ) {
      promotedFromRAC++;

      promotedPassengers.push({
        id: passenger._id,

        name: passenger.name,

        age: passenger.age,

        gender: passenger.gender,

        pnr,

        reservationStatus:
          passenger.reservationStatus,

        wasPromotedFromRAC: true,

        racPromotedAt:
          passenger.racPromotedAt,

        attendanceStatus:
          passenger.attendanceStatus,

        attendanceVerifiedAt:
          passenger.attendanceVerifiedAt,

        seat: passenger.seat
          ? {
              coachName:
                passenger.seat.coachName,

              displaySeat:
                passenger.seat.displaySeat,

              berthType:
                passenger.seat.berthType,

              seatNumber:
                passenger.seat.seatNumber,
            }
          : null,
      });
    }

    /*
     * --------------------------------------------------------
     * ATTENDANCE
     * --------------------------------------------------------
     */

    if (
      passenger.attendanceStatus ===
      "VERIFIED"
    ) {
      verified++;
    } else {
      pending++;
    }

    /*
     * --------------------------------------------------------
     * PASSENGER WITHOUT SEAT
     * --------------------------------------------------------
     *
     * A confirmed passenger should normally
     * have a seat.
     *
     * We don't add a seat-less passenger
     * to the physical seat map.
     */

    if (!passenger.seat) {
      continue;
    }

    /*
     * --------------------------------------------------------
     * COACH
     * --------------------------------------------------------
     */

    const coachName =
      passenger.seat.coachName;

    if (!coaches[coachName]) {
      coaches[coachName] = {
        coachName,

        coachType:
          passenger.seat.coachType,

        seats: [],
      };
    }

    /*
     * --------------------------------------------------------
     * ADD PASSENGER TO PHYSICAL SEAT MAP
     * --------------------------------------------------------
     */

    coaches[coachName].seats.push({
      seatNumber:
        passenger.seat.seatNumber,

      displaySeat:
        passenger.seat.displaySeat,

      berthType:
        passenger.seat.berthType,

      passenger: {
        id: passenger._id,

        name: passenger.name,

        age: passenger.age,

        gender: passenger.gender,

        pnr,

        reservationStatus:
          passenger.reservationStatus,

        /*
         * IMPORTANT
         *
         * This is used by TTEDashboard.jsx
         * to display:
         *
         * PROMOTED FROM RAC
         */

        wasPromotedFromRAC:
          passenger.wasPromotedFromRAC ===
          true,

        racPromotedAt:
          passenger.racPromotedAt,
      },

      status:
        passenger.attendanceStatus,

      verifiedAt:
        passenger.attendanceVerifiedAt,
    });
  }

  /*
   * ==========================================================
   * SORT RAC PASSENGERS
   * ==========================================================
   *
   * FIFO order.
   *
   * Older RAC record = higher priority.
   */

  racPassengers.sort((a, b) => {
    return (
      new Date(a.createdAt || 0) -
      new Date(b.createdAt || 0)
    );
  });

  /*
   * ==========================================================
   * ADD RAC POSITION
   * ==========================================================
   */

  racPassengers.forEach(
    (passenger, index) => {
      passenger.racPosition =
        index + 1;
    }
  );

  /*
   * ==========================================================
   * SORT PROMOTED PASSENGERS
   * ==========================================================
   *
   * Most recently promoted passenger first.
   */

  promotedPassengers.sort((a, b) => {
    return (
      new Date(
        b.racPromotedAt || 0
      ) -
      new Date(
        a.racPromotedAt || 0
      )
    );
  });

  /*
   * ==========================================================
   * SORT COACHES
   * ==========================================================
   */

  const coachList =
    Object.values(coaches).sort(
      (a, b) =>
        a.coachName.localeCompare(
          b.coachName
        )
    );

  /*
   * ==========================================================
   * SORT SEATS
   * ==========================================================
   */

  coachList.forEach((coach) => {
    coach.seats.sort(
      (a, b) =>
        a.seatNumber -
        b.seatNumber
    );
  });

  /*
   * ==========================================================
   * RETURN DASHBOARD
   * ==========================================================
   */

  return {
    /*
     * --------------------------------------------------------
     * JOURNEY
     * --------------------------------------------------------
     */

    journey: {
      _id: journey._id,

      train: journey.train,

      departureDateTime:
        journey.departureDateTime,

      arrivalDateTime:
        journey.arrivalDateTime,

      platform:
        journey.platform,

      delayInMinutes:
        journey.delayInMinutes,

      currentStatus:
        journey.currentStatus,
    },

    /*
     * --------------------------------------------------------
     * SUMMARY
     * --------------------------------------------------------
     */

    summary: {
      totalPassengers:
        passengers.length,

      confirmed,

      rac,

      verified,

      pending,

      /*
       * Number of physical seats
       * currently occupied.
       */

      occupiedSeats:
        confirmed,

      /*
       * Number of passengers
       * currently waiting in RAC.
       */

      racPassengers:
        racPassengers.length,

      /*
       * Number of passengers who
       * were promoted from RAC.
       */

      promotedFromRAC,
    },

    /*
     * --------------------------------------------------------
     * RAC PASSENGERS
     * --------------------------------------------------------
     */

    racPassengers,

    /*
     * --------------------------------------------------------
     * PROMOTED PASSENGERS
     * --------------------------------------------------------
     */

    promotedPassengers,

    /*
     * --------------------------------------------------------
     * PHYSICAL SEAT MAP
     * --------------------------------------------------------
     */

    coaches: coachList,
  };
};

/*
 * ============================================================
 * GET JOURNEY SUMMARY
 * ============================================================
 *
 * Lightweight TTE view.
 *
 * Returns:
 *
 * - total passengers
 * - confirmed
 * - RAC
 * - verified
 * - pending
 * - RAC passengers
 * - promoted passengers
 * - pending passengers
 *
 */
const getJourneySummary = async (
  journeyId
) => {
  /*
   * ==========================================================
   * FIND JOURNEY
   * ==========================================================
   */

  const journey =
    await Journey.findById(
      journeyId
    ).populate({
      path: "train",
      select:
        "trainNumber trainName source destination",
    });

  if (!journey) {
    const error =
      new Error(
        "Journey not found"
      );

    error.statusCode = 404;

    throw error;
  }

  /*
   * ==========================================================
   * GET PASSENGERS
   * ==========================================================
   */

  const passengers =
    await Passenger.find({
      journey: journeyId,
      status: "ACTIVE",
    })
      .populate({
        path: "seat",
        select:
          "coachName seatNumber displaySeat berthType",
      })
      .populate({
        path: "booking",
        select: "pnr",
      })
      .select(
        "name age gender seat reservationStatus wasPromotedFromRAC racPromotedAt attendanceStatus attendanceVerifiedAt booking createdAt"
      );

  /*
   * ==========================================================
   * COUNTERS
   * ==========================================================
   */

  let verified = 0;

  let confirmed = 0;

  let rac = 0;

  let promotedFromRAC = 0;

  const pendingPassengers = [];

  const racPassengers = [];

  const promotedPassengers = [];

  /*
   * ==========================================================
   * PROCESS PASSENGERS
   * ==========================================================
   */

  for (const passenger of passengers) {
    const pnr = passenger.booking
      ? passenger.booking.pnr
      : null;

    /*
     * --------------------------------------------------------
     * RAC
     * --------------------------------------------------------
     */

    if (
      passenger.reservationStatus ===
      "RAC"
    ) {
      rac++;

      racPassengers.push({
        id: passenger._id,

        name: passenger.name,

        age: passenger.age,

        gender: passenger.gender,

        pnr,

        racPosition: null,

        reservationStatus:
          passenger.reservationStatus,

        attendanceStatus:
          passenger.attendanceStatus,

        seat: null,

        createdAt:
          passenger.createdAt,
      });

      continue;
    }

    /*
     * --------------------------------------------------------
     * CONFIRMED
     * --------------------------------------------------------
     */

    if (
      passenger.reservationStatus ===
      "CONFIRMED"
    ) {
      confirmed++;
    }

    /*
     * --------------------------------------------------------
     * PROMOTED FROM RAC
     * --------------------------------------------------------
     */

    if (
      passenger.wasPromotedFromRAC ===
      true
    ) {
      promotedFromRAC++;

      promotedPassengers.push({
        id: passenger._id,

        name: passenger.name,

        age: passenger.age,

        gender: passenger.gender,

        pnr,

        reservationStatus:
          passenger.reservationStatus,

        wasPromotedFromRAC: true,

        racPromotedAt:
          passenger.racPromotedAt,

        seat: passenger.seat
          ? {
              coachName:
                passenger.seat.coachName,

              displaySeat:
                passenger.seat.displaySeat,

              berthType:
                passenger.seat.berthType,
            }
          : null,
      });
    }

    /*
     * --------------------------------------------------------
     * VERIFIED
     * --------------------------------------------------------
     */

    if (
      passenger.attendanceStatus ===
      "VERIFIED"
    ) {
      verified++;

      continue;
    }

    /*
     * --------------------------------------------------------
     * PENDING
     * --------------------------------------------------------
     */

    pendingPassengers.push({
      id: passenger._id,

      name: passenger.name,

      age: passenger.age,

      gender: passenger.gender,

      pnr,

      reservationStatus:
        passenger.reservationStatus,

      wasPromotedFromRAC:
        passenger.wasPromotedFromRAC ===
        true,

      racPromotedAt:
        passenger.racPromotedAt,

      seat: passenger.seat
        ? {
            coachName:
              passenger.seat
                .coachName,

            displaySeat:
              passenger.seat
                .displaySeat,

            berthType:
              passenger.seat
                .berthType,
          }
        : null,
    });
  }

  /*
   * ==========================================================
   * SORT RAC
   * ==========================================================
   */

  racPassengers.sort((a, b) => {
    return (
      new Date(a.createdAt || 0) -
      new Date(b.createdAt || 0)
    );
  });

  /*
   * ==========================================================
   * RAC POSITION
   * ==========================================================
   */

  racPassengers.forEach(
    (passenger, index) => {
      passenger.racPosition =
        index + 1;
    }
  );

  /*
   * ==========================================================
   * SORT PROMOTED
   * ==========================================================
   */

  promotedPassengers.sort(
    (a, b) => {
      return (
        new Date(
          b.racPromotedAt || 0
        ) -
        new Date(
          a.racPromotedAt || 0
        )
      );
    }
  );

  /*
   * ==========================================================
   * TOTAL / PENDING
   * ==========================================================
   */

  const totalPassengers =
    passengers.length;

  const pending =
    pendingPassengers.length;

  /*
   * ==========================================================
   * RETURN SUMMARY
   * ==========================================================
   */

  return {
    journey: {
      _id: journey._id,

      train: journey.train,

      departureDateTime:
        journey.departureDateTime,

      arrivalDateTime:
        journey.arrivalDateTime,

      platform:
        journey.platform,

      currentStatus:
        journey.currentStatus,
    },

    summary: {
      totalPassengers,

      confirmed,

      rac,

      verified,

      pending,

      promotedFromRAC,

      verifiedPercentage:
        totalPassengers === 0
          ? 0
          : Math.round(
              (verified /
                totalPassengers) *
                100
            ),
    },

    pendingPassengers,

    racPassengers,

    promotedPassengers,
  };
};

/*
 * ============================================================
 * GET RAC PASSENGERS
 * ============================================================
 *
 * Dedicated endpoint/service for the TTE RAC panel.
 *
 * Returns only passengers who are:
 *
 * - ACTIVE
 * - RAC
 * - seat = null
 *
 */
const getRACPassengers = async (
  journeyId
) => {
  /*
   * ==========================================================
   * FIND JOURNEY
   * ==========================================================
   */

  const journey =
    await Journey.findById(
      journeyId
    ).populate({
      path: "train",
      select:
        "trainNumber trainName source destination",
    });

  if (!journey) {
    const error =
      new Error(
        "Journey not found"
      );

    error.statusCode = 404;

    throw error;
  }

  /*
   * ==========================================================
   * GET RAC PASSENGERS
   * ==========================================================
   */

  const racPassengers =
    await Passenger.find({
      journey: journeyId,

      status: "ACTIVE",

      reservationStatus: "RAC",

      seat: null,
    })
      .populate({
        path: "booking",
        select: "pnr",
      })
      .sort({
        createdAt: 1,
      })
      .select(
        "name age gender reservationStatus attendanceStatus createdAt booking"
      );

  /*
   * ==========================================================
   * MAP RAC PASSENGERS
   * ==========================================================
   */

  const passengers =
    racPassengers.map(
      (passenger, index) => ({
        id: passenger._id,

        name: passenger.name,

        age: passenger.age,

        gender: passenger.gender,

        pnr: passenger.booking
          ? passenger.booking.pnr
          : null,

        racPosition:
          index + 1,

        reservationStatus:
          passenger.reservationStatus,

        attendanceStatus:
          passenger.attendanceStatus,

        status: "RAC",

        seat: null,

        createdAt:
          passenger.createdAt,
      })
    );

  /*
   * ==========================================================
   * RETURN
   * ==========================================================
   */

  return {
    journey: {
      _id: journey._id,

      train: journey.train,
    },

    summary: {
      racCount:
        passengers.length,
    },

    passengers,
  };
};

/*
 * ============================================================
 * COMPLETE JOURNEY
 * ============================================================
 */

const completeJourney = async (
  journeyId
) => {
  /*
   * ==========================================================
   * FIND JOURNEY
   * ==========================================================
   */

  const journey =
    await Journey.findById(
      journeyId
    );

  if (!journey) {
    const error =
      new Error(
        "Journey not found"
      );

    error.statusCode = 404;

    throw error;
  }

  /*
   * ==========================================================
   * ALREADY COMPLETED
   * ==========================================================
   */

  if (
    journey.currentStatus ===
    "COMPLETED"
  ) {
    const error =
      new Error(
        "Journey is already completed"
      );

    error.statusCode = 400;

    throw error;
  }

  /*
   * ==========================================================
   * CANCELLED
   * ==========================================================
   */

  if (
    journey.currentStatus ===
    "CANCELLED"
  ) {
    const error =
      new Error(
        "Cannot complete a cancelled journey"
      );

    error.statusCode = 400;

    throw error;
  }

  /*
   * ==========================================================
   * COMPLETE JOURNEY
   * ==========================================================
   */

  journey.currentStatus =
    "COMPLETED";

  await journey.save();

  /*
   * ==========================================================
   * FINAL COUNTS
   * ==========================================================
   */

  const totalPassengers =
    await Passenger.countDocuments({
      journey: journeyId,
      status: "ACTIVE",
    });

  const verified =
    await Passenger.countDocuments({
      journey: journeyId,
      status: "ACTIVE",
      attendanceStatus: "VERIFIED",
    });

  const confirmed =
    await Passenger.countDocuments({
      journey: journeyId,
      status: "ACTIVE",
      reservationStatus: "CONFIRMED",
    });

  const rac =
    await Passenger.countDocuments({
      journey: journeyId,
      status: "ACTIVE",
      reservationStatus: "RAC",
    });

  const promotedFromRAC =
    await Passenger.countDocuments({
      journey: journeyId,
      status: "ACTIVE",
      wasPromotedFromRAC: true,
    });

  /*
   * ==========================================================
   * RETURN FINAL SUMMARY
   * ==========================================================
   */

  return {
    journey: {
      _id: journey._id,

      currentStatus:
        journey.currentStatus,
    },

    finalSummary: {
      totalPassengers,

      confirmed,

      rac,

      verified,

      promotedFromRAC,

      pending:
        totalPassengers -
        verified,
    },
  };
};

/*
 * ============================================================
 * GET TODAY'S JOURNEYS
 * ============================================================
 */

const getTodayJourneys =
  async () => {
    const journeys =
      await Journey.find({
        isActive: true,

        currentStatus: {
          $ne: "COMPLETED",
        },
      })
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
 * EXPORTS
 * ============================================================
 */

module.exports = {
  getDashboard,
  getTodayJourneys,
  getJourneySummary,
  getRACPassengers,
  completeJourney,
};