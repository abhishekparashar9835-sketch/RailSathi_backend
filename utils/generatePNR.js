function generatePNR() {
  const timestamp = Date.now().toString().slice(-7);

  const random = Math.floor(
    100 + Math.random() * 900
  );

  return `${timestamp}${random}`;
}

module.exports = generatePNR;