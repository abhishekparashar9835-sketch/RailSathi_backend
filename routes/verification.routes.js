const express = require("express");

const {
  verifyPassenger,
} = require("../controllers/verification.controller");

const router = express.Router();

/*
============================================================
VERIFY PASSENGER
============================================================

POST /api/verification/:qrToken

Body:

{
  "identityNumber": "123456789012"
}
============================================================
*/

router.post(
  "/:qrToken",
  verifyPassenger
);

module.exports = router;