const Train = require("../models/Train");
const Seat = require("../models/Seat");

const trainTypes = require("../constants/trainTypes");
const generateSeatLayout = require("../utils/generateSeatLayout");

const createTrain = async (data) => {
  const {
    trainNumber,
    trainName,
    trainType,
    source,
    destination,
  } = data;

  // Check if train already exists
  const existingTrain = await Train.findOne({ trainNumber });

  if (existingTrain) {
    throw new Error("Train already exists");
  }

  // Validate train type
  const coachConfiguration = trainTypes[trainType];

  if (!coachConfiguration) {
    throw new Error("Invalid train type");
  }

  // Create Train
  const train = await Train.create({
    trainNumber,
    trainName,
    trainType,
    source,
    destination,
  });

  // Convert coach configuration into array
  const coachRequests = Object.entries(coachConfiguration).map(
    ([coachType, count]) => ({
      coachType,
      count,
    })
  );

  // Generate all seat documents
  const seats = generateSeatLayout(
    train._id,
    trainNumber,
    coachRequests
  );

  // Insert seats in bulk
  await Seat.insertMany(seats);

  return train;
};

const getAllTrains = async () => {
  return await Train.find({ isActive: true }).sort({ trainNumber: 1 });
};

const getTrainById = async (id) => {
  const train = await Train.findOne({
    _id: id,
    isActive: true,
  });

  if (!train) {
    throw new Error("Train not found");
  }

  return train;
};

const getTrainSeats = async (trainId) => {
  const train = await Train.findById(trainId);

  if (!train || !train.isActive) {
    throw new Error("Train not found");
  }

  const seats = await Seat.find({
    train: trainId,
    isActive: true,
  })
    .sort({
      coachName: 1,
      seatNumber: 1,
    });

  return seats;
};

const updateTrain = async (id, data) => {
  const train = await Train.findById(id);

  if (!train || !train.isActive) {
    throw new Error("Train not found");
  }

  const { trainName, source, destination } = data;

  if (trainName) train.trainName = trainName;
  if (source) train.source = source;
  if (destination) train.destination = destination;

  await train.save();

  return train;
};

const deleteTrain = async (id) => {
  const train = await Train.findById(id);

  if (!train || !train.isActive) {
    throw new Error("Train not found");
  }

  train.isActive = false;
  await train.save();

  // Soft delete all seats
  await Seat.updateMany(
    { train: train._id },
    {
      $set: {
        isActive: false,
      },
    }
  );

  return train;
};

module.exports = {
  createTrain,
  getAllTrains,
  getTrainById,
  getTrainSeats,
  updateTrain,
  deleteTrain,
};