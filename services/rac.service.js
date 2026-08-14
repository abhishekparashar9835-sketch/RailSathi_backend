const mongoose = require("mongoose");

const Passenger = require("../models/Passenger");
const Journey = require("../models/Journey");
const Seat = require("../models/Seat");

/*
 * ============================================================
 * PROMOTE RAC PASSENGERS AUTOMATICALLY
 * ============================================================
 *
 * Flow:
 *
 * 1. Attendance processing releases seats from absent
 *    confirmed passengers.
 *
 * 2. Find ACTIVE RAC passengers.
 *
 * 3. Sort RAC passengers using FIFO order.
 *
 * 4. Find available physical seats for the journey's train.
 *
 * 5. Assign available seats to RAC passengers.
 *
 * 6. Change:
 *
 *      RAC -> CONFIRMED
 *
 * 7. Attendance status becomes PENDING again because
 *    the promoted passenger now has a confirmed physical seat.
 *
 * 8. Return promotion details for the TTE dashboard.
 *
 * IMPORTANT:
 *
 * - TTE does NOT manually select the passenger.
 * - Oldest RAC passenger is promoted first.
 * - RAC passengers have seat = null.
 * - Cancelled passengers are ignored.
 * - Promotion happens automatically.
 *
 * ============================================================
 */

