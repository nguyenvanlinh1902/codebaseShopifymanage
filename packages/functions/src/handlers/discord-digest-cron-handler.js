import {DiscordScheduleRepository} from '../repositories/discord-schedule-repository.js';
import {DiscordGroupScheduleRepository} from '../repositories/discord-group-schedule-repository.js';
import {StoreRepository} from '../repositories/storeRepository.js';
import {DiscordDigestService, calculateNextRun} from '../services/discord-digest-service.js';

const LOG_PREFIX = '[DiscordDigest:Cron]';

/**
 * Scheduled entrypoint — runs every few minutes.
 * Processes BOTH per-group schedules (new primary path) and legacy per-store
 * schedules (feature-flag fallback during rollout). Stores without a group
 * are silently skipped at the resolve layer.
 */
export async function processDiscordDigest() {
  const now = new Date();
  const digestService = new DiscordDigestService();

  await runGroupDigests(digestService, now);
  if (process.env.ENABLE_LEGACY_STORE_DIGEST !== 'false') {
    await runLegacyStoreDigests(digestService, now);
  }
}

async function runGroupDigests(digestService, now) {
  const scheduleRepo = new DiscordGroupScheduleRepository();
  const due = await scheduleRepo.listDue(now);
  if (due.length === 0) {
    console.log(`${LOG_PREFIX} No due group schedules.`);
  } else {
    console.log(`${LOG_PREFIX} ${due.length} due group schedule(s).`);
  }

  for (const schedule of due) {
    try {
      console.log(`${LOG_PREFIX} Running group=${schedule.groupId}`);
      const stats = await digestService.runForGroup(schedule.groupId);
      const nextRun = calculateNextRun(schedule.intervalHours, now);
      await scheduleRepo.updateRunStats(schedule.groupId, {
        lastRunAt: now.toISOString(),
        nextRunAt: nextRun.toISOString(),
        lastRunStats: stats
      });
      console.log(
        `${LOG_PREFIX} group=${schedule.groupId} sent=${stats.sent} failed=${stats.failed} skipped=${stats.skipped}`
      );
    } catch (err) {
      console.error(`${LOG_PREFIX} group=${schedule.groupId} error:`, err.message);
      const nextRun = calculateNextRun(schedule.intervalHours, now);
      await scheduleRepo
        .updateRunStats(schedule.groupId, {
          lastRunAt: now.toISOString(),
          nextRunAt: nextRun.toISOString(),
          lastRunStats: {sent: 0, failed: 0, skipped: 0, error: err.message}
        })
        .catch(() => {});
    }
  }
}

async function runLegacyStoreDigests(digestService, now) {
  const scheduleRepo = new DiscordScheduleRepository();
  const storeRepo = new StoreRepository();
  const due = await scheduleRepo.listDue(now);
  if (due.length === 0) return;

  console.log(`${LOG_PREFIX} ${due.length} due legacy store schedule(s).`);

  for (const schedule of due) {
    try {
      // Stores in a group are handled by runGroupDigests — skip here to avoid
      // double-sending (group + legacy use different claim doc ids).
      const store = await storeRepo.getById(schedule.storeId).catch(() => null);
      if (store?.groupId) {
        console.log(
          `${LOG_PREFIX} Skip legacy store=${schedule.storeId} (group=${store.groupId} handles it)`
        );
        const nextRun = calculateNextRun(schedule.intervalHours, now);
        await scheduleRepo
          .updateRunStats(schedule.storeId, {
            lastRunAt: now.toISOString(),
            nextRunAt: nextRun.toISOString(),
            lastRunStats: {sent: 0, failed: 0, skipped: 0, reason: 'handled-by-group'}
          })
          .catch(() => {});
        continue;
      }

      console.log(`${LOG_PREFIX} Running legacy store=${schedule.storeId}`);
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
