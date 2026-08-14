const {
  verifyPassengerByQR,
} = require("../services/verification.service");

/*
============================================================
VERIFY PASSENGER USING QR
============================================================
*/

const verifyPassenger = async (
  req,
  res
) => {
  try {
    /*
    ==========================================================
    GET QR TOKEN
    ==========================================================
    */

    const {
      qrToken,
    } = req.params;

    /*
    ==========================================================
    GET IDENTITY NUMBER
    ==========================================================
    */

    const {
      identityNumber,
    } = req.body;

    /*
    ==========================================================
    CALL SERVICE
    ==========================================================
    */

    const result =
      await verifyPassengerByQR(
        qrToken,
        identityNumber
      );

    /*
    ==========================================================
    SUCCESS RESPONSE
    ==========================================================
    */

    return res.status(200).json({
      success: true,

      message:
        result.message,

      data: result,
    });
  } catch (error) {
    /*
    ==========================================================
    ERROR
    ==========================================================
    */

    console.error(
      "QR VERIFICATION ERROR:",
      error
    );

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,

      message:
        error.message ||
        "Passenger verification failed",
    });
  }
};

/*
============================================================
EXPORT
============================================================
*/

module.exports = {
  verifyPassenger,
};