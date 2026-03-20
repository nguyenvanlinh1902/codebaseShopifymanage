import {GmailService} from '../services/gmail-service.js';
import {GoogleAuthRepository} from '../repositories/googleAuthRepository.js';
import {GmailWatchRepository} from '../repositories/gmail-watch-repository.js';
import {DiscordService} from '../services/discord-service.js';
import {EmailRuleService} from '../services/email-rule-service.js';
import {getFirestore} from 'firebase-admin/firestore';

const LOG_PREFIX = '[Gmail:Push]';

/**
 * Process Gmail Pub/Sub push notification
 * Called by gmailPushHandler Cloud Function
 */
export async function processPushNotification(messageData) {
  const data = messageData.message?.data
    ? JSON.parse(Buffer.from(messageData.message.data, 'base64').toString())
    : null;

  if (!data?.emailAddress) {
    console.warn(`${LOG_PREFIX} No emailAddress in push data`);
    return;
  }

  const {emailAddress, historyId: newHistoryId} = data;
  console.log(`${LOG_PREFIX} Notification for ${emailAddress}, historyId=${newHistoryId}`);

  const watchRepo = new GmailWatchRepository();
  const watchRecord = await watchRepo.getByEmail(emailAddress);

  if (!watchRecord) {
    console.warn(`${LOG_PREFIX} No watch record for ${emailAddress} (orphan notification)`);
    return;
  }

  // Look up auth record to create Gmail service
  const authRepo = new GoogleAuthRepository();
  const authRecord = await authRepo.getByStoreUserAndEmail(
    watchRecord.storeId, watchRecord.userId, emailAddress
  );
  if (!authRecord) {
    console.error(`${LOG_PREFIX} No auth record for ${emailAddress}`);
    return;
  }

  const gmailService = GmailService.createFromAuthRecord(authRecord);
  let newMessages = [];

  try {
    // Try history.list with stored historyId
    console.log(`${LOG_PREFIX} Fetching history since ${watchRecord.historyId}`);
    const {history, historyId: latestHistoryId} = await gmailService.listHistory(watchRecord.historyId);
    console.log(`${LOG_PREFIX} History entries: ${history.length}, latest historyId: ${latestHistoryId}`);

    const messageIds = new Set();
    for (const entry of history) {
      for (const added of (entry.messagesAdded || [])) {
        messageIds.add(added.message.id);
      }
    }
    console.log(`${LOG_PREFIX} Found ${messageIds.size} new message IDs from history`);

    // Fetch full messages and deduplicate
    for (const msgId of messageIds) {
      if (await claimMessage(emailAddress, msgId)) {
        console.log(`${LOG_PREFIX} Skipping already processed: ${msgId}`);
        continue;
      }
      try {
        const fullMsg = await gmailService.getFullMessage(msgId);
        newMessages.push(fullMsg);
        console.log(`${LOG_PREFIX} New message: "${fullMsg.subject}" from ${fullMsg.from}`);
      } catch (err) {
        console.error(`${LOG_PREFIX} Failed to fetch message ${msgId}:`, err.message);
      }
    }

    // If history returned 0 new messages, try fetching recent as fallback
    if (messageIds.size === 0 && history.length === 0) {
      console.log(`${LOG_PREFIX} Empty history, trying recent messages fallback`);
      const {messages} = await gmailService.listMessages('newer_than:5m', 5);
      for (const msg of messages) {
        if (await claimMessage(emailAddress, msg.id)) continue;
        const fullMsg = await gmailService.getFullMessage(msg.id);
        newMessages.push(fullMsg);
      }
    }
  } catch (err) {
    if (err.code === 404 || err.message?.includes('404') || err.message?.includes('notFound')) {
      // Stale historyId — fallback to recent messages
      console.warn(`${LOG_PREFIX} Stale historyId for ${emailAddress}, falling back to messages.list`);
      const {messages} = await gmailService.listMessages('newer_than:1h', 10);
      for (const msg of messages) {
        if (await claimMessage(emailAddress, msg.id)) continue;
        try {
          const fullMsg = await gmailService.getFullMessage(msg.id);
          newMessages.push(fullMsg);
        } catch (fetchErr) {
          console.error(`${LOG_PREFIX} Failed to fetch message ${msg.id}:`, fetchErr.message);
        }
      }
    } else {
      console.error(`${LOG_PREFIX} History error:`, err.message);
      throw err;
    }
  }

  // Update historyId
  await watchRepo.updateHistoryId(emailAddress, newHistoryId);

  // Evaluate rules and forward to Discord (direct send, skip queue to avoid duplicates)
  if (newMessages.length > 0) {
    const ruleService = await EmailRuleService.createForStore(watchRecord.storeId);
    const discordService = await DiscordService.createFromConfig(watchRecord.storeId);

    if (discordService) {
      let forwarded = 0;
      for (const msg of newMessages) {
        const action = ruleService.evaluate(msg);
        if (action === 'forward') {
          try {
            const embed = discordService.createEmailEmbed({...msg, accountEmail: emailAddress});
            await discordService.sendEmbed(embed);
            forwarded++;
            console.log(`${LOG_PREFIX} Forwarded to Discord: "${msg.subject}"`);
          } catch (discordErr) {
            console.error(`${LOG_PREFIX} Discord send failed: ${discordErr.message}`);
          }
        } else {
          console.log(`${LOG_PREFIX} Filtered (${action}): ${msg.subject}`);
        }
      }
    }
  }

  console.log(`${LOG_PREFIX} Processed ${newMessages.length} new messages for ${emailAddress}`);
  return {emailAddress, storeId: watchRecord.storeId, messages: newMessages};
}

/**
 * Atomic check-and-mark as processed (dedup)
 * Returns true if already processed, false if newly claimed
 * Uses Firestore transaction to prevent race conditions from concurrent Pub/Sub deliveries
 */
async function claimMessage(emailAddress, messageId) {
  const db = getFirestore();
  const docId = `${emailAddress}:${messageId}`;
  const docRef = db.collection('gmail_processed_messages').doc(docId);

  try {
    const alreadyProcessed = await db.runTransaction(async (tx) => {
      const doc = await tx.get(docRef);
      if (doc.exists) return true; // already claimed by another invocation
      tx.set(docRef, {emailAddress, messageId, processedAt: new Date().toISOString()});
      return false; // newly claimed
    });
    return alreadyProcessed;
  } catch (err) {
    // If transaction fails (contention), treat as already processed to be safe
    console.warn(`${LOG_PREFIX} Dedup transaction failed for ${messageId}: ${err.message}`);
    return true;
  }
}
