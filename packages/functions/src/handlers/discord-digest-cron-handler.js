import {DiscordScheduleRepository} from '../repositories/discord-schedule-repository.js';
import {DiscordDigestService, calculateNextRun} from '../services/discord-digest-service.js';

const LOG_PREFIX = '[DiscordDigest:Cron]';

/**
 * Scheduled entrypoint — runs every few minutes.
 * For each enabled schedule whose nextRunAt <= now, execute digest then
 * update lastRunStats + nextRunAt.
 */
export async function processDiscordDigest() {
  const scheduleRepo = new DiscordScheduleRepository();
  const digestService = new DiscordDigestService();
  const now = new Date();

  const due = await scheduleRepo.listDue(now);
  if (due.length === 0) {
    console.log(`${LOG_PREFIX} No due schedules.`);
    return;
  }

  console.log(`${LOG_PREFIX} ${due.length} due schedule(s).`);

  for (const schedule of due) {
    try {
      console.log(`${LOG_PREFIX} Running store=${schedule.storeId}`);
      const stats = await digestService.runForStore(schedule.storeId);
      const nextRun = calculateNextRun(schedule.intervalHours, now);
      await scheduleRepo.updateRunStats(schedule.storeId, {
        lastRunAt: now.toISOString(),
        nextRunAt: nextRun.toISOString(),
        lastRunStats: stats
      });
      console.log(
        `${LOG_PREFIX} store=${schedule.storeId} sent=${stats.sent} failed=${stats.failed} skipped=${stats.skipped}`
      );
    } catch (err) {
      console.error(`${LOG_PREFIX} store=${schedule.storeId} error:`, err.message);
      const nextRun = calculateNextRun(schedule.intervalHours, now);
      await scheduleRepo
        .updateRunStats(schedule.storeId, {
          lastRunAt: now.toISOString(),
          nextRunAt: nextRun.toISOString(),
          lastRunStats: {sent: 0, failed: 0, skipped: 0, error: err.message}
        })
        .catch(() => {});
    }
  }
}
