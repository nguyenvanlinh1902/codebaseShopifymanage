import {GmailService} from '../../services/gmail-service.js';
import {GoogleAuthRepository} from '../../repositories/googleAuthRepository.js';
import {assertEmailAccess} from '../../helpers/email-access-guard.js';

/**
 * GET /api/gmail/labels
 * List Gmail labels for an account. Access scoped by assignedStores.
 */
export async function listLabels(req, res) {
  try {
    const {email} = req.query;

    if (!email) {
      return res.status(400).json({success: false, error: 'email query param is required'});
    }

    await assertEmailAccess(req, email);

    const authRepo = new GoogleAuthRepository();
    const snap = await authRepo.collection.where('googleEmail', '==', email).limit(1).get();
    if (snap.empty) {
      return res.status(404).json({success: false, error: 'Google account not found'});
    }
    const authRecord = {id: snap.docs[0].id, ...snap.docs[0].data()};

    const gmailService = GmailService.createFromAuthRecord(authRecord);
    const labels = await gmailService.listLabels();

    return res.json({success: true, data: labels});
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({success: false, error: error.message});
    }
    console.error('[Gmail:Labels] Error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}
