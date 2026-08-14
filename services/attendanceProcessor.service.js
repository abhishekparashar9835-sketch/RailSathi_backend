const mongoose = require("mongoose");

const Journey = require("../models/Journey");
const Passenger = require("../models/Passenger");
const Attendance = require("../models/Attendance");

const racService = require("./rac.service");

/*
 * ============================================================
 * PROCESS COMPLETED ATTENDANCE
 * ============================================================
 *
 * Flow:
 *
 * 1. Attendance window expires
 *
 * 2. Find ACTIVE CONFIRMED/RAC passengers
 *
 * 3. Find passengers who verified attendance
 *
 * 4. Mark unverified CONFIRMED passengers as ABSENT
 *
 * 5. Release their physical seats
 *
 * 6. Close attendance
 *
 * 7. Automatically promote RAC passengers
 *
 * IMPORTANT:
 *
 * TTE does NOT manually promote RAC passengers.
 *
 * Only seats released because of ABSENT confirmed
 * passengers are eligible for automatic RAC promotion.
 *
 * Example:
 *
 * Confirmed Passenger A
 *       ↓
 * absent
 *       ↓
 * Seat A released
 *       ↓
 * RAC Passenger B
 *       ↓
 * automatically gets Seat A
 *
 * RAC promotion is FIFO.
 *
 * Safe to run repeatedly because attendanceClosed
 * prevents duplicate attendance processing.
 */

