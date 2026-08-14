const express = require("express");

const router = express.Router();

const bookingController = require("../controllers/booking.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.post(
  "/",
  authMiddleware,
  bookingController.createBooking
);

router.get(
  "/my",
  authMiddleware,
  bookingController.getMyBookings
);

router.delete(
  "/:pnr",
  authMiddleware,
  bookingController.cancelBooking
);

router.get(
  "/:pnr",
  authMiddleware,
  bookingController.getPassengersByPNR
);


module.exports = router;