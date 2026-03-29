import {OrderLimitRepository} from '../repositories/order-limit-repository.js';
import {ShippingTemplateRepository} from '../repositories/shipping-template-repository.js';
import {StoreRepository} from '../repositories/storeRepository.js';
import {ShopifyService} from './shopifyService.js';
import {getDeliveryProfiles, replaceDeliveryProfileRates} from './shopify-shipping-service.js';

const orderLimitRepo = new OrderLimitRepository();
const templateRepo = new ShippingTemplateRepository();
const storeRepo = new StoreRepository();

/** Get today's date string in a timezone (YYYY-MM-DD) */
function getTodayInTimezone(tz) {
  return new Intl.DateTimeFormat('en-CA', {timeZone: tz}).format(new Date());
}

/** Apply a shipping template to a store */
async function applyTemplateToStore(shopDomain, templateId, label) {
  const store = await storeRepo.getByShopDomain(shopDomain);
  if (!store || !store.accessToken) {
    throw new Error(`Store not found or missing access token: ${shopDomain}`);
  }
  const template = await templateRepo.getTemplate(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }
  const shopify = new ShopifyService(store);
  const liveProfiles = await getDeliveryProfiles(shopify);
  const result = await replaceDeliveryProfileRates(shopify, template.profiles, liveProfiles);
  console.log(`[OrderLimit] Applied ${label} template to ${shopDomain}:`, result);
  return result;
}

/**
 * Called from webhook: increment order count, apply high-price template if limit reached
 */
export async function checkAndIncrementOrderCount(shopDomain) {
  const rule = await orderLimitRepo.getRuleByShopDomain(shopDomain);
  if (!rule) return null;

  // Handle date rollover (missed cron safety net)
  const todayStr = getTodayInTimezone(rule.timezone);
  if (rule.currentDate !== todayStr) {
    await orderLimitRepo.resetRule(rule.id, todayStr);
    if (rule.isLimited) {
      try {
        await applyTemplateToStore(shopDomain, rule.normalTemplateId, 'normal');
        await orderLimitRepo.updateRule(rule.id, {lastAppliedTemplate: 'normal'});
      } catch (err) {
        console.error('[OrderLimit] Reset template apply failed:', err.message);
      }
    }
  }

  // Increment count
  const updated = await orderLimitRepo.incrementCount(rule.id);
  const newCount = updated.currentCount;

  // Check if daily limit just reached
  if (newCount >= rule.dailyLimit && !updated.isLimited) {
    try {
      await applyTemplateToStore(shopDomain, rule.highPriceTemplateId, 'highPrice');
      await orderLimitRepo.updateRule(rule.id, {isLimited: true, lastAppliedTemplate: 'highPrice'});
      console.log(`[OrderLimit] ${shopDomain} hit daily limit (${newCount}/${rule.dailyLimit}), applied high-price template`);
    } catch (err) {
      console.error('[OrderLimit] High-price template apply failed:', err.message);
    }
  }

  // Check if total limit reached → apply high-price template + auto-disable rule
  const totalCount = updated.totalCount || 0;
  const totalLimit = rule.totalLimit || 0;
  if (totalLimit > 0 && totalCount >= totalLimit) {
    try {
      // Apply high-price template if not already limited
      if (!updated.isLimited) {
        await applyTemplateToStore(shopDomain, rule.highPriceTemplateId, 'highPrice');
        await orderLimitRepo.updateRule(rule.id, {isLimited: true, lastAppliedTemplate: 'highPrice'});
      }
      await orderLimitRepo.updateRule(rule.id, {enabled: false});
      console.log(`[OrderLimit] ${shopDomain} hit total limit (${totalCount}/${totalLimit}), applied high-price template & rule auto-disabled`);
    } catch (err) {
      console.error('[OrderLimit] Total limit action failed:', err.message);
    }
  }

  return {counted: true, newCount, totalCount, limited: updated.isLimited || newCount >= rule.dailyLimit};
}

/**
 * Cron: reset counters for all enabled rules where date has changed
 */
export async function resetDailyCounters() {
  const rules = await orderLimitRepo.getEnabledRules();
  const results = await Promise.allSettled(
    rules.map(async rule => {
      const todayStr = getTodayInTimezone(rule.timezone);
      if (rule.currentDate === todayStr) return {id: rule.id, action: 'skip'};

      await orderLimitRepo.resetRule(rule.id, todayStr);
      if (rule.isLimited) {
        await applyTemplateToStore(rule.shopDomain, rule.normalTemplateId, 'normal');
        await orderLimitRepo.updateRule(rule.id, {lastAppliedTemplate: 'normal'});
      }
      return {id: rule.id, shopDomain: rule.shopDomain, action: 'reset'};
    })
  );

  const summary = {total: rules.length, reset: 0, skipped: 0, failed: 0};
  for (const r of results) {
    if (r.status === 'rejected') summary.failed++;
    else if (r.value.action === 'reset') summary.reset++;
    else summary.skipped++;
  }
  return summary;
}

/**
 * Manual reset: reset count and re-apply normal template
 */
export async function manualReset(ruleId) {
  const rule = await orderLimitRepo.getRule(ruleId);
  if (!rule) throw new Error('Rule not found');

  const todayStr = getTodayInTimezone(rule.timezone);
  await orderLimitRepo.resetRule(ruleId, todayStr);

  if (rule.isLimited) {
    await applyTemplateToStore(rule.shopDomain, rule.normalTemplateId, 'normal');
    await orderLimitRepo.updateRule(ruleId, {lastAppliedTemplate: 'normal'});
  }

  return {reset: true, shopDomain: rule.shopDomain};
}
