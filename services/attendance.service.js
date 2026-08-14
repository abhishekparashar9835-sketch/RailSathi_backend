const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const Seat = require("../models/Seat");
const Journey = require("../models/Journey");
const Passenger = require("../models/Passenger");
const Attendance = require("../models/Attendance");

const verifyAttendance = async ({
  journeyId,
  qrToken,
  identityLast4,
}) => {
  const session = await mongoose.startSession();

  try {
    let response;

    await session.withTransaction(async () => {
      // 1. Validate input
      if (!journeyId) {
        throw new Error("Journey ID is required");
      }

      if (!qrToken) {
        throw new Error("QR token is required");
      }

      if (!identityLast4) {
        throw new Error(
          "Last 4 digits of Aadhaar are required"
        );
      }

      if (!/^\d{4}$/.test(String(identityLast4))) {
        throw new Error(
          "Aadhaar last 4 digits must contain exactly 4 digits"
        );
      }

      // 2. Find physical seat using QR token
      const seat = await Seat.findOne({
        qrToken: String(qrToken).trim(),
        isActive: true,
      }).session(session);

      if (!seat) {
        throw new Error("Invalid QR Code");
      }

      // 3. Find journey
      const journey = await Journey.findById(journeyId)
        .populate("train")
        .session(session);

      if (!journey) {
        throw new Error("Journey not found");
      }

      if (!journey.train) {
        throw new Error("Train not found for this journey");
      }

      // 4. Make sure QR seat belongs to this train
      if (
        seat.train.toString() !==
        journey.train._id.toString()
      ) {
        throw new Error(
          "QR code does not belong to this journey"
        );
      }

      // 5. Find passenger occupying this physical seat
      const passenger = await Passenger.findOne({
        journey: journey._id,
        seat: seat._id,
        status: "ACTIVE",
      })
        .select("+identityLast4Hash")
        .populate("booking")
        .populate("seat")
        .session(session);

      if (!passenger) {
        throw new Error(
          "No active passenger is assigned to this seat"
        );
      }

      // 6. Make sure booking is confirmed
      if (
        !passenger.booking ||
        passenger.booking.status !== "CONFIRMED"
      ) {
        throw new Error(
          "Passenger booking is not confirmed"
        );
      }

      // 7. Check if attendance is already marked
      const existingAttendance =
        await Attendance.findOne({
          passenger: passenger._id,
        }).session(session);

      if (existingAttendance) {
        throw new Error(
          "Passenger attendance is already verified"
        );
      }

      // 8. Verify last 4 Aadhaar digits
      const isMatch = await bcrypt.compare(
        String(identityLast4),
        passenger.identityLast4Hash
      );

      if (!isMatch) {
        throw new Error(
          "Aadhaar verification failed"
        );
      }

      // 9. Create attendance record
      const attendanceRecords =
        await Attendance.create(
          [
            {
              passenger: passenger._id,
              booking: passenger.booking._id,
              journey: journey._id,
              seat: seat._id,
              verificationMethod: "QR_IDENTITY",
              verifiedAt: new Date(),
            },
          ],
          { session }
        );

      const attendance = attendanceRecords[0];

      // 10. Update passenger attendance status
      passenger.attendanceStatus = "VERIFIED";
      passenger.attendanceVerifiedAt = new Date();

      await passenger.save({ session });

      // 11. Response
      response = {
        attendance: {
          _id: attendance._id,
          passenger: attendance.passenger,
          booking: attendance.booking,
          journey: attendance.journey,
          seat: attendance.seat,
          verificationMethod:
            attendance.verificationMethod,
          verifiedAt: attendance.verifiedAt,
        },

        passenger: {
          id: passenger._id,
          name: passenger.name,
          age: passenger.age,
          gender: passenger.gender,

          booking: passenger.booking.pnr,

          coach: passenger.seat
            ? passenger.seat.coachName
            : null,

          seat: passenger.seat
            ? passenger.seat.displaySeat
            : null,

          berth: passenger.seat
            ? passenger.seat.berthType
            : null,

          attendanceStatus:
            passenger.attendanceStatus,

          attendanceVerifiedAt:
            passenger.attendanceVerifiedAt,
        },

        train: {
          trainNumber:
            journey.train.trainNumber,

          trainName:
            journey.train.trainName,

          source:
            journey.train.source,

          destination:
            journey.train.destination,
        },

        journey: {
          _id: journey._id,
          departureDateTime:
            journey.departureDateTime,

          arrivalDateTime:
            journey.arrivalDateTime,

          platform: journey.platform,

          currentStatus:
            journey.currentStatus,
        },
      };
    });

    return response;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  verifyAttendance,
};