const mongoose = require("mongoose");

const Journey = require("../models/Journey");
const Train = require("../models/Train");

// ============================================================
// CONSTANTS
// ============================================================

const ALLOWED_STATUSES = [
  "SCHEDULED",
  "BOARDING",
  "DEPARTED",
  "RUNNING",
  "ARRIVED",
  "COMPLETED",
  "CANCELLED",
];

const TRAIN_SELECT =
  "trainNumber trainName trainType source destination";

// ============================================================
// HELPERS
// ============================================================

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const validateJourneyId = (journeyId) => {
  if (!journeyId) {
    throw createError("Journey ID is required", 400);
  }

  if (!mongoose.Types.ObjectId.isValid(journeyId)) {
    throw createError("Invalid journey ID", 400);
  }
};

const getPopulatedJourney = async (journeyId) => {
  return Journey.findById(journeyId).populate(
    "train",
    TRAIN_SELECT
  );
};

// ============================================================
// CREATE JOURNEY
// ============================================================

const createJourney = async (data) => {
  const {
    train,
    departureDateTime,
    arrivalDateTime,
    platform,
    seatCapacity,
    confirmedSeatCapacity,
    racCapacity,
    currentStatus,
  } = data;

  // ----------------------------------------------------------
  // TRAIN
  // ----------------------------------------------------------

  if (!train) {
    throw createError("train is required", 400);
  }

  if (!mongoose.Types.ObjectId.isValid(train)) {
    throw createError("Invalid train ID", 400);
  }

  const trainDocument = await Train.findOne({
    _id: train,
    isActive: true,
  });

  if (!trainDocument) {
    throw createError("Active train not found", 404);
  }

  // ----------------------------------------------------------
  // DATES
  // ----------------------------------------------------------

  if (!departureDateTime) {
    throw createError(
      "departureDateTime is required",
      400
    );
  }

  if (!arrivalDateTime) {
    throw createError(
      "arrivalDateTime is required",
      400
    );
  }

  const departure = new Date(departureDateTime);
  const arrival = new Date(arrivalDateTime);

  if (isNaN(departure.getTime())) {
    throw createError(
      "Invalid departureDateTime",
      400
    );
  }

  if (isNaN(arrival.getTime())) {
    throw createError(
      "Invalid arrivalDateTime",
      400
    );
  }

  if (arrival <= departure) {
    throw createError(
      "Arrival time must be after departure time",
      400
    );
  }

  // ----------------------------------------------------------
  // PLATFORM
  // ----------------------------------------------------------

  if (
    platform === undefined ||
    platform === null ||
    !String(platform).trim()
  ) {
    throw createError("Platform is required", 400);
  }

  // ----------------------------------------------------------
  // SEAT CAPACITY
  // ----------------------------------------------------------

  const finalSeatCapacity = Number(seatCapacity);

  if (
    !Number.isInteger(finalSeatCapacity) ||
    finalSeatCapacity < 1
  ) {
    throw createError(
      "seatCapacity must be a positive integer",
      400
    );
  }

  // ----------------------------------------------------------
  // CONFIRMED SEAT CAPACITY
  // ----------------------------------------------------------

  const finalConfirmedSeatCapacity =
    confirmedSeatCapacity === undefined ||
    confirmedSeatCapacity === null ||
    confirmedSeatCapacity === ""
      ? finalSeatCapacity
      : Number(confirmedSeatCapacity);

  if (
    !Number.isInteger(finalConfirmedSeatCapacity) ||
    finalConfirmedSeatCapacity < 1
  ) {
    throw createError(
      "confirmedSeatCapacity must be a positive integer",
      400
    );
  }

  if (
    finalConfirmedSeatCapacity >
    finalSeatCapacity
  ) {
    throw createError(
      "confirmedSeatCapacity cannot exceed seatCapacity",
      400
    );
  }

  // ----------------------------------------------------------
  // RAC CAPACITY
  // ----------------------------------------------------------

  const finalRacCapacity =
    racCapacity === undefined ||
    racCapacity === null ||
    racCapacity === ""
      ? 100
      : Number(racCapacity);

  if (
    !Number.isInteger(finalRacCapacity) ||
    finalRacCapacity < 0
  ) {
    throw createError(
      "racCapacity must be a non-negative integer",
      400
    );
  }

  // ----------------------------------------------------------
  // STATUS
  // ----------------------------------------------------------

  const finalStatus =
    currentStatus &&
    ALLOWED_STATUSES.includes(currentStatus)
      ? currentStatus
      : "SCHEDULED";

  // ----------------------------------------------------------
  // DUPLICATE CHECK
  // ----------------------------------------------------------

  const existingJourney = await Journey.findOne({
    train: trainDocument._id,
    departureDateTime: departure,
    isActive: true,
  });

  if (existingJourney) {
    throw createError(
      "Journey already exists for this train and departure time",
      409
    );
  }

  // ----------------------------------------------------------
  // CREATE
  // ----------------------------------------------------------

  const journey = await Journey.create({
    train: trainDocument._id,

    departureDateTime: departure,

    arrivalDateTime: arrival,

    platform: String(platform).trim(),

    seatCapacity: finalSeatCapacity,

    confirmedSeatCapacity:
      finalConfirmedSeatCapacity,

    racCapacity: finalRacCapacity,

    delayInMinutes: 0,

    currentStatus: finalStatus,

    attendanceStartedAt: null,

    attendanceCutoffAt: null,

    attendanceClosed: false,

    attendanceProcessedAt: null,

    isActive: true,
  });

  return getPopulatedJourney(journey._id);
};

