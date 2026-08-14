const { v4: uuidv4 } = require("uuid");

const generateQRToken = () => {
    return uuidv4();
};

module.exports = generateQRToken;