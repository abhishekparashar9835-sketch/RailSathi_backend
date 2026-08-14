const mongoose = require("mongoose");

const coachSchema = new mongoose.Schema(
  {
    train: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Train",
      required: true,
    },

    coachName: {
      type: String,
      required: true,
    },

    coachType: {
      type: String,
      enum: ["SL", "3AC", "2AC", "1AC", "CC", "GEN"],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Coach", coachSchema);