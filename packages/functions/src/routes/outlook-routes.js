import {Router} from 'express';
import {
  listOutlookEmails,
  getOutlookEmailDetail,
  listOutlookFolders
} from '../controllers/outlook/outlook-email-handler.js';
import {
  startOutlookWatch,
  stopOutlookWatch,
  getOutlookWatchStatus
} from '../controllers/outlook/outlook-watch-handler.js';
import {
  getOutlookAuthUrl,
  handleOutlookCallback,
  getOutlookAccounts,
  disconnectOutlookAccount
} from '../controllers/outlook/outlook-auth-handler.js';

const router = new Router();

// Outlook OAuth
router.get('/auth-url', getOutlookAuthUrl);
router.get('/auth/callback', handleOutlookCallback);
router.get('/accounts', getOutlookAccounts);
router.post('/disconnect', disconnectOutlookAccount);

// Email operations
router.get('/emails', listOutlookEmails);
router.get('/emails/:messageId', getOutlookEmailDetail);
router.get('/folders', listOutlookFolders);

// Watch (subscriptions)
router.post('/watch', startOutlookWatch);
router.post('/watch/stop', stopOutlookWatch);
router.get('/watch/status', getOutlookWatchStatus);

export default router;
