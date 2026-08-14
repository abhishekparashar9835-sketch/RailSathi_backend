const prefixes = {
  "1AC": "H",
  "2AC": "A",
  "3AC": "B",
  "SL": "S",
  "CC": "C",
  "2S": "D",
  "GEN": "GS",
};

const generateCoachName = (coachType, index) => {
  return `${prefixes[coachType]}${index}`;
};

module.exports = generateCoachName;