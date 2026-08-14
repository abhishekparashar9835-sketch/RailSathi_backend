const QRCode = require("qrcode");

/*
 * Generates a printable QR code image (base64 PNG data URL)
 * that encodes the seat's qrToken. This is the same string
 * TTE app scans and sends to /api/attendance/verify.
 */
const generateQRImage = async (qrToken) => {
  if (!qrToken) {
    throw new Error("qrToken is required to generate a QR image");
  }

  const dataUrl = await QRCode.toDataURL(qrToken, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 300,
  });

  return dataUrl;
};

module.exports = generateQRImage;
