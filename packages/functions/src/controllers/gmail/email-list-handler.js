import {GmailService} from '../../services/gmail-service.js';
import {GoogleAuthRepository} from '../../repositories/googleAuthRepository.js';

/**
 * GET /api/gmail/emails
 * List emails with search/filter, cursor pagination
 */
export async function listEmails(req, res) {
  try {
    const userId = req.userId;
    const storeId = req.query.storeId || 'default';
    const {email, q, label, maxResults = 50, pageToken} = req.query;

    if (!email) {
      return res.status(400).json({success: false, error: 'email query param is required'});
    }

    const isAdmin = req.userRole === 'admin';
    const authRepo = new GoogleAuthRepository();
    const authRecord = isAdmin
      ? await authRepo.getByStoreAndEmail(storeId, email)
      : await authRepo.getByStoreUserAndEmail(storeId, userId, email);
    if (!authRecord) {
      return res.status(404).json({success: false, error: 'Google account not found'});
    }

    const gmailService = GmailService.createFromAuthRecord(authRecord);

    // Build Gmail query string
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
    console.error('[Gmail:EmailList] Error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}
