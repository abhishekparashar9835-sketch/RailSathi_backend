const mongoose = require("mongoose");

const journeySchema = new mongoose.Schema(
  {
    // ============================================================
    // TRAIN
    // ============================================================

    train: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Train",
      required: true,
    },

    // ============================================================
    // JOURNEY TIMING
    // ============================================================

    departureDateTime: {
      type: Date,
      required: true,
    },

    arrivalDateTime: {
      type: Date,
      required: true,
    },

    platform: {
      type: String,
      required: true,
      trim: true,
    },

    // ============================================================
    // PHYSICAL SEAT CAPACITY
    // ============================================================

    seatCapacity: {
      type: Number,
      required: true,
      min: 1,
      default: 15,
    },

    // ============================================================
    // CONFIRMED SEAT CAPACITY
    // ============================================================

    confirmedSeatCapacity: {
      type: Number,
      required: true,
      min: 1,
    },

    // ============================================================
    // RAC CAPACITY
    // ============================================================

    racCapacity: {
      type: Number,
      min: 0,
      default: 100,
    },

    // ============================================================
    // DELAY
    // ============================================================

    delayInMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ============================================================
    // JOURNEY STATUS
    // ============================================================

    currentStatus: {
      type: String,
      enum: [
        "SCHEDULED",
        "BOARDING",
        "DEPARTED",
        "RUNNING",
        "ARRIVED",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "SCHEDULED",
    },

    // ============================================================
    // ATTENDANCE
    // ============================================================

    attendanceStartedAt: {
      type: Date,
      default: null,
    },

    attendanceCutoffAt: {
      type: Date,
      default: null,
    },

    attendanceClosed: {
      type: Boolean,
      default: false,
    },

    attendanceProcessedAt: {
      type: Date,
      default: null,
    },

    // ============================================================
    // ACTIVE
    // ============================================================

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ============================================================
// INDEXES
// ============================================================

journeySchema.index({
  attendanceCutoffAt: 1,
  attendanceClosed: 1,
});

journeySchema.index({
  train: 1,
  departureDateTime: 1,
});

module.exports = mongoose.model(
  "Journey",
  journeySchema
);