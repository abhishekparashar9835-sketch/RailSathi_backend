const mongoose = require("mongoose");

const passengerSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },

    journey: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Journey",
      required: true,
      index: true,
    },

    /*
     * Physical seat.
     *
     * CONFIRMED passenger -> normally has a seat
     * RAC passenger       -> seat is normally null
     */
    seat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seat",
      default: null,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    age: {
      type: Number,
      required: true,
      min: 1,
      max: 120,
    },

    gender: {
      type: String,
      enum: ["MALE", "FEMALE", "OTHER"],
      required: true,
    },

    /*
     * Only last 4 digits are stored,
     * and even those are hashed.
     */
    identityLast4Hash: {
      type: String,
      required: true,
      select: false,
    },

    /*
     * Reservation status
     */
    reservationStatus: {
      type: String,
      enum: [
        "CONFIRMED",
        "RAC",
        "ABSENT",
        "CANCELLED",
      ],
      default: "CONFIRMED",
      index: true,
    },

    /*
     * --------------------------------------------------------
     * RAC PROMOTION TRACKING
     * --------------------------------------------------------
     *
     * false:
     * Passenger was originally confirmed
     * or is currently RAC.
     *
     * true:
     * Passenger was RAC and was later
     * automatically promoted to CONFIRMED.
     *
     * This allows the TTE dashboard to clearly
     * display "PROMOTED FROM RAC".
     */
    wasPromotedFromRAC: {
      type: Boolean,
      default: false,
      index: true,
    },

    /*
     * When the RAC passenger was promoted.
     */
    racPromotedAt: {
      type: Date,
      default: null,
    },

    /*
     * Attendance
     */
    attendanceStatus: {
      type: String,
      enum: [
        "PENDING",
        "VERIFIED",
        "ABSENT",
      ],
      default: "PENDING",
      index: true,
    },

    attendanceVerifiedAt: {
      type: Date,
      default: null,
    },

    /*
     * ACTIVE = passenger record is active
     * CANCELLED = booking cancelled
     */
    status: {
      type: String,
      enum: [
        "ACTIVE",
        "CANCELLED",
      ],
      default: "ACTIVE",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

/*
 * ============================================================
 * UNIQUE ACTIVE SEAT PER JOURNEY
 * ============================================================
 *
 * A physical seat can only belong to one active
 * passenger during a particular journey.
 *
 * RAC passengers have seat = null, so they are
 * excluded from this unique index.
 */
passengerSchema.index(
  {
    journey: 1,
    seat: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      seat: {
        $type: "objectId",
      },
    },
  }
);

module.exports = mongoose.model(
  "Passenger",
  passengerSchema
);