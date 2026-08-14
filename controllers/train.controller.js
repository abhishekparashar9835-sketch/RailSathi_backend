const trainService = require("../services/train.service");

const createTrain = async (req, res) => {
  try {
    const train = await trainService.createTrain(req.body);

    res.status(201).json({
      success: true,
      message: "Train created successfully",
      data: train,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getAllTrains = async (req, res) => {
  try {
    const trains = await trainService.getAllTrains();

    res.status(200).json({
      success: true,
      count: trains.length,
      data: trains,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getTrainById = async (req, res) => {
  try {
    const train = await trainService.getTrainById(req.params.id);

    res.status(200).json({
      success: true,
      data: train,
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

const updateTrain = async (req, res) => {
  try {
    const train = await trainService.updateTrain(req.params.id, req.body);

    res.status(200).json({
      success: true,
      message: "Train updated successfully",
      data: train,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const deleteTrain = async (req, res) => {
  try {
    await trainService.deleteTrain(req.params.id);

    res.status(200).json({
      success: true,
      message: "Train deleted successfully",
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};
const getTrainSeats = async (req, res) => {
  try {
    const seats = await trainService.getTrainSeats(req.params.id);

    res.status(200).json({
      success: true,
      count: seats.length,
      data: seats,
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};
module.exports = {
  createTrain,
  getAllTrains,
  getTrainById,
  getTrainSeats,
  updateTrain,
  deleteTrain,
};