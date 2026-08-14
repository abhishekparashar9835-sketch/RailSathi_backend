const mongoose = require("mongoose");

const Journey = require("../models/Journey");
const Train = require("../models/Train");

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
    racCapacity,
    currentStatus,
    confirmedSeatCapacity,
  } = data;

  // ----------------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------------

  if (!train) {
    throw new Error("train is required");
  }

  if (!mongoose.Types.ObjectId.isValid(train)) {
    throw new Error("Invalid train ID");
  }

  if (!departureDateTime) {
    throw new Error("departureDateTime is required");
  }

  if (!arrivalDateTime) {
    throw new Error("arrivalDateTime is required");
  }

  if (!platform) {
    throw new Error("platform is required");
  }

  // ----------------------------------------------------------
  // PHYSICAL SEAT CAPACITY
  // ----------------------------------------------------------

  const finalSeatCapacity = Number(seatCapacity);

  if (
    !Number.isInteger(finalSeatCapacity) ||
    finalSeatCapacity < 1
  ) {
    throw new Error(
      "seatCapacity must be a positive integer"
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
    throw new Error(
      "confirmedSeatCapacity must be a positive integer"
    );
  }

  if (
    finalConfirmedSeatCapacity >
    finalSeatCapacity
  ) {
    throw new Error(
      "confirmedSeatCapacity cannot exceed seatCapacity"
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
    throw new Error(
      "racCapacity must be a non-negative integer"
    );
  }

  // ----------------------------------------------------------
  // FIND TRAIN
  // ----------------------------------------------------------

  const trainDocument = await Train.findOne({
    _id: train,
    isActive: true,
  });

  if (!trainDocument) {
    throw new Error("Active train not found");
  }

  // ----------------------------------------------------------
  // DATE VALIDATION
  // ----------------------------------------------------------

  const departure = new Date(departureDateTime);
  const arrival = new Date(arrivalDateTime);

  if (isNaN(departure.getTime())) {
    throw new Error(
      "Invalid departureDateTime"
    );
  }

  if (isNaN(arrival.getTime())) {
    throw new Error(
      "Invalid arrivalDateTime"
    );
  }

  if (arrival <= departure) {
    throw new Error(
      "Arrival time must be after departure time"
    );
  }

  // ----------------------------------------------------------
  // DUPLICATE JOURNEY CHECK
  // ----------------------------------------------------------

  const existingJourney = await Journey.findOne({
    train: trainDocument._id,
    departureDateTime: departure,
    isActive: true,
  });

  if (existingJourney) {
    throw new Error(
      "Journey already exists for this train and departure time"
    );
  }

  // ----------------------------------------------------------
  // STATUS
  // ----------------------------------------------------------

  const allowedStatuses = [
    "SCHEDULED",
    "BOARDING",
    "DEPARTED",
    "RUNNING",
    "ARRIVED",
    "COMPLETED",
    "CANCELLED",
  ];

  const finalStatus =
    currentStatus &&
    allowedStatuses.includes(currentStatus)
      ? currentStatus
      : "SCHEDULED";

  // ----------------------------------------------------------
  // CREATE JOURNEY
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

  // ----------------------------------------------------------
  // RETURN POPULATED JOURNEY
  // ----------------------------------------------------------

  return await Journey.findById(
    journey._id
  ).populate(
    "train",
    "trainNumber trainName trainType source destination"
  );
};

// ============================================================
// AUTOMATIC JOURNEY STATUS
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

  // ----------------------------------------------------------
  // BOARDING STARTS 30 MINUTES BEFORE DEPARTURE
  // ----------------------------------------------------------

  const boardingStart = new Date(
    departure.getTime() -
      30 * 60 * 1000
  );

  // ----------------------------------------------------------
  // RUNNING STARTS 1 MINUTE AFTER DEPARTURE
  // ----------------------------------------------------------

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

  // ----------------------------------------------------------
  // UPDATE ONLY STATUS
  // ----------------------------------------------------------

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
      select:
        "trainNumber trainName trainType source destination",
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
  if (!journeyId) {
    const error = new Error(
      "Journey ID is required"
    );

    error.statusCode = 400;

    throw error;
  }

  if (
    !mongoose.Types.ObjectId.isValid(
      journeyId
    )
  ) {
    const error = new Error(
      "Invalid journey ID"
    );

    error.statusCode = 400;

    throw error;
  }

  const journey = await Journey.findById(
    journeyId
  ).populate(
    "train",
    "trainNumber trainName trainType source destination"
  );

  if (!journey) {
    const error = new Error(
      "Journey not found"
    );

    error.statusCode = 404;

    throw error;
  }

  await updateJourneyStatusByTime(
    journey
  );

  return journey;
};

