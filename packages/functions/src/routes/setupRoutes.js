import {Router} from 'express';
import * as setupController from '../controllers/setupController.js';

const router = new Router();

router.get('/definitions', setupController.getDefinitions);
router.post('/check', setupController.checkStores);
router.post('/apply', setupController.applySetup);
router.post('/check-policies', setupController.checkPolicies);
router.post('/apply-policies', setupController.applyPolicies);
router.post('/disable-auto-policy', setupController.disableAutoPolicy);
router.post('/check-all', setupController.checkAllSteps);

export default router;