// ============================================================
// AUTOMATIC STATUS UPDATE
// ============================================================

const updateJourneyStatusByTime = async (journey) => {
  if (!journey) {
    return null;
  }

  // ----------------------------------------------------------
  // TERMINAL STATES
  // ----------------------------------------------------------

  if (
    journey.currentStatus === "CANCELLED" ||
    journey.currentStatus === "COMPLETED"
  ) {
    return journey;
  }

  const now = new Date();

  const departure = new Date(
    journey.departureDateTime
  );

  const arrival = new Date(
    journey.arrivalDateTime
  );

  if (
    isNaN(departure.getTime()) ||
    isNaN(arrival.getTime())
  ) {
    return journey;
  }

  // Boarding starts 30 minutes before departure
  const boardingStart = new Date(
    departure.getTime() -
      30 * 60 * 1000
  );

  // Running starts 1 minute after departure
  const runningStart = new Date(
    departure.getTime() +
      1 * 60 * 1000
  );

  let newStatus;

  if (now < boardingStart) {
    newStatus = "SCHEDULED";
  } else if (now < departure) {
    newStatus = "BOARDING";
  } else if (now < runningStart) {
    newStatus = "DEPARTED";
  } else if (now < arrival) {
    newStatus = "RUNNING";
  } else {
    newStatus = "ARRIVED";
  }

  if (
    newStatus !== journey.currentStatus
  ) {
    await Journey.updateOne(
      {
        _id: journey._id,
      },
      {
        $set: {
          currentStatus: newStatus,
        },
      }
    );

    journey.currentStatus = newStatus;
  }

  return journey;
};

// ============================================================
// GET ALL JOURNEYS
// ============================================================

const getAllJourneys = async () => {
  const journeys = await Journey.find({
    isActive: true,
  })
    .populate({
      path: "train",
      select: TRAIN_SELECT,
    })
    .sort({
      departureDateTime: 1,
    });

  for (const journey of journeys) {
    await updateJourneyStatusByTime(journey);
  }

  return journeys;
};

// ============================================================
// GET JOURNEY BY ID
// ============================================================

const getJourneyById = async (journeyId) => {
  validateJourneyId(journeyId);

  const journey = await getPopulatedJourney(
    journeyId
  );

  if (!journey) {
    throw createError(
      "Journey not found",
      404
    );
  }

  await updateJourneyStatusByTime(journey);

  return journey;
};

// ============================================================
// UPDATE JOURNEY
// PUT /api/journeys/:id
// ============================================================

