import {DiscordGroupScheduleRepository} from '../../repositories/discord-group-schedule-repository.js';
import {DiscordDigestService, calculateNextRun} from '../../services/discord-digest-service.js';

const scheduleRepo = new DiscordGroupScheduleRepository();

/** GET /api/discord/groups/:groupId/schedule */
export async function getGroupSchedule(req, res) {
  try {
    const schedule = await scheduleRepo.getByGroupId(req.params.groupId);
    return res.json({success: true, data: schedule});
  } catch (error) {
    console.error('[Discord:GroupSchedule:Get]', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/** PUT /api/discord/groups/:groupId/schedule — admin only */
export async function upsertGroupSchedule(req, res) {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({success: false, error: 'Forbidden: admin only'});
    }
    const {groupId} = req.params;
    const {enabled, intervalHours, sourceAccounts} = req.body;

    if (intervalHours !== undefined && (typeof intervalHours !== 'number' || intervalHours <= 0)) {
      return res.status(400).json({success: false, error: 'intervalHours must be a positive number'});
    }

    const existing = await scheduleRepo.getByGroupId(groupId);
    const now = new Date();
    const hours = intervalHours ?? existing?.intervalHours ?? 24;

    const payload = {
      enabled: enabled === undefined ? !!existing?.enabled : !!enabled,
      intervalHours: hours,
      sourceAccounts: Array.isArray(sourceAccounts) ? sourceAccounts : (existing?.sourceAccounts || [])
    };

    // (Re)compute nextRunAt when enabling or when interval changes.
    if (payload.enabled) {
      const fromDate = existing?.nextRunAt ? new Date(existing.nextRunAt) : now;
      payload.nextRunAt = calculateNextRun(hours, fromDate).toISOString();
    } else {
      payload.nextRunAt = null;
    }

    const saved = await scheduleRepo.upsert(groupId, payload);
    return res.json({success: true, data: saved});
  } catch (error) {
    console.error('[Discord:GroupSchedule:Upsert]', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/** POST /api/discord/groups/:groupId/schedule/run-now — admin only */
export async function runGroupScheduleNow(req, res) {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({success: false, error: 'Forbidden: admin only'});
    }
    const {groupId} = req.params;
    const digestService = new DiscordDigestService();
    const stats = await digestService.runForGroup(groupId, {force: true});

    const existing = await scheduleRepo.getByGroupId(groupId);
    const now = new Date();
    if (existing) {
      const hours = existing.intervalHours || 24;
      await scheduleRepo.updateRunStats(groupId, {
        lastRunAt: now.toISOString(),
        nextRunAt: existing.enabled
          ? calculateNextRun(hours, now).toISOString()
          : existing.nextRunAt || null,
        lastRunStats: stats
      });
    }

    return res.json({success: true, data: stats});
  } catch (error) {
    console.error('[Discord:GroupSchedule:RunNow]', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}
