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

  const expiring = await watchRepo.getAllExpiringSoon(48);
  console.log(`${LOG_PREFIX} Found ${expiring.length} subscriptions expiring within 48h`);

  if (expiring.length === 0) return;

  let renewed = 0;
  let failed = 0;

  for (let i = 0; i < expiring.length; i += BATCH_SIZE) {
    const batch = expiring.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async watch => {
        try {
          const authRecord = await authRepo.getByStoreUserAndEmail(
            watch.storeId,
            watch.userId,
            watch.email
          );
          if (!authRecord) throw new Error(`No auth record for ${watch.email}`);

          const outlookService = await OutlookService.createFromAuthRecord(authRecord);
          const subResult = await outlookService.renewSubscription(watch.subscriptionId);

          await watchRepo.upsertWatch(watch.email, watch.storeId, watch.userId, {
            subscriptionId: subResult.subscriptionId,
            watchExpiration: subResult.expiration,
            webhookUrl: watch.webhookUrl,
            status: 'active',
            renewalError: null
          });

          return {email: watch.email, success: true};
        } catch (err) {
          await watchRepo.updateStatus(watch.email, 'error', err.message);
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
