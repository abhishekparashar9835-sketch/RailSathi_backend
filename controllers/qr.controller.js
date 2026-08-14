const qrService = require("../services/qr.service");

const getSeatQR = async (req, res) => {
  try {
    const data = await qrService.getSeatQR(req.params.seatId);

    res.status(200).json({
      success: true,
      message: "Seat QR fetched successfully",
      data,
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

const regenerateSeatQR = async (req, res) => {
  try {
    const data = await qrService.regenerateSeatQR(req.params.seatId);

    res.status(200).json({
      success: true,
      message: "Seat QR regenerated successfully",
      data,
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

const getTrainQRSheet = async (req, res) => {
  try {
    const data = await qrService.getTrainQRSheet(req.params.id);

    res.status(200).json({
      success: true,
      message: "Train QR sheet fetched successfully",
      data,
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getSeatQR,
  regenerateSeatQR,
  getTrainQRSheet,
};
