/**
 * Daily scheduled task handler
 * Runs every day at midnight UTC (0 0 * * *)
 *
 * Usage:
 *   Add your daily tasks in the handler below.
 *   All tasks run in parallel for efficiency.
 *
 * Examples:
 *   - Clean up expired data
 *   - Send daily reports
 *   - Sync data with external services
 *   - Reset daily counters
 *
 * @param event - Scheduled event
 * @returns {Promise<void>}
 */
export default async function dailyCron(event) {
  console.log('Daily cron started at:', new Date().toISOString());

  try {
    await Promise.all([
      // Add your daily tasks here
      // cleanExpiredData(),
      // sendDailyReports(),
      // syncExternalData(),
      sampleTask()
    ]);

    console.log('Daily cron completed successfully');
  } catch (e) {
    console.error('Daily cron error:', e);
    throw e;
  }
}

/**
 * Sample task - remove this and add your own tasks
 */
async function sampleTask() {
  console.log('Running sample daily task...');
  // TODO: Implement your daily task logic
}
