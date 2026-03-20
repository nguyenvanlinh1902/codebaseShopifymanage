import {GmailService} from '../../services/gmail-service.js';
import {GoogleAuthRepository} from '../../repositories/googleAuthRepository.js';

/**
 * GET /api/gmail/labels
 * List Gmail labels for an account
 */
export async function listLabels(req, res) {
  try {
    const userId = req.userId;
    const storeId = req.query.storeId || 'default';
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
    const labels = await gmailService.listLabels();

    return res.json({success: true, data: labels});
  } catch (error) {
    console.error('[Gmail:Labels] Error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}
