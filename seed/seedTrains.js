const mongoose = require("mongoose");

const Train = require("../models/Train");
const Seat = require("../models/Seat");

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://yt:1EyUvsWpoAjKdWFr@cluster0.pe97ljy.mongodb.net/railsathi";


// ============================================
// TRAIN DATA
// ============================================

const trains = [
  {
    trainNumber: "12121",
    trainName: "Mithapur Rajdhani Express",
    trainType: "RAJDHANI",
    source: "New Delhi",
    destination: "Patna",
  },

  {
    trainNumber: "12345",
    trainName: "Patna Shatabdi Express",
    trainType: "SHATABDI",
    source: "New Delhi",
    destination: "Patna",
  },

  {
    trainNumber: "22456",
    trainName: "Patna Vande Bharat Express",
    trainType: "VANDE_BHARAT",
    source: "Patna",
    destination: "New Delhi",
  },

  {
    trainNumber: "12273",
    trainName: "Patna Duronto Express",
    trainType: "DURONTO",
    source: "New Delhi",
    destination: "Patna",
  },

  {
    trainNumber: "12951",
    trainName: "Mumbai Rajdhani Express",
    trainType: "RAJDHANI",
    source: "Mumbai",
    destination: "New Delhi",
  },
];

// ============================================
// COACH CONFIGURATION
// ============================================
//
//  AC1  = First AC
//  A1/A2 = 2A
//  B1/B2 = 3A
//  S1/S2 = Sleeper
//
// Change these according to your requirement.
// ============================================

const coachConfigurations = {
  AC1: {
    coachType: "AC_FIRST",
    totalSeats: 24,
  },

  A: {
    coachType: "AC_2_TIER",
    totalSeats: 46,
  },

  B: {
    coachType: "AC_3_TIER",
    totalSeats: 64,
  },

  S: {
    coachType: "SLEEPER",
    totalSeats: 72,
  },
};

// ============================================
// BERTH TYPES
// ============================================

const getBerthType = (seatNumber) => {
  const position = (seatNumber - 1) % 8;

  switch (position) {
    case 0:
      return "LOWER";

    case 1:
      return "MIDDLE";

    case 2:
      return "UPPER";

    case 3:
      return "LOWER";

    case 4:
      return "MIDDLE";

    case 5:
      return "UPPER";

    case 6:
      return "SIDE_LOWER";

    case 7:
      return "SIDE_UPPER";

    default:
      return "LOWER";
  }
};

// ============================================
// CREATE SEATS FOR A TRAIN
// ============================================

const createSeatsForTrain = async (
  train,
  coachPrefix,
  numberOfCoaches
) => {
  const seats = [];

  for (
    let coachNumber = 1;
    coachNumber <= numberOfCoaches;
    coachNumber++
  ) {
    const coachName =
      `${coachPrefix}${coachNumber}`;

    const config =
      coachConfigurations[coachPrefix];

    for (
      let seatNumber = 1;
      seatNumber <= config.totalSeats;
      seatNumber++
    ) {
      const berthType =
        getBerthType(seatNumber);

      const displaySeat =
        `${seatNumber}`;

      /*
       * Unique QR token.
       *
       * Example:
       *
       * TR12121-A1-001
       * TR12121-A1-002
       * TR12121-A1-003
       */

      const qrToken =
        `TR${train.trainNumber}-${coachName}-${String(
          seatNumber
        ).padStart(3, "0")}`;

      seats.push({
        train: train._id,

        coachName,

        coachType:
          config.coachType,

        seatNumber,

        displaySeat,

        berthType,

        qrToken,

        qrImage: null,

        isActive: true,
      });
    }
  }

  if (seats.length > 0) {
    await Seat.insertMany(seats);

    console.log(
      `✓ Created ${seats.length} seats for ${train.trainNumber}`
    );
  }

  return seats.length;
};

// ============================================
// MAIN SEED FUNCTION
// ============================================

const seedDatabase = async () => {
  try {
    console.log(
      "Connecting to MongoDB..."
    );

    await mongoose.connect(MONGO_URI);

    console.log(
      "✓ MongoDB connected"
    );

    // ----------------------------------------
    // WARNING
    // ----------------------------------------
    //
    // This deletes existing trains and seats.
    //
    // Remove these two lines if you don't want
    // to delete your current database.
    //

    await Seat.deleteMany({});
    await Train.deleteMany({});

    console.log(
      "✓ Existing trains and seats cleared"
    );

    // ----------------------------------------
    // CREATE TRAINS
    // ----------------------------------------

    for (const trainData of trains) {
      const train =
        await Train.create(trainData);

      console.log(
        `\n✓ Train created: ${train.trainNumber} - ${train.trainName}`
      );

      /*
       * Example configuration:
       *
       * AC1 → 1 coach
       * A   → 2 coaches
       * B   → 3 coaches
       * S   → 5 coaches
       */

      await createSeatsForTrain(
        train,
        "AC1",
        1
      );

      await createSeatsForTrain(
        train,
        "A",
        2
      );

      await createSeatsForTrain(
        train,
        "B",
        3
      );

      await createSeatsForTrain(
        train,
        "S",
        5
      );
    }

    // ----------------------------------------
    // SUMMARY
    // ----------------------------------------

    const totalTrains =
      await Train.countDocuments();

    const totalSeats =
      await Seat.countDocuments();

    console.log("\n================================");
    console.log("DATABASE SEED COMPLETED");
    console.log("================================");

    console.log(
      `Total trains: ${totalTrains}`
    );

    console.log(
      `Total seats: ${totalSeats}`
    );

    console.log(
      "================================\n"
    );

    process.exit(0);

  } catch (error) {
    console.error(
      "\n❌ SEED ERROR:"
    );

    console.error(error);

    process.exit(1);
  }
};

seedDatabase();