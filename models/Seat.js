const mongoose = require("mongoose");

const seatSchema = new mongoose.Schema(
  {
    train: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Train",
      required: true,
    },

    coachName: {
      type: String,
      required: true,
    },

    coachType: {
      type: String,
      required: true,
    },

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
      unique: true,
    },

    qrImage: {
      type: String,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    
  },
  {
    timestamps: true,
  }
);

seatSchema.index(
  {
    train: 1,
    coachName: 1,
    seatNumber: 1,
  },
  {
    unique: true,
  }
);

module.exports = mongoose.model("Seat", seatSchema);