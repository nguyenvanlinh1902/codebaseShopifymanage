import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EmailRuleService} from '../../services/email-rule-service.js';

test('evaluate: no rules → forward', () => {
  const svc = new EmailRuleService([]);
  assert.equal(svc.evaluate({from: 'a@b.com', subject: 'hi'}), 'forward');
});

test('evaluate: matched rule action wins', () => {
  const svc = new EmailRuleService([
    {
      enabled: true,
      priority: 1,
      action: 'ignore',
      conditions: [{field: 'from', operator: 'contains', value: 'spam'}],
      conditionLogic: 'all'
    }
  ]);
  assert.equal(svc.evaluate({from: 'spam@bad.com', subject: 'x'}), 'ignore');
  assert.equal(svc.evaluate({from: 'ok@ok.com', subject: 'x'}), 'forward');
});

test('evaluate: lowest priority number evaluated first (first match wins)', () => {
  // Simulates the union returned by createForGroup: two stores, conflicting rules.
  const svc = new EmailRuleService([
    {
      enabled: true,
      priority: 5,
      action: 'forward',
      conditions: [{field: 'from', operator: 'equals', value: 'x@y.com'}],
      conditionLogic: 'all'
    },
    {
      enabled: true,
      priority: 1,
      action: 'ignore',
      conditions: [{field: 'from', operator: 'equals', value: 'x@y.com'}],
      conditionLogic: 'all'
    }
  ].sort((a, b) => a.priority - b.priority));
  // priority=1 (ignore) evaluated first → ignore wins.
  assert.equal(svc.evaluate({from: 'x@y.com', subject: 's'}), 'ignore');
});

test('evaluate: disabled rules are skipped', () => {
  const svc = new EmailRuleService([
    {
      enabled: false,
      priority: 1,
      action: 'ignore',
      conditions: [{field: 'from', operator: 'equals', value: 'x@y.com'}],
      conditionLogic: 'all'
    }
  ]);
  assert.equal(svc.evaluate({from: 'x@y.com', subject: 's'}), 'forward');
});

test('evaluate: "any" logic requires at least one matching condition', () => {
  const svc = new EmailRuleService([
    {
      enabled: true,
      priority: 1,
      action: 'ignore',
      conditions: [
        {field: 'subject', operator: 'contains', value: 'invoice'},
        {field: 'from', operator: 'contains', value: 'noreply'}
      ],
      conditionLogic: 'any'
    }
  ]);
  assert.equal(svc.evaluate({from: 'noreply@co.com', subject: 'hello'}), 'ignore');
  assert.equal(svc.evaluate({from: 'a@b.com', subject: 'invoice pls'}), 'ignore');
  assert.equal(svc.evaluate({from: 'a@b.com', subject: 'hello'}), 'forward');
});