const updateJourney = async (
  journeyId,
  data
) => {
  validateJourneyId(journeyId);

  const journey = await Journey.findById(
    journeyId
  );

  if (!journey) {
    throw createError(
      "Journey not found",
      404
    );
  }

  const {
    train,
    departureDateTime,
    arrivalDateTime,
    platform,
    seatCapacity,
    confirmedSeatCapacity,
    racCapacity,
    currentStatus,
    delayInMinutes,
  } = data;

  // ----------------------------------------------------------
  // TRAIN
  // ----------------------------------------------------------

  if (train !== undefined) {
    if (!mongoose.Types.ObjectId.isValid(train)) {
      throw createError(
        "Invalid train ID",
        400
      );
    }

    const trainDocument = await Train.findOne({
      _id: train,
      isActive: true,
    });

    if (!trainDocument) {
      throw createError(
        "Active train not found",
        404
      );
    }

    journey.train = trainDocument._id;
  }

  // ----------------------------------------------------------
  // DEPARTURE
  // ----------------------------------------------------------

  if (departureDateTime !== undefined) {
    const departure = new Date(
      departureDateTime
    );

    if (isNaN(departure.getTime())) {
      throw createError(
        "Invalid departureDateTime",
        400
      );
    }

    journey.departureDateTime = departure;
  }

  // ----------------------------------------------------------
  // ARRIVAL
  // ----------------------------------------------------------

  if (arrivalDateTime !== undefined) {
    const arrival = new Date(
      arrivalDateTime
    );

    if (isNaN(arrival.getTime())) {
      throw createError(
        "Invalid arrivalDateTime",
        400
      );
    }

    journey.arrivalDateTime = arrival;
  }

  // ----------------------------------------------------------
  // DATE CONSISTENCY
  // ----------------------------------------------------------

  if (
    journey.departureDateTime &&
    journey.arrivalDateTime &&
    journey.arrivalDateTime <=
      journey.departureDateTime
  ) {
    throw createError(
      "Arrival time must be after departure time",
      400
    );
  }

  // ----------------------------------------------------------
  // PLATFORM
  // ----------------------------------------------------------

  if (platform !== undefined) {
    if (!String(platform).trim()) {
      throw createError(
        "Platform is required",
        400
      );
    }

    journey.platform =
      String(platform).trim();
  }

  // ----------------------------------------------------------
  // PHYSICAL SEAT CAPACITY
  // ----------------------------------------------------------

  if (seatCapacity !== undefined) {
    const value = Number(seatCapacity);

    if (
      !Number.isInteger(value) ||
      value < 1
    ) {
      throw createError(
        "seatCapacity must be a positive integer",
        400
      );
    }

    journey.seatCapacity = value;
  }

  // ----------------------------------------------------------
  // CONFIRMED SEAT CAPACITY
  // ----------------------------------------------------------

  if (
    confirmedSeatCapacity !== undefined
  ) {
    const value = Number(
      confirmedSeatCapacity
    );

    if (
      !Number.isInteger(value) ||
      value < 1
    ) {
      throw createError(
        "confirmedSeatCapacity must be a positive integer",
        400
      );
    }

    journey.confirmedSeatCapacity =
      value;
  }

  // ----------------------------------------------------------
  // CONFIRMED <= PHYSICAL
  // ----------------------------------------------------------

  if (
    journey.confirmedSeatCapacity >
    journey.seatCapacity
  ) {
    throw createError(
      "confirmedSeatCapacity cannot exceed seatCapacity",
      400
    );
  }

  // ----------------------------------------------------------
  // RAC CAPACITY
  // ----------------------------------------------------------

  if (racCapacity !== undefined) {
    const value = Number(racCapacity);

    if (
      !Number.isInteger(value) ||
      value < 0
    ) {
      throw createError(
        "racCapacity must be a non-negative integer",
        400
      );
    }

    journey.racCapacity = value;
  }

  // ----------------------------------------------------------
  // STATUS
  // ----------------------------------------------------------

  if (currentStatus !== undefined) {
    if (
      !ALLOWED_STATUSES.includes(
        currentStatus
      )
    ) {
      throw createError(
        `Invalid journey status: ${currentStatus}`,
        400
      );
    }

    journey.currentStatus =
      currentStatus;
  }

  // ----------------------------------------------------------
  // DELAY
  // ----------------------------------------------------------

  if (delayInMinutes !== undefined) {
    const value = Number(
      delayInMinutes
    );

    if (
      !Number.isInteger(value) ||
      value < 0
    ) {
      throw createError(
        "delayInMinutes must be a non-negative integer",
        400
      );
    }

    journey.delayInMinutes = value;
  }

  // ----------------------------------------------------------
  // SAVE
  // ----------------------------------------------------------

  await journey.save();

  return getPopulatedJourney(
    journey._id
  );
};

// ============================================================
// UPDATE JOURNEY STATUS
// PATCH /api/journeys/:id/status
// ============================================================

const updateJourneyStatus = async (
  journeyId
) => {
  validateJourneyId(journeyId);

  const journey = await Journey.findById(
    journeyId
  );

  if (!journey) {
    throw createError(
      "Journey not found",
      404
    );
  }

  await updateJourneyStatusByTime(
    journey
  );

  return getPopulatedJourney(
    journey._id
  );
};

// ============================================================
// START ATTENDANCE
// ============================================================