const processJourneyAttendance = async (journeyId) => {
  if (!journeyId) {
    throw new Error("Journey ID is required");
  }

  const session = await mongoose.startSession();

  try {
    let result;

    /*
     * ========================================================
     * ATTENDANCE TRANSACTION
     * ========================================================
     */

    await session.withTransaction(async () => {
      /*
       * ------------------------------------------------------
       * 1. FIND JOURNEY
       * ------------------------------------------------------
       */

      const journey = await Journey.findById(
        journeyId
      ).session(session);

      if (!journey) {
        throw new Error("Journey not found");
      }

      /*
       * ------------------------------------------------------
       * 2. ATTENDANCE MUST HAVE STARTED
       * ------------------------------------------------------
       */

      if (!journey.attendanceStartedAt) {
        throw new Error(
          "Attendance has not been started for this journey"
        );
      }

      /*
       * ------------------------------------------------------
       * 3. ALREADY PROCESSED
       * ------------------------------------------------------
       */

      if (journey.attendanceClosed) {
        result = {
          alreadyProcessed: true,

          journeyId: journey._id,

          message:
            "Attendance has already been processed",
        };

        return;
      }

      /*
       * ------------------------------------------------------
       * 4. CHECK ATTENDANCE CUTOFF
       * ------------------------------------------------------
       */

      if (!journey.attendanceCutoffAt) {
        throw new Error(
          "Attendance cutoff time is not set"
        );
      }

      const now = new Date();

      const cutoffTime = new Date(
        journey.attendanceCutoffAt
      );

      if (now < cutoffTime) {
        const remainingMs =
          cutoffTime.getTime() -
          now.getTime();

        const remainingSeconds =
          Math.ceil(
            remainingMs / 1000
          );

        throw new Error(
          `Attendance window is still active. ${remainingSeconds} seconds remaining`
        );
      }

      /*
       * ------------------------------------------------------
       * 5. FIND ACTIVE CONFIRMED + RAC PASSENGERS
       * ------------------------------------------------------
       *
       * IMPORTANT:
       *
       * Passenger schema uses:
       *
       * reservationStatus
       *
       * NOT bookingStatus.
       */

      const passengers =
        await Passenger.find({
          journey: journey._id,

          status: "ACTIVE",

          reservationStatus: {
            $in: [
              "CONFIRMED",
              "RAC",
            ],
          },
        }).session(session);

      console.log(
        `[ATTENDANCE] Found ${passengers.length} active passengers`
      );

      /*
       * ------------------------------------------------------
       * 6. FIND VERIFIED ATTENDANCE
       * ------------------------------------------------------
       */

      const verifiedAttendance =
        await Attendance.find({
          journey: journey._id,
        })
          .select("passenger")
          .session(session);

      const verifiedPassengerIds =
        new Set(
          verifiedAttendance.map(
            (attendance) =>
              attendance.passenger.toString()
          )
        );

      console.log(
        `[ATTENDANCE] Verified passengers: ${verifiedPassengerIds.size}`
      );

      /*
       * ------------------------------------------------------
       * 7. FIND ABSENT PASSENGERS
       * ------------------------------------------------------
       */

      const absentPassengers =
        passengers.filter(
          (passenger) =>
            !verifiedPassengerIds.has(
              passenger._id.toString()
            )
        );

      console.log(
        `[ATTENDANCE] Absent passengers: ${absentPassengers.length}`
      );

      /*
       * ------------------------------------------------------
       * 8. PROCESS ABSENT PASSENGERS
       * ------------------------------------------------------
       *
       * CONFIRMED:
       *
       * reservationStatus:
       * CONFIRMED -> ABSENT
       *
       * attendanceStatus:
       * PENDING -> ABSENT
       *
       * status:
       * ACTIVE -> CANCELLED
       *
       * seat:
       * released
       *
       * RAC:
       *
       * remains RAC.
       *
       * RAC passengers do not own a physical confirmed
       * seat yet.
       */

      let absentConfirmedCount = 0;

      let absentRACCount = 0;

      /*
       * IMPORTANT:
       *
       * This array contains ONLY seats released by
       * absent CONFIRMED passengers during this
       * attendance-processing cycle.
       *
       * rac.service.js will use these exact seats.
       */

      const releasedSeatIds = [];

      for (
        const passenger of absentPassengers
      ) {
        /*
         * ====================================================
         * CONFIRMED PASSENGER
         * ====================================================
         */

        if (
          passenger.reservationStatus ===
          "CONFIRMED"
        ) {
          /*
           * Save the physical seat BEFORE
           * setting passenger.seat = null.
           */

          if (passenger.seat) {
            releasedSeatIds.push(
              passenger.seat
            );

            console.log(
              `[ATTENDANCE] Releasing seat ${passenger.seat} from absent passenger ${passenger._id}`
            );
          }

          /*
           * --------------------------------------------------
           * CONFIRMED -> ABSENT
           * --------------------------------------------------
           */

          passenger.reservationStatus =
            "ABSENT";

          /*
           * --------------------------------------------------
           * Attendance -> ABSENT
           * --------------------------------------------------
           */

          passenger.attendanceStatus =
            "ABSENT";

          /*
           * --------------------------------------------------
           * Passenger becomes inactive
           * --------------------------------------------------
           */

          passenger.status =
            "CANCELLED";

          /*
           * --------------------------------------------------
           * Release physical seat
           * --------------------------------------------------
           */

          passenger.seat = null;

          /*
           * --------------------------------------------------
           * No verification timestamp
           * --------------------------------------------------
           */

          passenger.attendanceVerifiedAt =
            null;

          absentConfirmedCount++;
        }

        /*
         * ====================================================
         * RAC PASSENGER
         * ====================================================
         *
         * RAC passengers don't own a confirmed
         * physical seat.
         *
         * They remain RAC.
         *
         * Their attendance can still be marked ABSENT.
         */

        else if (
          passenger.reservationStatus ===
          "RAC"
        ) {
          passenger.attendanceStatus =
            "ABSENT";

          absentRACCount++;
        }

        /*
         * Save passenger changes.
         */

        await passenger.save({
          session,
        });
      }

      /*
       * ------------------------------------------------------
       * 9. CLOSE ATTENDANCE
       * ------------------------------------------------------
       */

      journey.attendanceClosed =
        true;

      journey.attendanceProcessedAt =
        new Date();

      /*
       * ------------------------------------------------------
       * 10. SAVE JOURNEY
       * ------------------------------------------------------
       */

      await journey.save({
        session,
      });

      /*
       * ------------------------------------------------------
       * 11. PREPARE RESULT
       * ------------------------------------------------------
       */

      result = {
        alreadyProcessed: false,

        journeyId:
          journey._id,

        attendanceStartedAt:
          journey.attendanceStartedAt,

        attendanceCutoffAt:
          journey.attendanceCutoffAt,

        attendanceProcessedAt:
          journey.attendanceProcessedAt,

        totalPassengers:
          passengers.length,

        verifiedPassengers:
          verifiedPassengerIds.size,

        absentConfirmedPassengers:
          absentConfirmedCount,

        absentRACPassengers:
          absentRACCount,

        /*
         * Number of seats released by confirmed
         * absent passengers.
         */

        releasedSeats:
          releasedSeatIds.length,
      };

      /*
       * Store the released seat IDs outside the
       * transaction result object so they can be
       * passed to rac.service.js after attendance
       * processing succeeds.
       *
       * We attach them temporarily to result.
       */

      result.releasedSeatIds =
        releasedSeatIds;

      console.log(
        `[ATTENDANCE] Released ${releasedSeatIds.length} seat(s)`
      );
    });

    /*
     * ========================================================
     * AUTOMATIC RAC PROMOTION
     * ========================================================
     *
     * IMPORTANT:
     *
     * RAC promotion happens ONLY after attendance
     * processing has successfully completed.
     *
     * We pass the EXACT seats released above.
     *
     * TTE cannot choose the passenger.
     */

    if (
      result &&
      !result.alreadyProcessed
    ) {
      try {
        console.log(
          `[ATTENDANCE] Starting automatic RAC promotion for journey ${journeyId}`
        );

        console.log(
          `[ATTENDANCE] Released seat IDs available for RAC promotion: ${result.releasedSeatIds.length}`
        );

        const promotionResult =
          await racService.promoteRACPassengers(
            journeyId,
            result.releasedSeatIds
          );

        result.racPromotion =
          promotionResult;

        console.log(
          "[ATTENDANCE] RAC promotion completed:",
          promotionResult
        );
      } catch (promotionError) {
        /*
         * Attendance processing has already completed.
         *
         * RAC promotion failure should not undo the
         * attendance processing.
         *
         * The error is logged so that promotion can
         * be investigated/retried.
         */

        console.error(
          "[ATTENDANCE] RAC PROMOTION ERROR:",
          promotionError
        );

        result.racPromotion = {
          success: false,

          message:
            promotionError.message,
        };
      }

      /*
       * ------------------------------------------------------
       * DO NOT RETURN INTERNAL RELEASED SEAT IDS
       * ------------------------------------------------------
       *
       * They are useful internally but should not be
       * unnecessarily exposed in the final API result.
       */

      delete result.releasedSeatIds;
    }

    return result;
  } finally {
    await session.endSession();
  }
};


