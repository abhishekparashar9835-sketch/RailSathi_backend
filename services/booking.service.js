const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const Booking = require("../models/Booking");
const Journey = require("../models/Journey");
const Passenger = require("../models/Passenger");
const Seat = require("../models/Seat");

const generatePNR = require("../utils/generatePNR");

const {
  updateJourneyStatusByTime,
} = require("./journey.service");

const SALT_ROUNDS = 12;

/*
============================================================
SMART SEAT ALLOCATION
============================================================

Priority:

1. Consecutive seats in same coach
2. Multiple seats in same coach
3. Any available seats

RAC passengers receive seat = null.
============================================================
*/

const findSmartSeats = (
  availableSeats,
  passengerCount
) => {
  if (
    !Array.isArray(availableSeats) ||
    passengerCount <= 0
  ) {
    return [];
  }

  const coaches = {};

  /*
  ==========================================================
  GROUP SEATS BY COACH
  ==========================================================
  */

  for (const seat of availableSeats) {
    if (!coaches[seat.coachName]) {
      coaches[seat.coachName] = [];
    }

    coaches[seat.coachName].push(seat);
  }

  /*
  ==========================================================
  SORT SEATS
  ==========================================================
  */

  for (const coachName of Object.keys(coaches)) {
    coaches[coachName].sort(
      (a, b) => a.seatNumber - b.seatNumber
    );
  }

  /*
  ==========================================================
  1. CONSECUTIVE SEATS
  ==========================================================
  */

  for (const coachName of Object.keys(coaches)) {
    const coachSeats = coaches[coachName];

    for (
      let i = 0;
      i <= coachSeats.length - passengerCount;
      i++
    ) {
      const group = coachSeats.slice(
        i,
        i + passengerCount
      );

      let consecutive = true;

      for (let j = 1; j < group.length; j++) {
        if (
          group[j].seatNumber !==
          group[j - 1].seatNumber + 1
        ) {
          consecutive = false;
          break;
        }
      }

      if (consecutive) {
        return group;
      }
    }
  }

  /*
  ==========================================================
  2. SAME COACH
  ==========================================================
  */

  for (const coachName of Object.keys(coaches)) {
    if (
      coaches[coachName].length >=
      passengerCount
    ) {
      return coaches[coachName].slice(
        0,
        passengerCount
      );
    }
  }

  /*
  ==========================================================
  3. ANY AVAILABLE SEATS
  ==========================================================
  */

  return availableSeats.slice(
    0,
    passengerCount
  );
};

/*
============================================================
CREATE BOOKING
============================================================
*/

