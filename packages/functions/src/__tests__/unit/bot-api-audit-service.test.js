import {test, beforeEach, mock} from 'node:test';
import assert from 'node:assert/strict';

/**
 * We can't easily swap the repository in ESM without a DI container,
 * so we monkey-patch the service's internal sampler map via the exported reset
 * and rely on sampling behaviour being observable through the SAME repo module.
 * The audit-log repo's `append` is wrapped in a try/catch inside the service,
 * so calling it without Firestore initialised will simply log a warning — we
 * focus the test on the SAMPLING windowing, which is the real business logic.
 */
import {logUsedSampled, _resetAuditSampler} from '../../services/bot-api-audit-service.js';
import * as repoModule from '../../repositories/bot-api-audit-log-repository.js';

beforeEach(() => _resetAuditSampler());

test('logUsedSampled only writes one event per 5-minute window per key', async t => {
  const originalProto = repoModule.BotApiAuditLogRepository.prototype.append;
  const appendMock = mock.fn(async () => {});
  repoModule.BotApiAuditLogRepository.prototype.append = appendMock;
  t.after(() => {
    repoModule.BotApiAuditLogRepository.prototype.append = originalProto;
  });

  await logUsedSampled({keyPrefix: 'abc', userId: 'u', ip: '1.1.1.1', path: '/api/orders', method: 'GET'});
  await logUsedSampled({keyPrefix: 'abc', userId: 'u', ip: '1.1.1.1', path: '/api/orders', method: 'GET'});
  await logUsedSampled({keyPrefix: 'abc', userId: 'u', ip: '1.1.1.1', path: '/api/orders', method: 'GET'});

  // Only the first call triggers a write; the rest are sampled out.
  assert.equal(appendMock.mock.callCount(), 1);
});

test('different keys get independent sampling windows', async t => {
  const originalProto = repoModule.BotApiAuditLogRepository.prototype.append;
  const appendMock = mock.fn(async () => {});
  repoModule.BotApiAuditLogRepository.prototype.append = appendMock;
  t.after(() => {
    repoModule.BotApiAuditLogRepository.prototype.append = originalProto;
  });

  await logUsedSampled({keyPrefix: 'k1', userId: 'u'});
  await logUsedSampled({keyPrefix: 'k2', userId: 'u'});
  await logUsedSampled({keyPrefix: 'k3', userId: 'u'});

  assert.equal(appendMock.mock.callCount(), 3);
});