/*
 * ============================================================
 * PROCESS ALL EXPIRED JOURNEYS
 * ============================================================
 *
 * Finds journeys where:
 *
 * - attendanceStartedAt exists
 * - attendanceCutoffAt <= current time
 * - attendanceClosed = false
 * - isActive = true
 * - journey is not cancelled
 *
 * The cron job calls this function repeatedly.
 *
 * Only expired attendance windows are processed.
 */

const processExpiredAttendances =
  async () => {
    const now = new Date();

    const journeys =
      await Journey.find({
        attendanceStartedAt: {
          $ne: null,
        },

        attendanceCutoffAt: {
          $lte: now,
        },

        attendanceClosed: false,

        isActive: true,

        currentStatus: {
          $ne: "CANCELLED",
        },
      })
        .select("_id")
        .lean();

    const results = [];

    /*
     * --------------------------------------------------------
     * NO EXPIRED JOURNEYS
     * --------------------------------------------------------
     */

    if (journeys.length === 0) {
      console.log(
        "[ATTENDANCE JOB] No expired attendance found"
      );

      return {
        processedCount: 0,

        results: [],
      };
    }

    console.log(
      `[ATTENDANCE JOB] Found ${journeys.length} expired journey(s)`
    );

    /*
     * --------------------------------------------------------
     * PROCESS EACH EXPIRED JOURNEY
     * --------------------------------------------------------
     */

    for (
      const journey of journeys
    ) {
      try {
        console.log(
          `[ATTENDANCE JOB] Processing journey ${journey._id}`
        );

        const result =
          await processJourneyAttendance(
            journey._id
          );

        results.push({
          journeyId:
            journey._id,

          success: true,

          result,
        });

        console.log(
          `[ATTENDANCE JOB] Journey ${journey._id} processed successfully`
        );
      } catch (error) {
        console.error(
          `[ATTENDANCE JOB] Attendance processing failed for journey ${journey._id}:`,
          error
        );

        results.push({
          journeyId:
            journey._id,

          success: false,

          message:
            error.message,
        });
      }
    }

    return {
      processedCount:
        results.length,

      results,
    };
  };


/*
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {
  processJourneyAttendance,
  processExpiredAttendances,
};