import {EmailRuleRepository} from '../repositories/email-rule-repository.js';
import {StoreRepository} from '../repositories/storeRepository.js';

const MAX_REGEX_LENGTH = 200;

/**
 * Email Rule Service — evaluates filter rules against incoming emails
 * Default: forward all. Rules define exceptions (forward or ignore).
 */
export class EmailRuleService {
  constructor(rules) {
    this._rules = rules;
  }

  /**
   * Factory: load rules for a store
   */
  static async createForStore(storeId) {
    const repo = new EmailRuleRepository();
    const rules = await repo.getAllByStoreId(storeId);
    return new EmailRuleService(rules);
  }

  /**
   * Factory: load unioned rules for all stores in a group.
   * Sorted by priority ASC so first-match semantics still hold. Store ordering
   * in the group breaks priority ties (stable enough for YAGNI).
   */
  static async createForGroup(groupId) {
    const storeRepo = new StoreRepository();
    const ruleRepo = new EmailRuleRepository();
    const stores = await storeRepo.getByGroupId(groupId);
    if (stores.length === 0) return new EmailRuleService([]);

    const ruleArrays = await Promise.all(
      stores.map(s => ruleRepo.getAllByStoreId(s.id))
    );
    const merged = ruleArrays.flat();
    merged.sort((a, b) => (a.priority ?? 1000) - (b.priority ?? 1000));
    return new EmailRuleService(merged);
  }

  /**
   * Evaluate email against rules
   * @returns {'forward' | 'ignore'}
   */
  evaluate(emailData) {
    const enabledRules = this._rules.filter(r => r.enabled);

    // No rules or all disabled = forward all
    if (enabledRules.length === 0) return 'forward';

    // First matching rule wins (sorted by priority)
    for (const rule of enabledRules) {
      if (this._matchesRule(rule, emailData)) {
        return rule.action || 'forward';
      }
    }

    // No rule matched = forward by default
    return 'forward';
  }

  _matchesRule(rule, emailData) {
    const conditions = rule.conditions || [];
    if (conditions.length === 0) return false;

    const logic = rule.conditionLogic || 'all';
    const results = conditions.map(c => this._matchesCondition(c, emailData));

    return logic === 'all'
      ? results.every(Boolean)
      : results.some(Boolean);
  }

  _matchesCondition(condition, emailData) {
    const {field, operator, value} = condition;
    if (!value) return false;

    let target;
    switch (field) {
      case 'from':
        target = emailData.from || '';
        break;
      case 'subject':
        target = emailData.subject || '';
        break;
      case 'label':
        // For labels, check if value is in the labels array
        return (emailData.labels || []).some(l =>
          l.toLowerCase() === value.toLowerCase()
        );
      default:
        return false;
    }

    return this._applyOperator(operator, target, value);
  }

  _applyOperator(operator, target, value) {
    const t = target.toLowerCase();
    const v = value.toLowerCase();

    switch (operator) {
      case 'equals':
        return t === v;
      case 'contains':
        return t.includes(v);
      case 'startsWith':
        return t.startsWith(v);
      case 'regex':
        if (value.length > MAX_REGEX_LENGTH) return false;
        try {
          return new RegExp(value, 'i').test(target);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }
}
