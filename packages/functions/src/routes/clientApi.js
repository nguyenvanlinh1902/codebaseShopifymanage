import Router from 'koa-router';
import * as clientApiController from '../controllers/clientApi/clientApiController';

const router = new Router({
  prefix: '/clientApi'
});

// Add your client API routes here
// Example: router.get('/data', clientApiController.getData);
router.get('/health', clientApiController.health);

export default router;
