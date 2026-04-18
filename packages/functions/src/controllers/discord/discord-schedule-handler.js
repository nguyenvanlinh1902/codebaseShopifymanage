import {DiscordScheduleRepository} from '../../repositories/discord-schedule-repository.js';
import {DiscordSentEmailRepository} from '../../repositories/discord-sent-email-repository.js';
import {DiscordDigestService, calculateNextRun} from '../../services/discord-digest-service.js';

const VALID_INTERVALS = [0.0167, 0.0833, 0.25, 0.5, 1, 2, 3, 4, 6, 8, 12, 24];
const scheduleRepo = new DiscordScheduleRepository();
const sentRepo = new DiscordSentEmailRepository();

function resolveStoreId(req) {
  return req.query.storeId || req.body?.storeId || 'default';
}

/** GET /api/discord/schedule?storeId=... */
export async function getSchedule(req, res) {
  try {
    const storeId = resolveStoreId(req);
    const schedule = await scheduleRepo.getByStoreId(storeId);
    return res.json({success: true, data: schedule});
  } catch (err) {
    console.error('[Discord:Schedule:Get]', err.message);
    return res.status(500).json({success: false, error: err.message});
  }
}

/** PUT /api/discord/schedule */
export async function upsertSchedule(req, res) {
  try {
    const storeId = resolveStoreId(req);
    const {enabled, intervalHours, sourceAccounts} = req.body || {};

    const interval = Number(intervalHours);
    if (!VALID_INTERVALS.some(v => Math.abs(v - interval) < 0.001)) {
      return res.status(400).json({
        success: false,
        error: `intervalHours must be one of ${VALID_INTERVALS.join(', ')}`
      });
    }

    const now = new Date();
    const nextRunAt = calculateNextRun(interval, now).toISOString();

    const payload = {
      enabled: !!enabled,
      intervalHours: interval,
      sourceAccounts: Array.isArray(sourceAccounts) ? sourceAccounts : [],
      timezone: 'Asia/Ho_Chi_Minh',
      nextRunAt
    };

    const saved = await scheduleRepo.upsert(storeId, payload);
    return res.json({success: true, data: saved});
  } catch (err) {
    console.error('[Discord:Schedule:Upsert]', err.message);
    return res.status(500).json({success: false, error: err.message});
  }
}

/** POST /api/discord/schedule/run-now */
export async function runScheduleNow(req, res) {
  try {
    const storeId = resolveStoreId(req);
    const {sourceAccounts, testChannelId} = req.body || {};
    const service = new DiscordDigestService();
    const stats = await service.runForStore(storeId, {sourceAccounts, testChannelId, force: true});

    const schedule = await scheduleRepo.getByStoreId(storeId);
    if (schedule?.enabled) {
      const now = new Date();
      await scheduleRepo.updateRunStats(storeId, {
        lastRunAt: now.toISOString(),
        nextRunAt: calculateNextRun(schedule.intervalHours, now).toISOString(),
        lastRunStats: stats
      });
    }

    return res.json({success: true, data: stats});
  } catch (err) {
    console.error('[Discord:Schedule:RunNow]', err.message);
    return res.status(500).json({success: false, error: err.message});
  }
}

/** GET /api/discord/sent-emails?storeId=&limit=&from=&to=&after= */
export async function listSentEmails(req, res) {
  try {
    const storeId = resolveStoreId(req);
    const limit = Math.min(Number(req.query.limit) || 20, 200);
    const {from, to, after} = req.query;
    const emails = await sentRepo.listRecent(storeId, {limit, from, to, after});
    const hasMore = emails.length === limit;
    const nextCursor = hasMore ? emails[emails.length - 1].sentAt : null;
    return res.json({success: true, data: emails, hasMore, nextCursor});
  } catch (err) {
    console.error('[Discord:Schedule:ListSent]', err.message);
    return res.status(500).json({success: false, error: err.message});
  }
}

/** DELETE /api/discord/schedule */
export async function deleteSchedule(req, res) {
  try {
    const storeId = resolveStoreId(req);
    await scheduleRepo.delete(storeId);
    return res.json({success: true});
  } catch (err) {
    console.error('[Discord:Schedule:Delete]', err.message);
    return res.status(500).json({success: false, error: err.message});
  }
}
