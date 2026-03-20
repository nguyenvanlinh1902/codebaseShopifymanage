import {EmailRuleRepository} from '../../repositories/email-rule-repository.js';

const ruleRepo = new EmailRuleRepository();

const VALID_FIELDS = ['from', 'subject', 'label'];
const VALID_OPERATORS = ['equals', 'contains', 'startsWith', 'regex'];
const VALID_ACTIONS = ['forward', 'ignore'];
const VALID_LOGIC = ['all', 'any'];

function validateRule(body) {
  const errors = [];
  if (!body.name || typeof body.name !== 'string' || body.name.length > 100) {
    errors.push('name is required (max 100 chars)');
  }
  if (!Array.isArray(body.conditions) || body.conditions.length === 0) {
    errors.push('conditions must be a non-empty array');
  } else {
    for (const c of body.conditions) {
      if (!VALID_FIELDS.includes(c.field)) errors.push(`Invalid field: ${c.field}`);
      if (!VALID_OPERATORS.includes(c.operator)) errors.push(`Invalid operator: ${c.operator}`);
      if (!c.value || typeof c.value !== 'string') errors.push('condition value is required');
    }
  }
  if (body.conditionLogic && !VALID_LOGIC.includes(body.conditionLogic)) {
    errors.push('conditionLogic must be all or any');
  }
  if (body.action && !VALID_ACTIONS.includes(body.action)) {
    errors.push('action must be forward or ignore');
  }
  return errors;
}

/** GET /rules */
export async function listRules(req, res) {
  try {
    const rules = await ruleRepo.getAllByStoreId((req.query.storeId || req.body?.storeId || 'default'));
    return res.json({success: true, data: rules});
  } catch (error) {
    console.error('[EmailRules:List] Error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/** GET /rules/:ruleId */
export async function getRule(req, res) {
  try {
    const rule = await ruleRepo.getById((req.query.storeId || req.body?.storeId || 'default'), req.params.ruleId);
    if (!rule) return res.status(404).json({success: false, error: 'Rule not found'});
    return res.json({success: true, data: rule});
  } catch (error) {
    console.error('[EmailRules:Get] Error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/** POST /rules */
export async function createRule(req, res) {
  try {
    const errors = validateRule(req.body);
    if (errors.length > 0) {
      return res.status(400).json({success: false, error: errors.join('; ')});
    }
    const {name, conditions, conditionLogic = 'all', action = 'forward', priority = 0} = req.body;
    const rule = await ruleRepo.create((req.query.storeId || req.body?.storeId || 'default'), {
      name, conditions, conditionLogic, action, priority
    });
    return res.status(201).json({success: true, data: rule});
  } catch (error) {
    console.error('[EmailRules:Create] Error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/** PUT /rules/:ruleId */
export async function updateRule(req, res) {
  try {
    const errors = validateRule(req.body);
    if (errors.length > 0) {
      return res.status(400).json({success: false, error: errors.join('; ')});
    }
    const {name, conditions, conditionLogic, action, priority} = req.body;
    const rule = await ruleRepo.update((req.query.storeId || req.body?.storeId || 'default'), req.params.ruleId, {
      name, conditions, conditionLogic, action, priority
    });
    if (!rule) return res.status(404).json({success: false, error: 'Rule not found'});
    return res.json({success: true, data: rule});
  } catch (error) {
    console.error('[EmailRules:Update] Error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/** DELETE /rules/:ruleId */
export async function deleteRule(req, res) {
  try {
    const deleted = await ruleRepo.delete((req.query.storeId || req.body?.storeId || 'default'), req.params.ruleId);
    if (!deleted) return res.status(404).json({success: false, error: 'Rule not found'});
    return res.json({success: true, data: {message: 'Rule deleted'}});
  } catch (error) {
    console.error('[EmailRules:Delete] Error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/** POST /rules/:ruleId/toggle */
export async function toggleRule(req, res) {
  try {
    const rule = await ruleRepo.toggleEnabled((req.query.storeId || req.body?.storeId || 'default'), req.params.ruleId);
    if (!rule) return res.status(404).json({success: false, error: 'Rule not found'});
    return res.json({success: true, data: rule});
  } catch (error) {
    console.error('[EmailRules:Toggle] Error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}
