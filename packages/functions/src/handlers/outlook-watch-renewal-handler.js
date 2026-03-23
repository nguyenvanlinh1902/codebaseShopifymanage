import {OutlookService} from '../services/outlook-service.js';
import {GoogleAuthRepository} from '../repositories/googleAuthRepository.js';
import {OutlookWatchRepository} from '../repositories/outlook-watch-repository.js';

const LOG_PREFIX = '[Outlook:Renewal]';
const BATCH_SIZE = 20;

/**
 * Renew all expiring Outlook subscriptions (daily cron)
 * Outlook subscriptions expire in ~3 days (max 4230 minutes)
 */
export async function processOutlookWatchRenewal() {
  const watchRepo = new OutlookWatchRepository();
  const authRepo = new GoogleAuthRepository();

  // Proactive token refresh — keep tokens alive to prevent 90-day inactivity expiry
  await proactiveTokenRefresh(authRepo, watchRepo);

  // Renew expiring watches + re-activate expired ones
  const expiring = await watchRepo.getAllExpiringSoon(48);
  const allWatches = await watchRepo.collection.where('status', 'in', ['expired', 'error']).get();
  const expired = allWatches.docs.map(doc => ({id: doc.id, ...doc.data()}));
  const toProcess = [...expiring, ...expired.filter(e => !expiring.find(x => x.email === e.email))];
  console.log(`${LOG_PREFIX} Found ${expiring.length} expiring, ${expired.length} expired/error — processing ${toProcess.length} total`);

  if (toProcess.length === 0) return;

  let renewed = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async watch => {
        try {
          // Lookup by store + email (no userId restriction)
          const allInStore = await authRepo.getAllByStore(watch.storeId);
          const authRecord = allInStore.find(a => a.googleEmail === watch.email && a.authType === 'outlook');
          if (!authRecord) throw new Error(`No auth record for ${watch.email}`);

          const outlookService = await OutlookService.createFromAuthRecord(authRecord);
          // Renew existing or create new subscription for expired watches
          let subResult;
          if (watch.subscriptionId && watch.status !== 'expired') {
            subResult = await outlookService.renewSubscription(watch.subscriptionId);
          } else {
            subResult = await outlookService.createSubscription(watch.webhookUrl);
          }

          await watchRepo.upsertWatch(watch.email, watch.storeId, watch.userId, {
            subscriptionId: subResult.subscriptionId,
            watchExpiration: subResult.expiration,
            webhookUrl: watch.webhookUrl,
            status: 'active',
            renewalError: null
          });

          return {email: watch.email, success: true};
        } catch (err) {
          // Mark as token_expired so UI prompts reconnect instead of retrying
          const status = err.code === 'TOKEN_EXPIRED' ? 'token_expired' : 'error';
          await watchRepo.updateStatus(watch.email, status, err.message);
          return {email: watch.email, success: false, error: err.message};
        }
      })
    );

    for (const result of results) {
      const val = result.status === 'fulfilled' ? result.value : {success: false};
      if (val.success) renewed++;
      else failed++;
    }
  }

  console.log(`${LOG_PREFIX} Renewal complete: ${renewed} renewed, ${failed} failed`);
  return {renewed, failed};
}

/**
 * Proactive token refresh — refresh all active Outlook tokens every cron run
 * to prevent Microsoft 90-day inactivity expiry on refresh tokens
 */
async function proactiveTokenRefresh(authRepo, watchRepo) {
  const activeWatches = await watchRepo.getAllActive();
  if (activeWatches.length === 0) return;

  console.log(`${LOG_PREFIX} Proactive refresh for ${activeWatches.length} active accounts`);

  for (const watch of activeWatches) {
    try {
      const allInStore = await authRepo.getAllByStore(watch.storeId);
      const authRecord = allInStore.find(a => a.googleEmail === watch.email && a.authType === 'outlook');
      if (!authRecord) continue;

      // Force refresh by temporarily clearing expiryDate
      await OutlookService.createFromAuthRecord({...authRecord, expiryDate: 0});
      console.log(`${LOG_PREFIX} Proactive refresh OK: ${watch.email}`);
    } catch (err) {
      if (err.code === 'TOKEN_EXPIRED') {
        await watchRepo.updateStatus(watch.email, 'token_expired', err.message);
        console.warn(`${LOG_PREFIX} Token expired for ${watch.email} — needs re-auth`);
      } else {
        console.warn(`${LOG_PREFIX} Proactive refresh failed for ${watch.email}: ${err.message}`);
      }
    }
  }
}
