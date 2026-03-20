import {Router} from 'express';
import {listEmails} from '../controllers/gmail/email-list-handler.js';
import {getEmailDetail} from '../controllers/gmail/email-detail-handler.js';
import {listLabels} from '../controllers/gmail/gmail-labels-handler.js';
import {startWatch, stopWatch, getWatchStatus} from '../controllers/gmail/gmail-watch-handler.js';
import {
  getGmailAuthUrl, exchangeGmailCode, getGmailAccounts, disconnectGmailAccount
} from '../controllers/gmail/gmail-auth-handler.js';

const router = new Router();

// Gmail OAuth (separate from Google Sheets)
router.get('/auth-url', getGmailAuthUrl);
router.post('/auth/exchange', exchangeGmailCode);
router.get('/accounts', getGmailAccounts);
router.post('/disconnect', disconnectGmailAccount);

router.get('/emails', listEmails);
router.get('/emails/:messageId', getEmailDetail);
router.get('/labels', listLabels);
router.post('/watch', startWatch);
router.post('/watch/stop', stopWatch);
router.get('/watch/status', getWatchStatus);

export default router;
