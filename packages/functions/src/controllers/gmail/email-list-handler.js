import {GmailService} from '../../services/gmail-service.js';
import {GoogleAuthRepository} from '../../repositories/googleAuthRepository.js';
import {assertEmailAccess} from '../../helpers/email-access-guard.js';

/**
 * GET /api/gmail/emails
 * List emails with search/filter, cursor pagination.
 * Access is scoped by assignedStores — not by the legacy ?storeId= query param.
 */
export async function listEmails(req, res) {
  try {
    const {email, q, label, maxResults = 50, pageToken} = req.query;

    if (!email) {
      return res.status(400).json({success: false, error: 'email query param is required'});
    }

    await assertEmailAccess(req, email);

    const authRepo = new GoogleAuthRepository();
    // Any record for this email works — token is shared across all linkedStoreIds.
    const snap = await authRepo.collection.where('googleEmail', '==', email).limit(1).get();
    if (snap.empty) {
      return res.status(404).json({success: false, error: 'Google account not found'});
    }
    const authRecord = {id: snap.docs[0].id, ...snap.docs[0].data()};

    const gmailService = GmailService.createFromAuthRecord(authRecord);

    const queryParts = [];
    if (q) queryParts.push(q);
    if (label) queryParts.push(`label:${label}`);
    const query = queryParts.join(' ');

    const cappedMaxResults = Math.min(Math.max(1, parseInt(maxResults) || 50), 100);
    const result = await gmailService.listMessages(query, cappedMaxResults, pageToken);

    return res.json({
      success: true,
      data: result.messages,
      pagination: {pageToken: result.nextPageToken}
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({success: false, error: error.message});
    }
    console.error('[Gmail:EmailList] Error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}
