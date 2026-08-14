const dotenv = require("dotenv");
dotenv.config();

const app = require("./app");
const connectDB = require("./config/db");

const {
  startAttendanceJob,
} = require("./jobs/attendance.job");

connectDB();
startAttendanceJob();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚆 RailSathi Server Running on Port ${PORT}`);
});