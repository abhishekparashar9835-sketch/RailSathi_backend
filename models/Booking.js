const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    pnr: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    journey: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Journey",
      required: true,
      index: true,
    },

    passengerCount: {
      type: Number,
      required: true,
      min: 1,
      max: 6,
    },

    status: {
      type: String,
      enum: ["CONFIRMED", "CANCELLED"],
      default: "CONFIRMED",
      index: true,
    },

    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
  type: String,
  enum: [
    "CONFIRMED",
    "RAC",
    "CANCELLED",
  ],
  default: "CONFIRMED",
  index: true,
},
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Booking", bookingSchema);