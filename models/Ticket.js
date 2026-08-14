const mongoose = require("mongoose");

const seatSchema = new mongoose.Schema(
  {
    seatNumber: {
      type: Number,
      required: true,
    },

    displaySeat: {
      type: String,
      required: true,
    },

    berthType: {
      type: String,
      required: true,
    },

    qrToken: {
      type: String,
      required: true,
    },
  },
  {
    _id: false,
  }
);

const coachSchema = new mongoose.Schema(
  {
    coachName: {
      type: String,
      required: true,
    },

    coachType: {
      type: String,
      required: true,
    },

    seats: [seatSchema],
  },
  {
    _id: false,
  }
);

const trainSchema = new mongoose.Schema(
  {
    trainNumber: {
      type: String,
      required: true,
      unique: true,
    },

    trainName: {
      type: String,
      required: true,
    },

    trainType: {
      type: String,
      required: true,
    },

    source: {
      type: String,
      required: true,
    },

    destination: {
      type: String,
      required: true,
    },

    coaches: [coachSchema],

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Ticket", trainSchema);