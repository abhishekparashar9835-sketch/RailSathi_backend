const mongoose = require("mongoose");

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
      enum: [
        "RAJDHANI",
        "SHATABDI",
        "VANDE_BHARAT",
        "DURONTO",
        "GARIB_RATH",
        "PASSENGER",
      ],
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

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Train", trainSchema);