const promoteRACPassengers = async (journeyId) => {
  if (!journeyId) {
    throw new Error("Journey ID is required");
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      /*
       * ======================================================
       * 1. FIND JOURNEY
       * ======================================================
       */

      const journey = await Journey.findById(journeyId)
        .populate({
          path: "train",
          select:
            "trainNumber trainName source destination",
        })
        .session(session);

      if (!journey) {
        throw new Error("Journey not found");
      }

      if (!journey.train) {
        throw new Error(
          "Train not found for this journey"
        );
      }

      /*
       * ======================================================
       * 2. FIND ACTIVE RAC PASSENGERS
       * ======================================================
       *
       * RAC passengers must satisfy:
       *
       * status            = ACTIVE
       * reservationStatus = RAC
       * seat              = null
       *
       * FIFO:
       *
       * Oldest RAC passenger is promoted first.
       */

      const racPassengers =
        await Passenger.find({
          journey: journey._id,

          status: "ACTIVE",

          reservationStatus: "RAC",

          seat: null,
        })
          .sort({
            createdAt: 1,
          })
          .session(session);

      /*
       * ======================================================
       * 3. NO RAC PASSENGERS
       * ======================================================
       */

      if (racPassengers.length === 0) {
        result = {
          promoted: [],

          promotedCount: 0,

          racCount: 0,

          remainingRAC: 0,

          availableSeatsBeforePromotion: 0,

          message:
            "No RAC passengers waiting for promotion",
        };

        return;
      }

      /*
       * ======================================================
       * 4. FIND ALL ACTIVE SEATS FOR TRAIN
       * ======================================================
       *
       * We use the Seat collection because seats are stored
       * separately from Train.
       */

      const allSeats = await Seat.find({
        train: journey.train._id,

        isActive: true,
      })
        .sort({
          coachName: 1,

          seatNumber: 1,
        })
        .session(session);

      /*
       * ======================================================
       * 5. NO SEATS FOUND
       * ======================================================
       */

      if (allSeats.length === 0) {
        result = {
          promoted: [],

          promotedCount: 0,

          racCount: racPassengers.length,

          remainingRAC: racPassengers.length,

          availableSeatsBeforePromotion: 0,

          message:
            "No seats found for this train",
        };

        return;
      }

      /*
       * ======================================================
       * 6. FIND CURRENTLY OCCUPIED SEATS
       * ======================================================
       *
       * Any ACTIVE passenger with a physical seat currently
       * occupies that seat.
       *
       * This includes:
       *
       * - CONFIRMED passengers
       * - Any RAC passenger that may already have a seat
       * - Previously promoted passengers
       */

      const occupiedPassengers =
        await Passenger.find({
          journey: journey._id,

          status: "ACTIVE",

          seat: {
            $ne: null,
          },
        })
          .select("seat")
          .session(session);

      /*
       * Convert occupied seat IDs into a Set.
       */

      const occupiedSeatIds =
        new Set(
          occupiedPassengers
            .filter(
              (passenger) =>
                passenger.seat
            )
            .map(
              (passenger) =>
                passenger.seat.toString()
            )
        );

      /*
       * ======================================================
       * 7. FIND AVAILABLE SEATS
       * ======================================================
       */

      const availableSeats =
        allSeats.filter(
          (seat) =>
            !occupiedSeatIds.has(
              seat._id.toString()
            )
        );

      /*
       * ======================================================
       * 8. NO AVAILABLE SEATS
       * ======================================================
       */

      if (
        availableSeats.length === 0
      ) {
        result = {
          promoted: [],

          promotedCount: 0,

          racCount:
            racPassengers.length,

          remainingRAC:
            racPassengers.length,

          availableSeatsBeforePromotion: 0,

          message:
            "No available seats for RAC promotion",
        };

        return;
      }

      /*
       * ======================================================
       * 9. DETERMINE PROMOTION COUNT
       * ======================================================
       *
       * Example:
       *
       * RAC passengers = 5
       * Available seats = 2
       *
       * Only first 2 RAC passengers are promoted.
       *
       * Remaining RAC = 3
       */

      const promotionCount =
        Math.min(
          racPassengers.length,
          availableSeats.length
        );

      const promotedPassengers = [];

      /*
       * ======================================================
       * 10. PROMOTE RAC PASSENGERS
       * ======================================================
       */

      for (
        let i = 0;
        i < promotionCount;
        i++
      ) {
        const racPassenger =
          racPassengers[i];

        const releasedSeat =
          availableSeats[i];

        /*
         * --------------------------------------------------
         * Save old reservation status
         * --------------------------------------------------
         */

        const previousReservationStatus =
          racPassenger.reservationStatus;

        /*
         * --------------------------------------------------
         * Assign physical seat
         * --------------------------------------------------
         */

        racPassenger.seat =
          releasedSeat._id;

        /*
         * --------------------------------------------------
         * RAC -> CONFIRMED
         * --------------------------------------------------
         */

        racPassenger.reservationStatus =
          "CONFIRMED";

        /*
         * --------------------------------------------------
         * Passenger remains ACTIVE
         * --------------------------------------------------
         */

        racPassenger.status =
          "ACTIVE";

        /*
         * --------------------------------------------------
         * Attendance becomes PENDING
         * --------------------------------------------------
         *
         * The passenger now has a confirmed physical seat.
         *
         * TTE must verify the passenger again.
         */

        racPassenger.attendanceStatus =
          "PENDING";

        /*
         * Clear previous verification timestamp.
         */

        racPassenger.attendanceVerifiedAt =
          null;

        /*
         * --------------------------------------------------
         * Save passenger
         * --------------------------------------------------
         */

        await racPassenger.save({
          session,
        });

        /*
         * --------------------------------------------------
         * Store promotion information
         * --------------------------------------------------
         */

        promotedPassengers.push({
          passengerId:
            racPassenger._id,

          passengerName:
            racPassenger.name,

          age:
            racPassenger.age,

          gender:
            racPassenger.gender,

          previousReservationStatus,

          newReservationStatus:
            "CONFIRMED",

          promotionStatus:
            "PROMOTED",

          seat: {
            _id:
              releasedSeat._id,

            coachName:
              releasedSeat.coachName,

            coachType:
              releasedSeat.coachType,

            seatNumber:
              releasedSeat.seatNumber,

            displaySeat:
              releasedSeat.displaySeat,

            berthType:
              releasedSeat.berthType,
          },

          attendanceStatus:
            racPassenger.attendanceStatus,
        });

        /*
         * --------------------------------------------------
         * Mark seat as occupied locally
         * --------------------------------------------------
         *
         * This prevents the same seat from being assigned
         * again during this transaction.
         */

        occupiedSeatIds.add(
          releasedSeat._id.toString()
        );
      }

      /*
       * ======================================================
       * 11. PREPARE FINAL RESULT
       * ======================================================
       */

      result = {
        promoted:
          promotedPassengers,

        promotedCount:
          promotedPassengers.length,

        racCount:
          racPassengers.length,

        remainingRAC:
          Math.max(
            racPassengers.length -
              promotedPassengers.length,
            0
          ),

        availableSeatsBeforePromotion:
          availableSeats.length,

        message:
          promotedPassengers.length >
          0
            ? "RAC passengers automatically promoted successfully"
            : "No RAC passengers were promoted",
      };
    });

    /*
     * ========================================================
     * 12. RETURN RESULT
     * ========================================================
     */

    return result;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  promoteRACPassengers,
};