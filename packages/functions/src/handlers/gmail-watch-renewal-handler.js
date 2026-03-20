import {GmailService} from '../services/gmail-service.js';
import {GoogleAuthRepository} from '../repositories/googleAuthRepository.js';
import {GmailWatchRepository} from '../repositories/gmail-watch-repository.js';

const LOG_PREFIX = '[Gmail:Renewal]';
const BATCH_SIZE = 20;
const PUBSUB_TOPIC = 'projects/' + (process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT) + '/topics/gmail-notifications';

/**
 * Renew all expiring Gmail watches (daily cron)
 */
export async function processWatchRenewal() {
  const watchRepo = new GmailWatchRepository();
  const authRepo = new GoogleAuthRepository();

  const expiring = await watchRepo.getAllExpiringSoon(48);
  console.log(`${LOG_PREFIX} Found ${expiring.length} watches expiring within 48h`);

  if (expiring.length === 0) return;

  let renewed = 0;
  let failed = 0;

  // Process in batches
  for (let i = 0; i < expiring.length; i += BATCH_SIZE) {
    const batch = expiring.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async watch => {
        try {
          const authRecord = await authRepo.getByStoreUserAndEmail(
            watch.storeId, watch.userId, watch.googleEmail
          );
          if (!authRecord) {
            throw new Error(`No auth record for ${watch.googleEmail}`);
          }

          const gmailService = GmailService.createFromAuthRecord(authRecord);
          const watchResult = await gmailService.watchMailbox(PUBSUB_TOPIC);

          await watchRepo.upsertWatch(watch.googleEmail, watch.storeId, watch.userId, {
            historyId: watchResult.historyId,
            watchExpiration: watchResult.expiration,
            topicName: PUBSUB_TOPIC,
            status: 'active',
            renewalError: null
          });

          return {email: watch.googleEmail, success: true};
        } catch (err) {
          await watchRepo.updateStatus(watch.googleEmail, 'error', err.message);
          return {email: watch.googleEmail, success: false, error: err.message};
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
