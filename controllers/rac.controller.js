const racService = require("../services/rac.service");

/*
 * ============================================================
 * PROMOTE RAC PASSENGERS
 * ============================================================
 */

const promoteRACPassengers = async (req, res) => {
  try {
    const { journeyId } = req.params;

    if (!journeyId) {
      return res.status(400).json({
        success: false,
        message: "Journey ID is required",
      });
    }

    const result =
      await racService.promoteRACPassengers(
        journeyId
      );

    return res.status(200).json({
      success: true,
      message:
        result.message ||
        "RAC passengers processed successfully",
      data: result,
    });

  } catch (error) {
    console.error(
      "========== RAC PROMOTION ERROR =========="
    );

    console.error(
      "Message:",
      error.message
    );

    console.error(
      "Stack:",
      error.stack
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  promoteRACPassengers,
};