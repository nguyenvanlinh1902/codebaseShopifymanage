import {OrderLimitRepository} from '../repositories/order-limit-repository.js';
import {manualReset} from '../services/order-limit-service.js';

const repo = new OrderLimitRepository();

/** GET /order-limits */
export async function listOrderLimits(req, res) {
  try {
    const rules = await repo.listRules();
    res.json({success: true, data: rules});
  } catch (err) {
    console.error('[OrderLimit] listOrderLimits error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/** POST /order-limits */
export async function createOrderLimit(req, res) {
  try {
    const {shopDomain, dailyLimit, totalLimit, timezone, normalTemplateId, highPriceTemplateId} = req.body;
    if (!shopDomain || !dailyLimit || !timezone || !normalTemplateId || !highPriceTemplateId) {
      return res.status(400).json({success: false, error: 'All fields required: shopDomain, dailyLimit, timezone, normalTemplateId, highPriceTemplateId'});
    }
    if (!Number.isInteger(dailyLimit) || dailyLimit <= 0) {
      return res.status(400).json({success: false, error: 'dailyLimit must be a positive integer'});
    }
    // Validate timezone
    try {
      Intl.DateTimeFormat(undefined, {timeZone: timezone});
    } catch {
      return res.status(400).json({success: false, error: `Invalid timezone: ${timezone}`});
    }
    // Check duplicate
    const existing = await repo.getRuleByShopDomain(shopDomain);
    if (existing) {
      return res.status(409).json({success: false, error: `An enabled rule already exists for ${shopDomain}`});
    }

    const parsedTotalLimit = totalLimit ? parseInt(totalLimit, 10) : 0;
    if (parsedTotalLimit < 0) {
      return res.status(400).json({success: false, error: 'totalLimit must be a non-negative integer'});
    }
    const rule = await repo.createRule({shopDomain, dailyLimit, totalLimit: parsedTotalLimit, timezone, normalTemplateId, highPriceTemplateId});
    res.status(201).json({success: true, data: rule});
  } catch (err) {
    console.error('[OrderLimit] createOrderLimit error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/** PATCH /order-limits/:id */
export async function updateOrderLimit(req, res) {
  try {
    const {dailyLimit, totalLimit, timezone, normalTemplateId, highPriceTemplateId} = req.body;
    const updates = {};
    if (dailyLimit !== undefined) {
      if (!Number.isInteger(dailyLimit) || dailyLimit <= 0) {
        return res.status(400).json({success: false, error: 'dailyLimit must be a positive integer'});
      }
      updates.dailyLimit = dailyLimit;
    }
    if (totalLimit !== undefined) {
      const parsed = parseInt(totalLimit, 10);
      if (isNaN(parsed) || parsed < 0) {
        return res.status(400).json({success: false, error: 'totalLimit must be a non-negative integer'});
      }
      updates.totalLimit = parsed;
    }
    if (timezone !== undefined) {
      try {
        Intl.DateTimeFormat(undefined, {timeZone: timezone});
      } catch {
        return res.status(400).json({success: false, error: `Invalid timezone: ${timezone}`});
      }
      updates.timezone = timezone;
    }
    if (normalTemplateId !== undefined) updates.normalTemplateId = normalTemplateId;
    if (highPriceTemplateId !== undefined) updates.highPriceTemplateId = highPriceTemplateId;

    await repo.updateRule(req.params.id, updates);
    res.json({success: true});
  } catch (err) {
    console.error('[OrderLimit] updateOrderLimit error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/** DELETE /order-limits/:id */
export async function deleteOrderLimit(req, res) {
  try {
    await repo.deleteRule(req.params.id);
    res.json({success: true});
  } catch (err) {
    console.error('[OrderLimit] deleteOrderLimit error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/** POST /order-limits/:id/reset */
export async function resetOrderLimit(req, res) {
  try {
    const result = await manualReset(req.params.id);
    res.json({success: true, data: result});
  } catch (err) {
    console.error('[OrderLimit] resetOrderLimit error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}

/** POST /order-limits/:id/toggle */
export async function toggleOrderLimit(req, res) {
  try {
    const rule = await repo.getRule(req.params.id);
    if (!rule) return res.status(404).json({success: false, error: 'Rule not found'});

    const newEnabled = !rule.enabled;
    await repo.updateRule(req.params.id, {enabled: newEnabled});

    // If disabling and currently limited, apply normal template
    if (!newEnabled && rule.isLimited) {
      const {applyTemplateToStore} = await import('../services/order-limit-service.js');
      // Dynamic import avoided — use manualReset instead for clean reset
      await manualReset(req.params.id);
    }

    res.json({success: true, data: {enabled: newEnabled}});
  } catch (err) {
    console.error('[OrderLimit] toggleOrderLimit error:', err.message);
    res.status(500).json({success: false, error: err.message});
  }
}
