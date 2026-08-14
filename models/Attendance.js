const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    passenger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Passenger",
      required: true,
      unique: true,
      index: true,
    },

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

    seat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seat",
      required: true,
    },

    verifiedAt: {
      type: Date,
      default: Date.now,
    },
    verificationStatus: {
  type: String,
  enum: ["SUCCESS", "FAILED"],
  default: "SUCCESS",
},

    verificationMethod: {
      type: String,
      enum: ["QR_IDENTITY"],
      default: "QR_IDENTITY",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Attendance", attendanceSchema);