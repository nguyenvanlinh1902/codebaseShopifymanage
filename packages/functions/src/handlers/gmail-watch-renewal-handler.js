import {GmailService} from '../services/gmail-service.js';
import {GoogleAuthRepository} from '../repositories/googleAuthRepository.js';
import {GmailWatchRepository} from '../repositories/gmail-watch-repository.js';

const LOG_PREFIX = '[Gmail:Renewal]';
const BATCH_SIZE = 20;

function pubsubTopic() {
  const project =
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.GCP_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT;
  return `projects/${project}/topics/gmail-notifications`;
}

/**
 * Ensure a Gmail account has an active watch. Starts or renews as needed.
 */
async function ensureWatchForAccount(authRecord, {watchRepo, topic}) {
  const gmailService = GmailService.createFromAuthRecord(authRecord);
  const watchResult = await gmailService.watchMailbox(topic);
  await watchRepo.upsertWatch(authRecord.googleEmail, authRecord.storeId, authRecord.userId, {
    historyId: watchResult.historyId,
    watchExpiration: watchResult.expiration,
    topicName: topic,
    status: 'active',
    lastSyncTime: new Date().toISOString(),
    renewalError: null
  });
}

/**
 * Daily cron: scan ALL connected Gmail accounts and ensure each has an active watch.
 * Covers: accounts whose watch is expiring, accounts whose watch failed to start
 * at connect time, and accounts with no watch record yet.
 */
export async function processWatchRenewal() {
  const watchRepo = new GmailWatchRepository();
  const authRepo = new GoogleAuthRepository();
  const topic = pubsubTopic();

  // 1. Get all Gmail-type auth accounts
  const allAuth = await authRepo.getAll();
  const gmailAccounts = allAuth.filter(
    a => a.authType === 'gmail' || a.scope?.includes('gmail.readonly')
  );
  console.log(`${LOG_PREFIX} Found ${gmailAccounts.length} Gmail accounts to ensure`);

  if (gmailAccounts.length === 0) return {renewed: 0, failed: 0, skipped: 0};

  let renewed = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < gmailAccounts.length; i += BATCH_SIZE) {
    const batch = gmailAccounts.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async authRecord => {
        const existing = await watchRepo.getByEmail(authRecord.googleEmail);
        // Skip if active and not expiring within 48h
        const expiresAt = existing?.watchExpiration
          ? Number(existing.watchExpiration)
          : 0;
        const cutoff = Date.now() + 48 * 60 * 60 * 1000;
        if (existing?.status === 'active' && expiresAt > cutoff) {
          return {email: authRecord.googleEmail, success: true, skipped: true};
        }
        try {
          await ensureWatchForAccount(authRecord, {watchRepo, topic});
          return {email: authRecord.googleEmail, success: true};
        } catch (err) {
          await watchRepo.updateStatus(authRecord.googleEmail, 'error', err.message);
          console.error(
            `${LOG_PREFIX} Failed for ${authRecord.googleEmail}: ${err.message}`
          );
          return {email: authRecord.googleEmail, success: false, error: err.message};
        }
      })
    );

    for (const r of results) {
      const val = r.status === 'fulfilled' ? r.value : {success: false};
      if (val.skipped) skipped++;
      else if (val.success) renewed++;
      else failed++;
    }
  }

  console.log(
    `${LOG_PREFIX} Complete — renewed: ${renewed}, skipped (still active): ${skipped}, failed: ${failed}`
  );
  return {renewed, failed, skipped};
}

/**
 * Manual trigger: ensure watch for all accounts belonging to a store (+ optional user).
 * Used by POST /api/gmail/watch/start-all.
 * When userId is omitted (admin), processes ALL accounts in the store.
 */
export async function ensureWatchForStore(storeId, userId) {
  const watchRepo = new GmailWatchRepository();
  const authRepo = new GoogleAuthRepository();
  const topic = pubsubTopic();

  const accounts = userId
    ? await authRepo.getAllByStoreAndUser(storeId, userId)
    : await authRepo.getAllByStore(storeId);
  const gmailAccounts = accounts.filter(
    a => a.authType === 'gmail' || a.scope?.includes('gmail.readonly')
  );

  const results = [];
  for (const authRecord of gmailAccounts) {
    try {
      await ensureWatchForAccount(authRecord, {watchRepo, topic});
      results.push({email: authRecord.googleEmail, success: true});
    } catch (err) {
      await watchRepo.updateStatus(authRecord.googleEmail, 'error', err.message);
      results.push({email: authRecord.googleEmail, success: false, error: err.message});
    }
  }
  return results;
}
