const Seat = require("../models/Seat");
const Train = require("../models/Train");

const generateQRImage = require("../utils/generateQRImage");

/*
 * Returns the QR image for a single seat.
 * Generates it once and caches it on the Seat document
 * (seat.qrImage) so repeat requests don't regenerate it.
 */
const getSeatQR = async (seatId) => {
  const seat = await Seat.findById(seatId);

  if (!seat || !seat.isActive) {
    const error = new Error("Seat not found");
    error.statusCode = 404;
    throw error;
  }

  if (!seat.qrImage) {
    seat.qrImage = await generateQRImage(seat.qrToken);
    await seat.save();
  }

  return {
    seatId: seat._id,
    coachName: seat.coachName,
    coachType: seat.coachType,
    displaySeat: seat.displaySeat,
    berthType: seat.berthType,
    qrToken: seat.qrToken,
    qrImage: seat.qrImage,
  };
};

/*
 * Force-regenerates the QR image for a seat
 * (e.g. if the token was ever rotated).
 */
const regenerateSeatQR = async (seatId) => {
  const seat = await Seat.findById(seatId);

  if (!seat || !seat.isActive) {
    const error = new Error("Seat not found");
    error.statusCode = 404;
    throw error;
  }

  seat.qrImage = await generateQRImage(seat.qrToken);
  await seat.save();

  return {
    seatId: seat._id,
    coachName: seat.coachName,
    displaySeat: seat.displaySeat,
    qrToken: seat.qrToken,
    qrImage: seat.qrImage,
  };
};

/*
 * Returns a print-ready sheet of every active seat's QR
 * code for a train, grouped by coach, so all seat QR
 * stickers for a rake can be generated/printed in one go.
 */
const getTrainQRSheet = async (trainId) => {
  const train = await Train.findById(trainId);

  if (!train || !train.isActive) {
    const error = new Error("Train not found");
    error.statusCode = 404;
    throw error;
  }

  const seats = await Seat.find({
    train: trainId,
    isActive: true,
  }).sort({ coachName: 1, seatNumber: 1 });

  if (seats.length === 0) {
    const error = new Error("No seats found for this train");
    error.statusCode = 404;
    throw error;
  }

  // Generate any missing QR images, caching as we go.
  const seatsNeedingQR = seats.filter((seat) => !seat.qrImage);

  for (const seat of seatsNeedingQR) {
    seat.qrImage = await generateQRImage(seat.qrToken);
  }

  if (seatsNeedingQR.length > 0) {
    await Seat.bulkWrite(
      seatsNeedingQR.map((seat) => ({
        updateOne: {
          filter: { _id: seat._id },
          update: { $set: { qrImage: seat.qrImage } },
        },
      }))
    );
  }

  const coaches = {};

  for (const seat of seats) {
    if (!coaches[seat.coachName]) {
      coaches[seat.coachName] = {
        coachName: seat.coachName,
        coachType: seat.coachType,
        seats: [],
      };
    }

    coaches[seat.coachName].seats.push({
      seatId: seat._id,
      displaySeat: seat.displaySeat,
      berthType: seat.berthType,
      qrToken: seat.qrToken,
      qrImage: seat.qrImage,
    });
  }

  return {
    train: {
      _id: train._id,
      trainNumber: train.trainNumber,
      trainName: train.trainName,
    },
    totalSeats: seats.length,
    coaches: Object.values(coaches).sort((a, b) =>
      a.coachName.localeCompare(b.coachName)
    ),
  };
};

module.exports = {
  getSeatQR,
  regenerateSeatQR,
  getTrainQRSheet,
};