// ============================================================
// START ATTENDANCE
// ============================================================

const startAttendance = async (journeyId) => {
  if (!journeyId) {
    const error = new Error(
      "Journey ID is required"
    );

    error.statusCode = 400;

    throw error;
  }

  const journey = await Journey.findById(
    journeyId
  ).populate(
    "train",
    "trainNumber trainName trainType source destination"
  );

  if (!journey) {
    const error = new Error(
      "Journey not found"
    );

    error.statusCode = 404;

    throw error;
  }

  if (!journey.isActive) {
    const error = new Error(
      "Journey is not active"
    );

    error.statusCode = 400;

    throw error;
  }

  await updateJourneyStatusByTime(
    journey
  );

  if (
    journey.currentStatus ===
    "CANCELLED"
  ) {
    const error = new Error(
      "Cannot start attendance for a cancelled journey"
    );

    error.statusCode = 400;

    throw error;
  }

  if (
    journey.currentStatus ===
    "COMPLETED"
  ) {
    const error = new Error(
      "Cannot start attendance after journey completion"
    );

    error.statusCode = 400;

    throw error;
  }

  if (
    journey.currentStatus !==
    "BOARDING"
  ) {
    const error = new Error(
      `Attendance can only be started during boarding. Current status: ${journey.currentStatus}`
    );

    error.statusCode = 400;

    throw error;
  }

  if (journey.attendanceClosed) {
    const error = new Error(
      "Attendance has already been closed for this journey"
    );

    error.statusCode = 400;

    throw error;
  }

  if (journey.attendanceStartedAt) {
    const error = new Error(
      "Attendance has already been started for this journey"
    );

    error.statusCode = 400;

    throw error;
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
    const error = new Error(
      "Invalid ATTENDANCE_DURATION_MINUTES configuration"
    );

    error.statusCode = 500;

    throw error;
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
  if (!journeyId) {
    const error = new Error(
      "Journey ID is required"
    );

    error.statusCode = 400;

    throw error;
  }

  const journey = await Journey.findById(
    journeyId
  );

  if (!journey) {
    const error = new Error(
      "Journey not found"
    );

    error.statusCode = 404;

    throw error;
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

  const remainingSeconds =
    Math.ceil(
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
  if (!journeyId) {
    const error = new Error(
      "Journey ID is required"
    );

    error.statusCode = 400;

    throw error;
  }

  const journey = await Journey.findById(
    journeyId
  );

  if (!journey) {
    const error = new Error(
      "Journey not found"
    );

    error.statusCode = 404;

    throw error;
  }

  await updateJourneyStatusByTime(
    journey
  );

  if (
    journey.currentStatus ===
    "COMPLETED"
  ) {
    const error = new Error(
      "Attendance cannot be reset after journey completion"
    );

    error.statusCode = 400;

    throw error;
  }

  if (
    journey.currentStatus ===
    "CANCELLED"
  ) {
    const error = new Error(
      "Attendance cannot be reset for a cancelled journey"
    );

    error.statusCode = 400;

    throw error;
  }

  if (
    journey.currentStatus !==
    "BOARDING"
  ) {
    const error = new Error(
      `Attendance can only be reset during boarding. Current status: ${journey.currentStatus}`
    );

    error.statusCode = 400;

    throw error;
  }

  if (journey.attendanceClosed) {
    const error = new Error(
      "Attendance has already been closed"
    );

    error.statusCode = 400;

    throw error;
  }

  journey.attendanceStartedAt =
    null;

  journey.attendanceCutoffAt =
    null;

  journey.attendanceClosed =
    false;

  journey.attendanceProcessedAt =
    null;

  await journey.save();

  return journey;
};

// ============================================================
// CLOSE ATTENDANCE
// ============================================================

const closeAttendance = async (
  journeyId
) => {
  if (!journeyId) {
    const error = new Error(
      "Journey ID is required"
    );

    error.statusCode = 400;

    throw error;
  }

  const journey = await Journey.findById(
    journeyId
  );

  if (!journey) {
    const error = new Error(
      "Journey not found"
    );

    error.statusCode = 404;

    throw error;
  }

  await updateJourneyStatusByTime(
    journey
  );

  if (
    journey.currentStatus ===
    "CANCELLED"
  ) {
    const error = new Error(
      "Cannot close attendance for a cancelled journey"
    );

    error.statusCode = 400;

    throw error;
  }

  if (
    journey.currentStatus ===
    "COMPLETED"
  ) {
    return journey;
  }

  if (!journey.attendanceStartedAt) {
    const error = new Error(
      "Attendance has not been started"
    );

    error.statusCode = 400;

    throw error;
  }

  if (journey.attendanceClosed) {
    const error = new Error(
      "Attendance is already closed"
    );

    error.statusCode = 400;

    throw error;
  }

  journey.attendanceClosed =
    true;

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
  if (!journeyId) {
    const error = new Error(
      "Journey ID is required"
    );

    error.statusCode = 400;

    throw error;
  }

  const journey = await Journey.findById(
    journeyId
  ).populate(
    "train",
    "trainNumber trainName trainType source destination"
  );

  if (!journey) {
    const error = new Error(
      "Journey not found"
    );

    error.statusCode = 404;

    throw error;
  }

  await updateJourneyStatusByTime(
    journey
  );

  if (
    journey.currentStatus ===
    "CANCELLED"
  ) {
    const error = new Error(
      "Cannot complete a cancelled journey"
    );

    error.statusCode = 400;

    throw error;
  }

  if (
    journey.currentStatus ===
    "COMPLETED"
  ) {
    const error = new Error(
      "Journey is already completed"
    );

    error.statusCode = 400;

    throw error;
  }

  if (
    journey.currentStatus !==
    "ARRIVED"
  ) {
    const error = new Error(
      `Journey cannot be completed while status is ${journey.currentStatus}`
    );

    error.statusCode = 400;

    throw error;
  }

  journey.attendanceClosed =
    true;

  journey.attendanceProcessedAt =
    journey.attendanceProcessedAt ||
    new Date();

  journey.currentStatus =
    "COMPLETED";

  await journey.save();

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
  if (!journeyId) {
    const error = new Error(
      "Journey ID is required"
    );

    error.statusCode = 400;

    throw error;
  }

  if (
    !mongoose.Types.ObjectId.isValid(
      journeyId
    )
  ) {
    const error = new Error(
      "Invalid journey ID"
    );

    error.statusCode = 400;

    throw error;
  }

  const journey = await Journey.findById(
    journeyId
  );

  if (!journey) {
    const error = new Error(
      "Journey not found"
    );

    error.statusCode = 404;

    throw error;
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
    if (
      !mongoose.Types.ObjectId.isValid(
        train
      )
    ) {
      const error = new Error(
        "Invalid train ID"
      );

      error.statusCode = 400;

      throw error;
    }

    const trainDocument =
      await Train.findOne({
        _id: train,
        isActive: true,
      });

    if (!trainDocument) {
      const error = new Error(
        "Active train not found"
      );

      error.statusCode = 400;

      throw error;
    }

    journey.train =
      trainDocument._id;
  }

  // ----------------------------------------------------------
  // DEPARTURE
  // ----------------------------------------------------------

  if (
    departureDateTime !== undefined
  ) {
    const departure = new Date(
      departureDateTime
    );

    if (
      isNaN(departure.getTime())
    ) {
      const error = new Error(
        "Invalid departureDateTime"
      );

      error.statusCode = 400;

      throw error;
    }

    journey.departureDateTime =
      departure;
  }

  // ----------------------------------------------------------
  // ARRIVAL
  // ----------------------------------------------------------

  if (
    arrivalDateTime !== undefined
  ) {
    const arrival = new Date(
      arrivalDateTime
    );

    if (
      isNaN(arrival.getTime())
    ) {
      const error = new Error(
        "Invalid arrivalDateTime"
      );

      error.statusCode = 400;

      throw error;
    }

    journey.arrivalDateTime =
      arrival;
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
    const error = new Error(
      "Arrival time must be after departure time"
    );

    error.statusCode = 400;

    throw error;
  }

  // ----------------------------------------------------------
  // PLATFORM
  // ----------------------------------------------------------

  if (platform !== undefined) {
    if (!String(platform).trim()) {
      const error = new Error(
        "Platform is required"
      );

      error.statusCode = 400;

      throw error;
    }

    journey.platform =
      String(platform).trim();
  }

  // ----------------------------------------------------------
  // SEAT CAPACITY
  // ----------------------------------------------------------

  if (seatCapacity !== undefined) {
    const value = Number(
      seatCapacity
    );

    if (
      !Number.isInteger(value) ||
      value < 1
    ) {
      const error = new Error(
        "seatCapacity must be a positive integer"
      );

      error.statusCode = 400;

      throw error;
    }

    journey.seatCapacity =
      value;
  }

  // ----------------------------------------------------------
  // CONFIRMED SEAT CAPACITY
  // ----------------------------------------------------------

  if (
    confirmedSeatCapacity !==
    undefined
  ) {
    const value = Number(
      confirmedSeatCapacity
    );

    if (
      !Number.isInteger(value) ||
      value < 1
    ) {
      const error = new Error(
        "confirmedSeatCapacity must be a positive integer"
      );

      error.statusCode = 400;

      throw error;
    }

    journey.confirmedSeatCapacity =
      value;
  }

  if (
    journey.confirmedSeatCapacity >
    journey.seatCapacity
  ) {
    const error = new Error(
      "confirmedSeatCapacity cannot exceed seatCapacity"
    );

    error.statusCode = 400;

    throw error;
  }

  // ----------------------------------------------------------
  // RAC CAPACITY
  // ----------------------------------------------------------

  if (racCapacity !== undefined) {
    const value = Number(
      racCapacity
    );

    if (
      !Number.isInteger(value) ||
      value < 0
    ) {
      const error = new Error(
        "racCapacity must be a non-negative integer"
      );

      error.statusCode = 400;

      throw error;
    }

    journey.racCapacity = value;
  }

  // ----------------------------------------------------------
  // STATUS
  // ----------------------------------------------------------

  if (
    currentStatus !== undefined
  ) {
    const allowedStatuses = [
      "SCHEDULED",
      "BOARDING",
      "DEPARTED",
      "RUNNING",
      "ARRIVED",
      "COMPLETED",
      "CANCELLED",
    ];

    if (
      !allowedStatuses.includes(
        currentStatus
      )
    ) {
      const error = new Error(
        `Invalid journey status: ${currentStatus}`
      );

      error.statusCode = 400;

      throw error;
    }

    journey.currentStatus =
      currentStatus;
  }

  // ----------------------------------------------------------
  // DELAY
  // ----------------------------------------------------------

  if (
    delayInMinutes !== undefined
  ) {
    const value = Number(
      delayInMinutes
    );

    if (
      !Number.isInteger(value) ||
      value < 0
    ) {
      const error = new Error(
        "delayInMinutes must be a non-negative integer"
      );

      error.statusCode = 400;

      throw error;
    }

    journey.delayInMinutes =
      value;
  }

  await journey.save();

  return await Journey.findById(
    journey._id
  ).populate(
    "train",
    "trainNumber trainName trainType source destination"
  );
};

// ============================================================
// UPDATE JOURNEY STATUS
// ============================================================

const updateJourneyStatus = async (
  journeyId
) => {
  if (!journeyId) {
    const error = new Error(
      "Journey ID is required"
    );

    error.statusCode = 400;

    throw error;
  }

  if (
    !mongoose.Types.ObjectId.isValid(
      journeyId
    )
  ) {
    const error = new Error(
      "Invalid journey ID"
    );

    error.statusCode = 400;

    throw error;
  }

  const journey = await Journey.findById(
    journeyId
  );

  if (!journey) {
    const error = new Error(
      "Journey not found"
    );

    error.statusCode = 404;

    throw error;
  }

  await updateJourneyStatusByTime(
    journey
  );

  return await Journey.findById(
    journey._id
  ).populate({
    path: "train",
    select:
      "trainNumber trainName trainType source destination",
  });
};

// ============================================================
// DELETE JOURNEY
// ADMIN CAN DELETE ANY STATUS
// ============================================================

const deleteJourney = async (
  journeyId
) => {
  if (!journeyId) {
    const error = new Error(
      "Journey ID is required"
    );

    error.statusCode = 400;

    throw error;
  }

  if (
    !mongoose.Types.ObjectId.isValid(
      journeyId
    )
  ) {
    const error = new Error(
      "Invalid journey ID"
    );

    error.statusCode = 400;

    throw error;
  }

  const journey = await Journey.findById(
    journeyId
  );

  if (!journey) {
    const error = new Error(
      "Journey not found"
    );

    error.statusCode = 404;

    throw error;
  }

  // ==========================================================
  // NO STATUS RESTRICTION
  //
  // ADMIN CAN DELETE:
  //
  // SCHEDULED
  // BOARDING
  // DEPARTED
  // RUNNING
  // ARRIVED
  // COMPLETED
  // CANCELLED
  // ==========================================================

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