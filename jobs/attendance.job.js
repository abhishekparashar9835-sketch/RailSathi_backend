const cron = require("node-cron");

const {
  processExpiredAttendances,
} = require("../services/attendanceProcessor.service");


/*
 * ============================================================
 * ATTENDANCE BACKGROUND JOB
 * ============================================================
 *
 * TESTING:
 *
 * ATTENDANCE_JOB_INTERVAL_SECONDS=10
 *
 * PRODUCTION:
 *
 * ATTENDANCE_JOB_INTERVAL_SECONDS=60
 *
 */


const startAttendanceJob = () => {

  const intervalSeconds = Number(
    process.env.ATTENDANCE_JOB_INTERVAL_SECONDS || 60
  );


  /*
   * ----------------------------------------------------------
   * Validate interval
   * ----------------------------------------------------------
   */

  if (
    !Number.isInteger(intervalSeconds) ||
    intervalSeconds < 1 ||
    intervalSeconds > 59
  ) {
    throw new Error(
      "ATTENDANCE_JOB_INTERVAL_SECONDS must be between 1 and 59"
    );
  }

   

  const cronExpression =
    `*/${intervalSeconds} * * * * *`;


  console.log(
    "=========================================="
  );

  console.log(
    "ATTENDANCE BACKGROUND JOB STARTED"
  );

  console.log(
    `Checking every ${intervalSeconds} seconds`
  );

  console.log(
    "Cron:",
    cronExpression
  );

  console.log(
    "=========================================="
  );


  cron.schedule(
    cronExpression,
    async () => {

      try {

        console.log(
          "\n[ATTENDANCE JOB] Checking expired attendance..."
        );


        const result =
          await processExpiredAttendances();


        if (
          result.processedCount > 0
        ) {

          console.log(
            `[ATTENDANCE JOB] Processed ${result.processedCount} journey(s)`
          );


          for (
            const item of result.results
          ) {

            if (item.success) {

              console.log(
                `[ATTENDANCE JOB] Journey ${item.journeyId} processed successfully`
              );

              console.log(
                "[ATTENDANCE JOB RESULT]:",
                item.result
              );

            } else {

              console.error(
                `[ATTENDANCE JOB] Journey ${item.journeyId} failed: ${item.message}`
              );

            }
          }

        } else {

          console.log(
            "[ATTENDANCE JOB] No expired attendance found"
          );

        }

      } catch (error) {

        console.error(
          "[ATTENDANCE JOB ERROR]:",
          error
        );

      }

    },
    {
      scheduled: true,
      timezone: "Asia/Kolkata",
    }
  );
}


module.exports = {
  startAttendanceJob,
};