const startAttendance = async (
  journeyId
) => {
  validateJourneyId(journeyId);

  const journey = await getPopulatedJourney(
    journeyId
  );

  if (!journey) {
    throw createError(
      "Journey not found",
      404
    );
  }

  if (!journey.isActive) {
    throw createError(
      "Journey is not active",
      400
    );
  }

  await updateJourneyStatusByTime(
    journey
  );

  if (
    journey.currentStatus ===
    "CANCELLED"
  ) {
    throw createError(
      "Cannot start attendance for a cancelled journey",
      400
    );
  }

  if (
    journey.currentStatus ===
    "COMPLETED"
  ) {
    throw createError(
      "Cannot start attendance after journey completion",
      400
    );
  }

  if (
    journey.currentStatus !==
    "BOARDING"
  ) {
    throw createError(
      `Attendance can only be started during boarding. Current status: ${journey.currentStatus}`,
      400
    );
  }

  if (journey.attendanceClosed) {
    throw createError(
      "Attendance has already been closed for this journey",
      400
    );
  }

  if (journey.attendanceStartedAt) {
    throw createError(
      "Attendance has already been started for this journey",
      400
    );
  }

  const attendanceDurationMinutes =
    Number(
      process.env.ATTENDANCE_DURATION_MINUTES ||
        60
    );

  if (
    !Number.isInteger(
      attendanceDurationMinutes
    ) ||
    attendanceDurationMinutes < 1
  ) {
    throw createError(
      "Invalid ATTENDANCE_DURATION_MINUTES configuration",
      500
    );
  }

  const startedAt = new Date();

  const cutoffAt = new Date(
    startedAt.getTime() +
      attendanceDurationMinutes *
        60 *
        1000
  );

  journey.attendanceStartedAt =
    startedAt;

  journey.attendanceCutoffAt =
    cutoffAt;

  journey.attendanceClosed = false;

  journey.attendanceProcessedAt =
    null;

  await journey.save();

  return {
    journey: {
      _id: journey._id,
      train: journey.train,
      departureDateTime:
        journey.departureDateTime,
      arrivalDateTime:
        journey.arrivalDateTime,
      platform: journey.platform,
      seatCapacity:
        journey.seatCapacity,
      confirmedSeatCapacity:
        journey.confirmedSeatCapacity,
      racCapacity:
        journey.racCapacity,
      currentStatus:
        journey.currentStatus,
    },

    attendance: {
      startedAt:
        journey.attendanceStartedAt,
      cutoffAt:
        journey.attendanceCutoffAt,
      durationMinutes:
        attendanceDurationMinutes,
      closed:
        journey.attendanceClosed,
      processedAt:
        journey.attendanceProcessedAt,
    },
  };
};

// ============================================================
// GET ATTENDANCE STATUS
// ============================================================

const getAttendanceStatus = async (
  journeyId
) => {
  validateJourneyId(journeyId);

  const journey = await Journey.findById(
    journeyId
  );

  if (!journey) {
    throw createError(
      "Journey not found",
      404
    );
  }

  await updateJourneyStatusByTime(
    journey
  );

  if (
    journey.currentStatus ===
    "COMPLETED"
  ) {
    return {
      status: "COMPLETED",
      startedAt:
        journey.attendanceStartedAt,
      cutoffAt:
        journey.attendanceCutoffAt,
      remainingSeconds: 0,
      closed: true,
      processedAt:
        journey.attendanceProcessedAt,
    };
  }

  if (!journey.attendanceStartedAt) {
    return {
      status: "NOT_STARTED",
      startedAt: null,
      cutoffAt: null,
      remainingSeconds: 0,
      closed:
        journey.attendanceClosed,
    };
  }

  if (journey.attendanceClosed) {
    return {
      status: "CLOSED",
      startedAt:
        journey.attendanceStartedAt,
      cutoffAt:
        journey.attendanceCutoffAt,
      remainingSeconds: 0,
      closed: true,
      processedAt:
        journey.attendanceProcessedAt,
    };
  }

  if (!journey.attendanceCutoffAt) {
    return {
      status: "NOT_STARTED",
      startedAt: null,
      cutoffAt: null,
      remainingSeconds: 0,
      closed: false,
    };
  }

  const now = new Date();

  const cutoff = new Date(
    journey.attendanceCutoffAt
  );

  const remainingMs = Math.max(
    0,
    cutoff.getTime() -
      now.getTime()
  );

  const remainingSeconds = Math.ceil(
    remainingMs / 1000
  );

  if (remainingSeconds <= 0) {
    return {
      status: "EXPIRED",
      startedAt:
        journey.attendanceStartedAt,
      cutoffAt:
        journey.attendanceCutoffAt,
      remainingSeconds: 0,
      closed: false,
    };
  }

  return {
    status: "ACTIVE",
    startedAt:
      journey.attendanceStartedAt,
    cutoffAt:
      journey.attendanceCutoffAt,
    remainingSeconds,
    closed: false,
  };
};

