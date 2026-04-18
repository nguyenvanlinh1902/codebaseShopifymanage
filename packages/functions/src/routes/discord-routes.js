import {Router} from 'express';
import {getConfig, upsertConfig, deleteConfig} from '../controllers/discord/discord-config-handler.js';
import {testConnection} from '../controllers/discord/discord-test-handler.js';
import {
  getSchedule,
  upsertSchedule,
  runScheduleNow,
  deleteSchedule,
  listSentEmails
} from '../controllers/discord/discord-schedule-handler.js';

const router = new Router();

router.get('/config', getConfig);
router.post('/config', upsertConfig);
router.delete('/config', deleteConfig);
router.post('/test', testConnection);

router.get('/schedule', getSchedule);
router.put('/schedule', upsertSchedule);
router.delete('/schedule', deleteSchedule);
router.post('/schedule/run-now', runScheduleNow);
router.get('/sent-emails', listSentEmails);

export default router;
