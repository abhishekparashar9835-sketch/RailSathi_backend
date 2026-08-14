const bcrypt = require("bcrypt");

const Passenger = require("../models/Passenger");
const Seat = require("../models/Seat");

/*
============================================================
VERIFY PASSENGER USING QR
============================================================
*/

const verifyPassengerByQR = async (
  qrToken,
  identityNumber
) => {
  /*
  ============================================================
  1. BASIC VALIDATION
  ============================================================
  */

  if (!qrToken) {
    const error = new Error(
      "QR token is required"
    );

    error.statusCode = 400;

    throw error;
  }

  if (!identityNumber) {
    const error = new Error(
      "Identity number is required"
    );

    error.statusCode = 400;

    throw error;
  }

  const identity =
    String(identityNumber).trim();

  /*
  ============================================================
  2. AADHAAR VALIDATION
  ============================================================
  */

  if (!/^\d{12}$/.test(identity)) {
    const error = new Error(
      "Valid 12-digit Aadhaar number is required"
    );

    error.statusCode = 400;

    throw error;
  }

  /*
  ============================================================
  3. FIND SEAT USING QR TOKEN
  ============================================================
  */

  const seat = await Seat.findOne({
    qrToken,
    isActive: true,
  });

  if (!seat) {
    const error = new Error(
      "Invalid or inactive QR code"
    );

    error.statusCode = 404;

    throw error;
  }

  /*
  ============================================================
  4. FIND ACTIVE PASSENGERS FOR THIS SEAT
  ============================================================
  */

  const passengers =
    await Passenger.find({
      seat: seat._id,
      status: "ACTIVE",
    }).populate({
      path: "booking",
      select: "pnr status",
    });

  if (passengers.length === 0) {
    const error = new Error(
      "No active passenger found for this seat"
    );

    error.statusCode = 404;

    throw error;
  }

  /*
  ============================================================
  5. VERIFY IDENTITY
  ============================================================
  
  During booking we stored only the bcrypt hash
  of the last 4 Aadhaar digits.

  Therefore we compare:

  submitted Aadhaar last 4
          ↓
  bcrypt.compare()
          ↓
  stored hash
  ============================================================
  */

  const identityLast4 =
    identity.slice(-4);

  let verifiedPassenger = null;

  for (const passenger of passengers) {
  console.log("QR DEBUG:", {
    passengerId: passenger._id,
    passengerName: passenger.name,
    hasIdentityHash: Boolean(
      passenger.identityLast4Hash
    ),
    identityLast4Length: identityLast4.length,
    passengerStatus: passenger.status,
    reservationStatus:
      passenger.reservationStatus,
  });

  if (!passenger.identityLast4Hash) {
    continue;
  }

  const matched = await bcrypt.compare(
    identityLast4,
    passenger.identityLast4Hash
  );

  console.log(
    "IDENTITY MATCH:",
    matched
  );

  if (matched) {
    verifiedPassenger = passenger;
    break;
  }
}

  /*
  ============================================================
  6. IDENTITY FAILED
  ============================================================
  */

  if (!verifiedPassenger) {
    const error = new Error(
      "Identity verification failed"
    );

    error.statusCode = 401;

    throw error;
  }

  /*
  ============================================================
  7. CHECK BOOKING
  ============================================================
  */

  if (
    verifiedPassenger.booking &&
    verifiedPassenger.booking.status ===
      "CANCELLED"
  ) {
    const error = new Error(
      "This booking has been cancelled"
    );

    error.statusCode = 400;

    throw error;
  }

  /*
  ============================================================
  8. ALREADY VERIFIED
  ============================================================
  */

  if (
    verifiedPassenger.attendanceStatus ===
    "VERIFIED"
  ) {
    return {
      alreadyVerified: true,

      message:
        "Passenger attendance is already verified",

      passenger: {
        _id:
          verifiedPassenger._id,

        name:
          verifiedPassenger.name,

        age:
          verifiedPassenger.age,

        gender:
          verifiedPassenger.gender,

        reservationStatus:
          verifiedPassenger.reservationStatus,

        attendanceStatus:
          verifiedPassenger.attendanceStatus,

        attendanceVerifiedAt:
          verifiedPassenger.attendanceVerifiedAt,
      },

      seat: {
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
      },

      pnr:
        verifiedPassenger.booking?.pnr ||
        null,
    };
  }

  /*
  ============================================================
  9. MARK ATTENDANCE VERIFIED
  ============================================================
  */

  verifiedPassenger.attendanceStatus =
    "VERIFIED";

  verifiedPassenger.attendanceVerifiedAt =
    new Date();

  await verifiedPassenger.save();

  /*
  ============================================================
  10. RETURN RESULT
  ============================================================
  */

  return {
    alreadyVerified: false,

    message:
      "Passenger verified successfully",

    passenger: {
      _id:
        verifiedPassenger._id,

      name:
        verifiedPassenger.name,

      age:
        verifiedPassenger.age,

      gender:
        verifiedPassenger.gender,

      reservationStatus:
        verifiedPassenger.reservationStatus,

      attendanceStatus:
        verifiedPassenger.attendanceStatus,

      attendanceVerifiedAt:
        verifiedPassenger.attendanceVerifiedAt,
    },

    seat: {
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
    },

    pnr:
      verifiedPassenger.booking?.pnr ||
      null,
  };
};

/*
============================================================
EXPORT
============================================================
*/

module.exports = {
  verifyPassengerByQR,
};