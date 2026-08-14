const express = require("express");
const router = express.Router();

const trainController = require("../controllers/train.controller");
const qrController = require("../controllers/qr.controller");
const validateTrain = require("../middleware/validateTrain");
const authMiddleware = require("../middleware/auth.middleware");
const authorizeRoles = require("../middleware/role.middleware");

// Create Train
router.post(
  "/",
  authMiddleware,
  authorizeRoles("ADMIN"),
  validateTrain,
  trainController.createTrain
);

// Get All Trains
router.get("/", trainController.getAllTrains);

// Get Seats of a Train (must come before /:id)
router.get("/:id/seats", trainController.getTrainSeats);

// Printable QR sheet for every seat on this train (must come before /:id)
router.get(
  "/:id/qr-sheet",
  authMiddleware,
  authorizeRoles("ADMIN"),
  qrController.getTrainQRSheet
);

// Single seat's QR image (must come before /:id)
router.get(
  "/seats/:seatId/qr",
  authMiddleware,
  authorizeRoles("ADMIN"),
  qrController.getSeatQR
);

// Force-regenerate a single seat's QR image
router.post(
  "/seats/:seatId/qr/regenerate",
  authMiddleware,
  authorizeRoles("ADMIN"),
  qrController.regenerateSeatQR
);

// Get Train by ID
router.get("/:id", trainController.getTrainById);

// Update Train
router.put(
  "/:id",
  authMiddleware,
  authorizeRoles("ADMIN"),
  trainController.updateTrain
);

// Delete Train
router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles("ADMIN"),
  trainController.deleteTrain
);

module.exports = router;