// ============================================================
// RESET ATTENDANCE
// ============================================================

const resetAttendance = async (
  journeyId
) => {
  validateJourneyId(journeyId);

  const journey = await Journey.findById(
    journeyId
  );

  if (!journey) {
    throw createError(
      "Journey not found",
      404
    );
  }

  await updateJourneyStatusByTime(
    journey
  );

  if (
    journey.currentStatus ===
    "COMPLETED"
  ) {
    throw createError(
      "Attendance cannot be reset after journey completion",
      400
    );
  }

  if (
    journey.currentStatus ===
    "CANCELLED"
  ) {
    throw createError(
      "Attendance cannot be reset for a cancelled journey",
      400
    );
  }

  if (
    journey.currentStatus !==
    "BOARDING"
  ) {
    throw createError(
      `Attendance can only be reset during boarding. Current status: ${journey.currentStatus}`,
      400
    );
  }

  if (journey.attendanceClosed) {
    throw createError(
      "Attendance has already been closed",
      400
    );
  }

  journey.attendanceStartedAt = null;

  journey.attendanceCutoffAt = null;

  journey.attendanceClosed = false;

  journey.attendanceProcessedAt = null;

  await journey.save();

  return getPopulatedJourney(
    journey._id
  );
};

// ============================================================
// CLOSE ATTENDANCE
// ============================================================

const closeAttendance = async (
  journeyId
) => {
  validateJourneyId(journeyId);

  const journey = await Journey.findById(
    journeyId
  );

  if (!journey) {
    throw createError(
      "Journey not found",
      404
    );
  }

  await updateJourneyStatusByTime(
    journey
  );

  if (
    journey.currentStatus ===
    "CANCELLED"
  ) {
    throw createError(
      "Cannot close attendance for a cancelled journey",
      400
    );
  }

  if (
    journey.currentStatus ===
    "COMPLETED"
  ) {
    return journey;
  }

  if (!journey.attendanceStartedAt) {
    throw createError(
      "Attendance has not been started",
      400
    );
  }

  if (journey.attendanceClosed) {
    throw createError(
      "Attendance is already closed",
      400
    );
  }

  journey.attendanceClosed = true;

  journey.attendanceProcessedAt =
    new Date();

  await journey.save();

  return journey;
};

// ============================================================
// COMPLETE JOURNEY
// ============================================================

const completeJourney = async (
  journeyId
) => {
  validateJourneyId(journeyId);

  const journey = await getPopulatedJourney(
    journeyId
  );

  if (!journey) {
    throw createError(
      "Journey not found",
      404
    );
  }

  await updateJourneyStatusByTime(
    journey
  );

  if (
    journey.currentStatus ===
    "CANCELLED"
  ) {
    throw createError(
      "Cannot complete a cancelled journey",
      400
    );
  }

  if (
    journey.currentStatus ===
    "COMPLETED"
  ) {
    throw createError(
      "Journey is already completed",
      400
    );
  }

  if (
    journey.currentStatus !==
    "ARRIVED"
  ) {
    throw createError(
      `Journey cannot be completed while status is ${journey.currentStatus}`,
      400
    );
  }

  journey.attendanceClosed = true;

  journey.attendanceProcessedAt =
    journey.attendanceProcessedAt ||
    new Date();

  journey.currentStatus =
    "COMPLETED";

  await journey.save();

  return getPopulatedJourney(
    journey._id
  );
};

// ============================================================
// DELETE JOURNEY
// ADMIN CAN DELETE ANY JOURNEY
// INCLUDING COMPLETED / CANCELLED
// ============================================================

const deleteJourney = async (
  journeyId
) => {
  validateJourneyId(journeyId);

  const journey = await Journey.findById(
    journeyId
  );

  if (!journey) {
    throw createError(
      "Journey not found",
      404
    );
  }

  // ----------------------------------------------------------
  // IMPORTANT
  // ----------------------------------------------------------
  // Do NOT block COMPLETED.
  // Do NOT block CANCELLED.
  // Admin is allowed to delete them.
  // ----------------------------------------------------------

  await Journey.findByIdAndDelete(
    journeyId
  );

  return journey;
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createJourney,
  getAllJourneys,
  getJourneyById,

  startAttendance,
  getAttendanceStatus,
  resetAttendance,
  closeAttendance,
  completeJourney,

  updateJourneyStatusByTime,
  updateJourneyStatus,
  updateJourney,

  deleteJourney,
};