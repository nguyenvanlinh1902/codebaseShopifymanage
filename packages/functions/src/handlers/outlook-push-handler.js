import {OutlookService} from '../services/outlook-service.js';
import {GoogleAuthRepository} from '../repositories/googleAuthRepository.js';
import {OutlookWatchRepository} from '../repositories/outlook-watch-repository.js';
import {DiscordService} from '../services/discord-service.js';
import {EmailRuleService} from '../services/email-rule-service.js';
import {getFirestore} from 'firebase-admin/firestore';

const LOG_PREFIX = '[Outlook:Push]';

/**
 * Handle Microsoft Graph webhook notifications
 * Called as HTTP POST from Microsoft Graph change notifications
 */
export async function handleOutlookWebhook(req, res) {
  // Validation request — Microsoft sends this when creating subscription
  if (req.query.validationToken) {
    console.log(`${LOG_PREFIX} Validation request received`);
    return res
      .status(200)
      .type('text/plain')
      .send(req.query.validationToken);
  }

  // Acknowledge immediately (Microsoft requires 202 within 3 seconds)
  res.status(202).send();

  const notifications = req.body?.value || [];
  console.log(`${LOG_PREFIX} Received ${notifications.length} notifications`);

  for (const notification of notifications) {
    try {
      await processNotification(notification);
    } catch (err) {
      console.error(`${LOG_PREFIX} Error processing notification:`, err.message);
    }
  }
}

async function processNotification(notification) {
  if (notification.clientState !== 'outlook-watch-secret') {
    console.warn(`${LOG_PREFIX} Invalid clientState, skipping`);
    return;
  }

  const subscriptionId = notification.subscriptionId;
  const watchRepo = new OutlookWatchRepository();
  const watchRecord = await watchRepo.getBySubscriptionId(subscriptionId);

  if (!watchRecord) {
    console.warn(`${LOG_PREFIX} No watch record for subscription ${subscriptionId}`);
    return;
  }

  const authRepo = new GoogleAuthRepository();
  const authRecord = await authRepo.getByStoreUserAndEmail(
    watchRecord.storeId,
    watchRecord.userId,
    watchRecord.email
  );
  if (!authRecord) {
    console.error(`${LOG_PREFIX} No auth record for ${watchRecord.email}`);
    return;
  }

  const outlookService = await OutlookService.createFromAuthRecord(authRecord);
  const resourceData = notification.resourceData;

  if (!resourceData?.id) {
    console.warn(`${LOG_PREFIX} No resourceData.id in notification`);
    return;
  }

  const messageId = resourceData.id;

  // Dedup check
  if (await claimMessage(watchRecord.email, messageId)) {
    console.log(`${LOG_PREFIX} Skipping already processed: ${messageId}`);
    return;
  }

  try {
    const fullMsg = await outlookService.getFullMessage(messageId);
    console.log(`${LOG_PREFIX} New message: "${fullMsg.subject}" from ${fullMsg.from}`);

    // Evaluate rules and forward to Discord
    const ruleService = await EmailRuleService.createForStore(watchRecord.storeId);
    const action = ruleService.evaluate(fullMsg);

    if (action === 'forward') {
      const discordService = await DiscordService.createFromConfig(watchRecord.storeId);
      if (discordService) {
        const embed = discordService.createEmailEmbed({
          ...fullMsg,
          accountEmail: watchRecord.email,
          provider: 'Outlook'
        });
        await discordService.sendEmbed(embed);
        console.log(`${LOG_PREFIX} Forwarded to Discord: "${fullMsg.subject}"`);
      }
    } else {
      console.log(`${LOG_PREFIX} Filtered (${action}): ${fullMsg.subject}`);
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} Failed to process message ${messageId}:`, err.message);
  }
}

/** Atomic dedup — same pattern as Gmail */
async function claimMessage(email, messageId) {
  const db = getFirestore();
  const docId = `outlook:${email}:${messageId}`;
  const docRef = db.collection('gmail_processed_messages').doc(docId);

  try {
    return await db.runTransaction(async tx => {
      const doc = await tx.get(docRef);
      if (doc.exists) return true;
      tx.set(docRef, {
        email,
        messageId,
        provider: 'outlook',
        processedAt: new Date().toISOString()
      });
      return false;
    });
  } catch (err) {
    console.warn(`${LOG_PREFIX} Dedup transaction failed for ${messageId}: ${err.message}`);
    return true;
  }
}
