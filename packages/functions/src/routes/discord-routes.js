import {Router} from 'express';
import {getConfig, upsertConfig, deleteConfig} from '../controllers/discord/discord-config-handler.js';
import {testConnection} from '../controllers/discord/discord-test-handler.js';

const router = new Router();

router.get('/config', getConfig);
router.post('/config', upsertConfig);
router.delete('/config', deleteConfig);
router.post('/test', testConnection);

export default router;
