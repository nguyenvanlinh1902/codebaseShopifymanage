import {OutlookService} from '../../services/outlook-service.js';
import {OutlookWatchRepository} from '../../repositories/outlook-watch-repository.js';

const WEBHOOK_URL_BASE = `https://us-central1-${process.env.GCLOUD_PROJECT ||
  process.env.GCP_PROJECT}.cloudfunctions.net/api/api/outlook/webhook`;

/**
 * POST /api/outlook/watch — start watching an Outlook account
 */
export async function startOutlookWatch(req, res) {
  try {
    const userId = req.userId;
    const storeId = req.body.storeId || req.query.storeId || 'default';
    const {email} = req.body;

    if (!email) {
      return res.status(400).json({success: false, error: 'email is required'});
    }

    const outlookService = await OutlookService.createForEmail(storeId, userId, email);
    const subResult = await outlookService.createSubscription(WEBHOOK_URL_BASE);

    const watchRepo = new OutlookWatchRepository();
    const watchRecord = await watchRepo.upsertWatch(email, storeId, userId, {
      subscriptionId: subResult.subscriptionId,
      watchExpiration: subResult.expiration,
      webhookUrl: WEBHOOK_URL_BASE,
      status: 'active',
      lastSyncTime: new Date().toISOString(),
      renewalError: null
    });

    return res.json({success: true, data: watchRecord});
  } catch (error) {
    console.error('[Outlook:Watch:Start] Error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/outlook/watch/stop — stop watching an Outlook account
 */
export async function stopOutlookWatch(req, res) {
  try {
    const userId = req.userId;
    const storeId = req.body.storeId || req.query.storeId || 'default';
    const {email} = req.body;

    if (!email) {
      return res.status(400).json({success: false, error: 'email is required'});
    }

    const watchRepo = new OutlookWatchRepository();
    const watch = await watchRepo.getByEmail(email);

    if (watch?.subscriptionId) {
      try {
        const isAdmin = req.userRole === 'admin';
        const outlookService = await OutlookService.createForEmail(storeId, userId, email, {isAdmin});
        await outlookService.deleteSubscription(watch.subscriptionId);
      } catch (err) {
        console.warn(`[Outlook:Watch] Failed to delete subscription: ${err.message}`);
      }
    }

    await watchRepo.updateStatus(email, 'expired');
    return res.json({success: true, data: {message: 'Watch stopped'}});
  } catch (error) {
    console.error('[Outlook:Watch:Stop] Error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * GET /api/outlook/watch/status — get watch status for all accounts
 */
export async function getOutlookWatchStatus(req, res) {
  try {
    const userId = req.userId;
    const storeId = req.body.storeId || req.query.storeId || 'default';
    const watchRepo = new OutlookWatchRepository();
    const watches = await watchRepo.getAllByStoreAndUser(storeId, userId);

    return res.json({success: true, data: watches});
  } catch (error) {
    console.error('[Outlook:Watch:Status] Error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}
