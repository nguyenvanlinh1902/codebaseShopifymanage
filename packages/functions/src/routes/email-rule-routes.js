import {Router} from 'express';
import {
  listRules, getRule, createRule, updateRule, deleteRule, toggleRule
} from '../controllers/email-rules/rule-crud-handler.js';

const router = new Router();

router.get('/rules', listRules);
router.get('/rules/:ruleId', getRule);
router.post('/rules', createRule);
router.put('/rules/:ruleId', updateRule);
router.delete('/rules/:ruleId', deleteRule);
router.post('/rules/:ruleId/toggle', toggleRule);

export default router;
