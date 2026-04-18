import {GmailService} from '../../services/gmail-service.js';
import {GoogleAuthRepository} from '../../repositories/googleAuthRepository.js';
import {GmailWatchRepository} from '../../repositories/gmail-watch-repository.js';
import {ensureWatchForStore} from '../../handlers/gmail-watch-renewal-handler.js';

function pubsubTopic() {
  const project =
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    process.env.GCP_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT;
  return `projects/${project}/topics/gmail-notifications`;
}
const PUBSUB_TOPIC = pubsubTopic();

/**
 * POST /api/gmail/watch/start-all — ensure watch for all connected Gmail accounts of a user.
 */
export async function startAllWatches(req, res) {
  try {
    const isAdmin = req.userRole === 'admin';
    const storeId = req.body.storeId || req.query.storeId || 'default';
    const results = isAdmin
      ? await ensureWatchForStore(storeId)
      : await ensureWatchForStore(storeId, req.userId);
    const succeeded = results.filter(r => r.success).length;
    const failed = results.length - succeeded;
    return res.json({
      success: true,
      data: {total: results.length, succeeded, failed, results}
    });
  } catch (error) {
    console.error('[Gmail:Watch:StartAll] Error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/gmail/watch — start watching an account
 */
export async function startWatch(req, res) {
  try {
    const isAdmin = req.userRole === 'admin';
    const storeId = req.body.storeId || req.query.storeId || 'default';
    const {email} = req.body;

    if (!email) {
      return res.status(400).json({success: false, error: 'email is required'});
    }

    const authRepo = new GoogleAuthRepository();
    const authRecord = isAdmin
      ? await authRepo.getByStoreAndEmail(storeId, email)
      : await authRepo.getByStoreUserAndEmail(storeId, req.userId, email);
    if (!authRecord) {
      return res.status(404).json({success: false, error: 'Google account not found'});
    }

    const gmailService = GmailService.createFromAuthRecord(authRecord);
    const watchResult = await gmailService.watchMailbox(PUBSUB_TOPIC);

    const watchRepo = new GmailWatchRepository();
    const watchRecord = await watchRepo.upsertWatch(email, storeId, authRecord.userId, {
      historyId: watchResult.historyId,
      watchExpiration: watchResult.expiration,
      topicName: PUBSUB_TOPIC,
      status: 'active',
      lastSyncTime: new Date().toISOString(),
      renewalError: null
    });

    return res.json({success: true, data: watchRecord});
  } catch (error) {
    console.error('[Gmail:Watch:Start] Error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/gmail/watch/stop — stop watching an account
 */
export async function stopWatch(req, res) {
  try {
    const isAdmin = req.userRole === 'admin';
    const storeId = req.body.storeId || req.query.storeId || 'default';
    const {email} = req.body;

    if (!email) {
      return res.status(400).json({success: false, error: 'email is required'});
    }

    const authRepo = new GoogleAuthRepository();
    const authRecord = isAdmin
      ? await authRepo.getByStoreAndEmail(storeId, email)
      : await authRepo.getByStoreUserAndEmail(storeId, req.userId, email);
    if (!authRecord) {
      return res.status(404).json({success: false, error: 'Google account not found'});
    }

    const gmailService = GmailService.createFromAuthRecord(authRecord);
    await gmailService.stopWatch();

    const watchRepo = new GmailWatchRepository();
    await watchRepo.updateStatus(email, 'expired');

    return res.json({success: true, data: {message: 'Watch stopped'}});
  } catch (error) {
    console.error('[Gmail:Watch:Stop] Error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * GET /api/gmail/watch/status — get watch status for all accounts
 */
export async function getWatchStatus(req, res) {
  try {
    const isAdmin = req.userRole === 'admin';
    const storeId = req.body.storeId || req.query.storeId || 'default';
    const watchRepo = new GmailWatchRepository();
    const watches = isAdmin
      ? await watchRepo.getAllByStore(storeId)
      : await watchRepo.getAllByStoreAndUser(storeId, req.userId);

    return res.json({success: true, data: watches});
  } catch (error) {
    console.error('[Gmail:Watch:Status] Error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}
