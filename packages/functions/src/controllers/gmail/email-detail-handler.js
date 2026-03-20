import {GmailService} from '../../services/gmail-service.js';
import {GoogleAuthRepository} from '../../repositories/googleAuthRepository.js';

/**
 * GET /api/gmail/emails/:messageId
 * Get full email with body
 */
export async function getEmailDetail(req, res) {
  try {
    const userId = req.userId;
    const storeId = req.query.storeId || 'default';
    const {messageId} = req.params;
    const {email} = req.query;

    if (!email) {
      return res.status(400).json({success: false, error: 'email query param is required'});
    }

    const authRepo = new GoogleAuthRepository();
    const authRecord = await authRepo.getByStoreUserAndEmail(storeId, userId, email);
    if (!authRecord) {
      return res.status(404).json({success: false, error: 'Google account not found'});
    }

    const gmailService = GmailService.createFromAuthRecord(authRecord);
    const message = await gmailService.getFullMessage(messageId);

    return res.json({success: true, data: message});
  } catch (error) {
    console.error('[Gmail:EmailDetail] Error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}
