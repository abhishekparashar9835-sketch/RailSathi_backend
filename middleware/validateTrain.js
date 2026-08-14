module.exports = (req, res, next) => {
  const { trainNumber, trainName, trainType, source, destination } = req.body;

  if (!trainNumber || !trainName || !trainType || !source || !destination) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  next();
};