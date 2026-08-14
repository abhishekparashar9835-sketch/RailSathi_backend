const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/auth.routes");
const trainRoutes = require("./routes/train.routes");
const journeyRoutes = require("./routes/journey.routes");
const bookingRoutes = require("./routes/booking.routes");
const attendanceRoutes = require(
  "./routes/attendance.routes"
);
const tteRoutes = require("./routes/tte.routes");
const verificationRoutes = require("./routes/verification.routes");

const adminRoutes =
  require("./routes/admin.routes");

const app = express();




app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Welcome to RailSathi API 🚆"
    });
});



// after app.use(express.json())

app.use("/api/auth", authRoutes);
app.use("/api/trains", trainRoutes);
app.use("/api/journeys", journeyRoutes);
app.use("/api/bookings", bookingRoutes);
app.use(
  "/api/attendance",
  attendanceRoutes
);

app.use("/api/tte", tteRoutes);


app.use(
  "/api/verification",
  verificationRoutes
);


app.use("/api/admin", adminRoutes);
module.exports = app;