const createBooking = async (data) => {
  const {
    journeyId,
    bookedBy,
    passengers,
  } = data;

  /*
  ==========================================================
  BASIC VALIDATION
  ==========================================================
  */

  if (!journeyId) {
    const error = new Error(
      "journeyId is required"
    );

    error.statusCode = 400;

    throw error;
  }

  if (!mongoose.Types.ObjectId.isValid(journeyId)) {
    const error = new Error(
      "Invalid journey ID"
    );

    error.statusCode = 400;

    throw error;
  }

  if (!bookedBy) {
    const error = new Error(
      "bookedBy is required"
    );

    error.statusCode = 400;

    throw error;
  }

  if (
    !Array.isArray(passengers) ||
    passengers.length === 0
  ) {
    const error = new Error(
      "At least one passenger is required"
    );

    error.statusCode = 400;

    throw error;
  }

  if (passengers.length > 6) {
    const error = new Error(
      "Maximum 6 passengers allowed per booking"
    );

    error.statusCode = 400;

    throw error;
  }

  const session =
    await mongoose.startSession();

  try {
    let bookingResult = null;

    await session.withTransaction(
      async () => {
        /*
        ======================================================
        1. FIND JOURNEY
        ======================================================
        */

        const journey =
          await Journey.findById(journeyId)
            .populate("train")
            .session(session);

        if (!journey) {
          const error = new Error(
            "Journey not found"
          );

          error.statusCode = 404;

          throw error;
        }

        if (!journey.train) {
          const error = new Error(
            "Train not found for this journey"
          );

          error.statusCode = 404;

          throw error;
        }

        if (!journey.isActive) {
          const error = new Error(
            "Journey is not active"
          );

          error.statusCode = 400;

          throw error;
        }

        /*
        ======================================================
        2. UPDATE JOURNEY STATUS
        ======================================================
        */

        await updateJourneyStatusByTime(
          journey
        );

        /*
        ======================================================
        3. VALIDATE DEPARTURE
        ======================================================
        */

        const now = new Date();

        const departureTime =
          new Date(
            journey.departureDateTime
          );

        if (
          isNaN(
            departureTime.getTime()
          )
        ) {
          const error = new Error(
            "Invalid journey departure time"
          );

          error.statusCode = 500;

          throw error;
        }

        if (now >= departureTime) {
          const error = new Error(
            "Booking is closed. The journey has already departed."
          );

          error.statusCode = 400;

          throw error;
        }

        /*
        ======================================================
        4. JOURNEY STATUS VALIDATION
        ======================================================
        */

        if (
          journey.currentStatus ===
          "CANCELLED"
        ) {
          const error = new Error(
            "Booking is not allowed. This journey has been cancelled."
          );

          error.statusCode = 400;

          throw error;
        }

        if (
          journey.currentStatus ===
          "COMPLETED"
        ) {
          const error = new Error(
            "Booking is not allowed. This journey has been completed."
          );

          error.statusCode = 400;

          throw error;
        }

        /*
        ======================================================
        5. GET PHYSICAL TRAIN SEATS
        ======================================================
        */

        const seats =
          await Seat.find({
            train: journey.train._id,
            isActive: true,
          })
            .sort({
              coachName: 1,
              seatNumber: 1,
            })
            .session(session);

        if (seats.length === 0) {
          const error = new Error(
            "No seats found for this train"
          );

          error.statusCode = 400;

          throw error;
        }

        /*
        ======================================================
        6. DETERMINE PHYSICAL CAPACITY
        ======================================================

        IMPORTANT:

        Older Journey documents may not contain
        seatCapacity.

        Therefore we safely fallback to the
        actual number of seats generated for
        the train.
        ======================================================
        */

        let totalJourneySeatCapacity =
          Number(journey.seatCapacity);

        if (
          !Number.isInteger(
            totalJourneySeatCapacity
          ) ||
          totalJourneySeatCapacity < 1
        ) {
          totalJourneySeatCapacity =
            seats.length;
        }

        /*
        ======================================================
        7. CONFIRMED SEAT CAPACITY
        ======================================================

        Example:

        seatCapacity = 100
        confirmedSeatCapacity = 15

        Passenger 1-15  => CONFIRMED
        Passenger 16+   => RAC
        ======================================================
        */

        let totalJourneyConfirmedCapacity =
          Number(
            journey.confirmedSeatCapacity
          );

        /*
        For old journeys where confirmedSeatCapacity
        does not exist, use seatCapacity.
        */

        if (
          !Number.isInteger(
            totalJourneyConfirmedCapacity
          ) ||
          totalJourneyConfirmedCapacity < 1
        ) {
          totalJourneyConfirmedCapacity =
            totalJourneySeatCapacity;
        }

        /*
        ======================================================
        8. RAC CAPACITY
        ======================================================
        */

        let totalJourneyRacCapacity =
          Number(journey.racCapacity);

        if (
          !Number.isInteger(
            totalJourneyRacCapacity
          ) ||
          totalJourneyRacCapacity < 0
        ) {
          totalJourneyRacCapacity = 0;
        }

        /*
        ======================================================
        9. CAPACITY SAFETY
        ======================================================
        */

        if (
          totalJourneyConfirmedCapacity >
          totalJourneySeatCapacity
        ) {
          const error = new Error(
            "Journey confirmed seat capacity cannot exceed physical seat capacity"
          );

          error.statusCode = 500;

          throw error;
        }

        /*
        ======================================================
        10. FIND OCCUPIED SEATS
        ======================================================
        */

        const bookedPassengers =
          await Passenger.find({
            journey: journey._id,
            status: "ACTIVE",
            seat: {
              $ne: null,
            },
          })
            .select("seat")
            .session(session);

        const bookedSeatIds =
          new Set(
            bookedPassengers
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
        ======================================================
        11. AVAILABLE PHYSICAL SEATS
        ======================================================
        */

        const availableSeats =
          seats.filter(
            (seat) =>
              !bookedSeatIds.has(
                seat._id.toString()
              )
          );

        /*
        ======================================================
        12. COUNT CONFIRMED PASSENGERS
        ======================================================
        */

        const currentConfirmedCount =
          await Passenger.countDocuments({
            journey: journey._id,
            status: "ACTIVE",
            reservationStatus: "CONFIRMED",
            seat: {
              $ne: null,
            },
          }).session(session);

        /*
        ======================================================
        13. COUNT RAC PASSENGERS
        ======================================================
        */

        const currentRACCount =
          await Passenger.countDocuments({
            journey: journey._id,
            status: "ACTIVE",
            reservationStatus: "RAC",
            seat: null,
          }).session(session);

        /*
        ======================================================
        14. REMAINING CONFIRMED CAPACITY
        ======================================================

        THIS WAS THE MAIN BUG.

        WRONG:

        seatCapacity - confirmedCount

        CORRECT:

        confirmedSeatCapacity - confirmedCount
        ======================================================
        */

        const remainingConfirmedSeats =
          Math.max(
            0,
            totalJourneyConfirmedCapacity -
              currentConfirmedCount
          );

        /*
        ======================================================
        15. REMAINING RAC CAPACITY
        ======================================================
        */

        const remainingRACSlots =
          Math.max(
            0,
            totalJourneyRacCapacity -
              currentRACCount
          );

        /*
        ======================================================
        16. DETERMINE CONFIRMED PASSENGERS
        ======================================================
        */

        const confirmedCount =
          Math.min(
            passengers.length,
            remainingConfirmedSeats,
            availableSeats.length
          );

        /*
        ======================================================
        17. REMAINING PASSENGERS
        ======================================================
        */

        const remainingPassengers =
          passengers.length -
          confirmedCount;

        /*
        ======================================================
        18. DETERMINE RAC PASSENGERS
        ======================================================
        */

        const racCount =
          Math.min(
            remainingPassengers,
            remainingRACSlots
          );

        /*
        ======================================================
        19. REJECTED PASSENGERS
        ======================================================
        */

        const rejectedCount =
          passengers.length -
          confirmedCount -
          racCount;

        if (rejectedCount > 0) {
          const error = new Error(
            `Booking exceeds available capacity. Confirmed seats remaining: ${remainingConfirmedSeats}, RAC slots remaining: ${remainingRACSlots}`
          );

          error.statusCode = 400;

          throw error;
        }

        /*
        ======================================================
        20. ALLOCATE CONFIRMED SEATS
        ======================================================
        */

        let allocatedSeats = [];

        if (confirmedCount > 0) {
          allocatedSeats =
            findSmartSeats(
              availableSeats,
              confirmedCount
            );
        }

        if (
          allocatedSeats.length <
          confirmedCount
        ) {
          const error = new Error(
            "Unable to allocate required seats"
          );

          error.statusCode = 400;

          throw error;
        }

        /*
        ======================================================
        21. GENERATE PNR
        ======================================================
        */

        const pnr = generatePNR();

        /*
        ======================================================
        22. BOOKING STATUS
        ======================================================
        */

        const bookingStatus =
          confirmedCount === 0 &&
          racCount > 0
            ? "RAC"
            : "CONFIRMED";

        /*
        ======================================================
        23. CREATE BOOKING
        ======================================================
        */

        const [booking] =
          await Booking.create(
            [
              {
                pnr,

                bookedBy,

                journey:
                  journey._id,

                passengerCount:
                  passengers.length,

                status:
                  bookingStatus,

                totalAmount: 0,
              },
            ],
            {
              session,
            }
          );

        /*
        ======================================================
        24. CREATE PASSENGERS
        ======================================================
        */

        const passengerDocuments = [];

        for (
          let i = 0;
          i < passengers.length;
          i++
        ) {
          const passenger =
            passengers[i];

          /*
          ----------------------------------------------------
          NAME
          ----------------------------------------------------
          */

          if (
            !passenger.name ||
            !String(
              passenger.name
            ).trim()
          ) {
            const error = new Error(
              `Passenger ${i + 1}: name is required`
            );

            error.statusCode = 400;

            throw error;
          }

          /*
          ----------------------------------------------------
          AGE
          ----------------------------------------------------
          */

          if (
            passenger.age === undefined ||
            passenger.age === null ||
            passenger.age === ""
          ) {
            const error = new Error(
              `Passenger ${i + 1}: age is required`
            );

            error.statusCode = 400;

            throw error;
          }

          const age =
            Number(passenger.age);

          if (
            !Number.isInteger(age) ||
            age < 0 ||
            age > 120
          ) {
            const error = new Error(
              `Passenger ${i + 1}: valid age is required`
            );

            error.statusCode = 400;

            throw error;
          }

          /*
          ----------------------------------------------------
          GENDER
          ----------------------------------------------------
          */

          if (!passenger.gender) {
            const error = new Error(
              `Passenger ${i + 1}: gender is required`
            );

            error.statusCode = 400;

            throw error;
          }

          /*
          ----------------------------------------------------
          IDENTITY NUMBER
          ----------------------------------------------------
          */

          if (
            !passenger.identityNumber
          ) {
            const error = new Error(
              `Passenger ${i + 1}: identityNumber is required`
            );

            error.statusCode = 400;

            throw error;
          }

          const identityNumber =
            String(
              passenger.identityNumber
            ).trim();

          /*
          ----------------------------------------------------
          AADHAAR VALIDATION
          ----------------------------------------------------
          */

          if (
            !/^\d{12}$/.test(
              identityNumber
            )
          ) {
            const error = new Error(
              `Passenger ${i + 1}: valid 12-digit Aadhaar number is required`
            );

            error.statusCode = 400;

            throw error;
          }

          /*
          ----------------------------------------------------
          HASH LAST 4 DIGITS
          ----------------------------------------------------
          */

          const identityLast4 =
            identityNumber.slice(-4);

          const identityLast4Hash =
            await bcrypt.hash(
              identityLast4,
              SALT_ROUNDS
            );

          /*
          ----------------------------------------------------
          RESERVATION STATUS
          ----------------------------------------------------
          */

          const isConfirmed =
            i < confirmedCount;

          const assignedSeat =
            isConfirmed
              ? allocatedSeats[i]._id
              : null;

          const reservationStatus =
            isConfirmed
              ? "CONFIRMED"
              : "RAC";

          /*
          ----------------------------------------------------
          CREATE PASSENGER DOCUMENT
          ----------------------------------------------------
          */

          passengerDocuments.push({
            booking:
              booking._id,

            journey:
              journey._id,

            seat:
              assignedSeat,

            name:
              String(
                passenger.name
              ).trim(),

            age,

            gender:
              passenger.gender,

            identityLast4Hash,

            reservationStatus,

            attendanceStatus:
              "PENDING",

            attendanceVerifiedAt:
              null,

            status:
              "ACTIVE",
          });
        }

        /*
        ======================================================
        25. INSERT PASSENGERS
        ======================================================
        */

        await Passenger.insertMany(
          passengerDocuments,
          {
            session,
          }
        );

        /*
        ======================================================
        26. FINAL COUNTS
        ======================================================
        */

        const totalBookedPassengers =
          await Passenger.countDocuments({
            journey: journey._id,
            status: "ACTIVE",
          }).session(session);

        const totalConfirmedPassengers =
          await Passenger.countDocuments({
            journey: journey._id,
            status: "ACTIVE",
            reservationStatus: "CONFIRMED",
            seat: {
              $ne: null,
            },
          }).session(session);

        const totalRACPassengers =
          await Passenger.countDocuments({
            journey: journey._id,
            status: "ACTIVE",
            reservationStatus: "RAC",
            seat: null,
          }).session(session);

        /*
        ======================================================
        27. PREPARE RESULT
        ======================================================
        */

        bookingResult = {
          booking,

          journey,

          allocatedSeats,

          totalSeats:
            totalJourneySeatCapacity,

          bookedSeats:
            totalConfirmedPassengers,

          availableSeats:
            Math.max(
              0,
              totalJourneySeatCapacity -
                totalConfirmedPassengers
            ),

          confirmedPassengers:
            confirmedCount,

          racPassengers:
            racCount,

          totalBookedPassengers,

          totalRACPassengers,

          confirmedSeatCapacity:
            totalJourneyConfirmedCapacity,

          racCapacity:
            totalJourneyRacCapacity,
        };
      }
    );

    /*
    ==========================================================
    28. RETURN RESPONSE
    ==========================================================
    */

    return {
      pnr:
        bookingResult.booking.pnr,

      bookingId:
        bookingResult.booking._id,

      status:
        bookingResult.booking.status,

      passengerCount:
        bookingResult.booking
          .passengerCount,

      totalAmount:
        bookingResult.booking
          .totalAmount,

      journey: {
        _id:
          bookingResult.journey._id,

        train:
          bookingResult.journey.train,

        departureDateTime:
          bookingResult.journey
            .departureDateTime,

        arrivalDateTime:
          bookingResult.journey
            .arrivalDateTime,

        platform:
          bookingResult.journey
            .platform,

        currentStatus:
          bookingResult.journey
            .currentStatus,

        seatCapacity:
          bookingResult.totalSeats,

        confirmedSeatCapacity:
          bookingResult.confirmedSeatCapacity,

        racCapacity:
          bookingResult.racCapacity,
      },

      totalSeats:
        bookingResult.totalSeats,

      bookedSeats:
        bookingResult.bookedSeats,

      availableSeats:
        bookingResult.availableSeats,

      confirmedPassengers:
        bookingResult.confirmedPassengers,

      racPassengers:
        bookingResult.racPassengers,

      totalBookedPassengers:
        bookingResult.totalBookedPassengers,

      totalRACPassengers:
        bookingResult.totalRACPassengers,

      allocatedSeats:
        bookingResult.allocatedSeats.map(
          (seat) => ({
            _id:
              seat._id,

            coachName:
              seat.coachName,

            coachType:
              seat.coachType,

            seatNumber:
              seat.seatNumber,

            displaySeat:
              seat.displaySeat,

            berthType:
              seat.berthType,
          })
        ),
    };
  } finally {
    await session.endSession();
  }
};

/*
============================================================
GET PASSENGERS BY PNR
============================================================
*/

const getPassengersByPNR = async (pnr) => {
  if (!pnr) {
    throw new Error("PNR is required");
  }

  const booking =
    await Booking.findOne({
      pnr: String(pnr).trim(),
    }).populate({
      path: "journey",
      populate: {
        path: "train",
        select:
          "trainNumber trainName trainType source destination",
      },
    });

  if (!booking) {
    const error = new Error(
      "Booking not found"
    );

    error.statusCode = 404;

    throw error;
  }

  if (booking.journey) {
    await updateJourneyStatusByTime(
      booking.journey
    );
  }

  const passengers =
    await Passenger.find({
      booking: booking._id,
    })
      .populate({
        path: "seat",
        select:
          "coachName coachType seatNumber displaySeat berthType",
      })
      .select(
        "name age gender seat status reservationStatus attendanceStatus attendanceVerifiedAt"
      );

  return {
    pnr:
      booking.pnr,

    bookingId:
      booking._id,

    status:
      booking.status,

    passengerCount:
      booking.passengerCount,

    totalAmount:
      booking.totalAmount,

    journey:
      booking.journey
        ? {
            _id:
              booking.journey._id,

            train:
              booking.journey.train,

            departureDateTime:
              booking.journey
                .departureDateTime,

            arrivalDateTime:
              booking.journey
                .arrivalDateTime,

            platform:
              booking.journey.platform,

            currentStatus:
              booking.journey
                .currentStatus,
          }
        : null,

    passengers:
      passengers.map(
        (passenger) => ({
          _id:
            passenger._id,

          name:
            passenger.name,

          age:
            passenger.age,

          gender:
            passenger.gender,

          status:
            passenger.status,

          reservationStatus:
            passenger.reservationStatus,

          seat:
            passenger.seat
              ? {
                  coachName:
                    passenger.seat
                      .coachName,

                  coachType:
                    passenger.seat
                      .coachType,

                  seatNumber:
                    passenger.seat
                      .seatNumber,

                  displaySeat:
                    passenger.seat
                      .displaySeat,

                  berthType:
                    passenger.seat
                      .berthType,
                }
              : null,

          attendanceStatus:
            passenger.attendanceStatus,

          attendanceVerifiedAt:
            passenger.attendanceVerifiedAt,
        })
      ),
  };
};

/*
============================================================
GET MY BOOKINGS
============================================================
*/

const getMyBookings = async (userId) => {
  if (!userId) {
    throw new Error(
      "User ID is required"
    );
  }

  const bookings =
    await Booking.find({
      bookedBy: userId,
    })
      .populate({
        path: "journey",
        populate: {
          path: "train",
          select:
            "trainNumber trainName trainType source destination",
        },
      })
      .sort({
        createdAt: -1,
      });

  if (bookings.length === 0) {
    return [];
  }

  const result = [];

  for (const booking of bookings) {
    if (booking.journey) {
      await updateJourneyStatusByTime(
        booking.journey
      );
    }

    const passengers =
      await Passenger.find({
        booking: booking._id,
      })
        .populate({
          path: "seat",
          select:
            "coachName coachType seatNumber displaySeat berthType",
        })
        .select(
          "name age gender seat status reservationStatus attendanceStatus attendanceVerifiedAt"
        );

    result.push({
      pnr:
        booking.pnr,

      bookingId:
        booking._id,

      status:
        booking.status,

      passengerCount:
        booking.passengerCount,

      totalAmount:
        booking.totalAmount,

      journey:
        booking.journey
          ? {
              _id:
                booking.journey._id,

              train:
                booking.journey.train,

              departureDateTime:
                booking.journey
                  .departureDateTime,

              arrivalDateTime:
                booking.journey
                  .arrivalDateTime,

              platform:
                booking.journey.platform,

              currentStatus:
                booking.journey
                  .currentStatus,
            }
          : null,

      passengers:
        passengers.map(
          (passenger) => ({
            _id:
              passenger._id,

            name:
              passenger.name,

            age:
              passenger.age,

            gender:
              passenger.gender,

            status:
              passenger.status,

            reservationStatus:
              passenger.reservationStatus,

            seat:
              passenger.seat
                ? {
                    coachName:
                      passenger.seat
                        .coachName,

                    coachType:
                      passenger.seat
                        .coachType,

                    seatNumber:
                      passenger.seat
                        .seatNumber,

                    displaySeat:
                      passenger.seat
                        .displaySeat,

                    berthType:
                      passenger.seat
                        .berthType,
                  }
                : null,

            attendanceStatus:
              passenger.attendanceStatus,

            attendanceVerifiedAt:
              passenger.attendanceVerifiedAt,
          })
        ),
    });
  }

  return result;
};

/*
============================================================
CANCEL BOOKING
============================================================
*/

const cancelBooking = async (
  pnr,
  userId
) => {
  if (!pnr) {
    throw new Error(
      "PNR is required"
    );
  }

  if (!userId) {
    throw new Error(
      "User ID is required"
    );
  }

  const session =
    await mongoose.startSession();

  try {
    let result = null;

    await session.withTransaction(
      async () => {
        /*
        ======================================================
        1. FIND BOOKING
        ======================================================
        */

        const booking =
          await Booking.findOne({
            pnr: String(pnr).trim(),
          }).session(session);

        if (!booking) {
          const error = new Error(
            "Booking not found"
          );

          error.statusCode = 404;

          throw error;
        }

        /*
        ======================================================
        2. AUTHORIZATION
        ======================================================
        */

        if (
          booking.bookedBy.toString() !==
          userId.toString()
        ) {
          const error = new Error(
            "You are not authorized to cancel this booking"
          );

          error.statusCode = 403;

          throw error;
        }

        /*
        ======================================================
        3. ALREADY CANCELLED
        ======================================================
        */

        if (
          booking.status ===
          "CANCELLED"
        ) {
          const error = new Error(
            "Booking is already cancelled"
          );

          error.statusCode = 400;

          throw error;
        }

        /*
        ======================================================
        4. CHECK JOURNEY
        ======================================================
        */

        const journey =
          await Journey.findById(
            booking.journey
          ).session(session);

        if (!journey) {
          const error = new Error(
            "Journey not found"
          );

          error.statusCode = 404;

          throw error;
        }

        /*
        ======================================================
        5. RELEASE PASSENGERS
        ======================================================
        */

        await Passenger.updateMany(
          {
            booking:
              booking._id,

            status:
              "ACTIVE",
          },
          {
            $set: {
              status:
                "CANCELLED",

              reservationStatus:
                "CANCELLED",

              attendanceStatus:
                "PENDING",

              attendanceVerifiedAt:
                null,

              seat:
                null,
            },
          },
          {
            session,
          }
        );

        /*
        ======================================================
        6. CANCEL BOOKING
        ======================================================
        */

        booking.status =
          "CANCELLED";

        await booking.save({
          session,
        });

        result = booking;
      }
    );

    return {
      pnr:
        result.pnr,

      bookingId:
        result._id,

      status:
        result.status,
    };
  } finally {
    await session.endSession();
  }
};

/*
============================================================
EXPORTS
============================================================
*/

module.exports = {
  createBooking,
  getPassengersByPNR,
  getMyBookings,
  cancelBooking,
};