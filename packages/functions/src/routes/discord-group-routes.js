import {Router} from 'express';
import {
  listGroupsWithDiscord,
  getGroupConfig,
  upsertGroupConfig,
  deleteGroupConfig,
  testGroupConnection
} from '../controllers/discord/discord-group-config-handler.js';
import {
  getGroupSchedule,
  upsertGroupSchedule,
  runGroupScheduleNow
} from '../controllers/discord/discord-group-schedule-handler.js';
import {
  listGroupLinkedEmails,
  setGroupLinkedEmails
} from '../controllers/discord/discord-group-linked-emails-handler.js';
import {listGroupHistory} from '../controllers/discord/discord-group-history-handler.js';
import {
  getGlobalConfig,
  upsertGlobalConfig,
  deleteGlobalConfig,
  adoptGlobalConfigFromGroup
} from '../controllers/discord/discord-global-config-handler.js';

const router = new Router();

// Global bot token (shared across all groups).
router.get('/global-config', getGlobalConfig);
router.put('/global-config', upsertGlobalConfig);
router.delete('/global-config', deleteGlobalConfig);
router.post('/global-config/adopt-from-group/:groupId', adoptGlobalConfigFromGroup);

router.get('/', listGroupsWithDiscord);

router.get('/:groupId/config', getGroupConfig);
router.put('/:groupId/config', upsertGroupConfig);
router.delete('/:groupId/config', deleteGroupConfig);
router.post('/:groupId/test', testGroupConnection);

router.get('/:groupId/schedule', getGroupSchedule);
router.put('/:groupId/schedule', upsertGroupSchedule);
router.post('/:groupId/schedule/run-now', runGroupScheduleNow);

router.get('/:groupId/linked-emails', listGroupLinkedEmails);
router.put('/:groupId/linked-emails', setGroupLinkedEmails);

router.get('/:groupId/history', listGroupHistory);

export default router;
