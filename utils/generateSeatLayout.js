const coachConfig = require("../constants/coachConfig");
const generateCoachName = require("./generateCoachName");

const generateSeatLayout = (trainId, trainNumber, coachRequests) => {
  const seats = [];

  coachRequests.forEach(({ coachType, count }) => {
    const config = coachConfig[coachType];

    if (!config) {
      throw new Error(`Invalid coach type: ${coachType}`);
    }

    for (let coachIndex = 1; coachIndex <= count; coachIndex++) {
      const coachName = generateCoachName(coachType, coachIndex);

      for (let seatNo = 1; seatNo <= config.seats; seatNo++) {
        seats.push({
          train: trainId,
          coachName,
          coachType,
          seatNumber: seatNo,
          displaySeat: seatNo.toString(),
          berthType: config.pattern[(seatNo - 1) % config.pattern.length],
          qrToken: `TR${trainNumber}-${coachName}-${String(seatNo).padStart(3, "0")}`,
        });
      }
    }
  });

  return seats;
};

module.exports = generateSeatLayout;