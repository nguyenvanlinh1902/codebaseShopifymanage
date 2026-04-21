import {OutlookService} from '../../services/outlook-service.js';
import {GoogleAuthRepository} from '../../repositories/googleAuthRepository.js';
import {assertEmailAccess} from '../../helpers/email-access-guard.js';

async function loadOutlookService(email) {
  const authRepo = new GoogleAuthRepository();
  const snap = await authRepo.collection
    .where('googleEmail', '==', email)
    .where('authType', '==', 'outlook')
    .limit(1)
    .get();
  if (snap.empty) {
    const err = new Error(`No Outlook auth found for ${email}`);
    err.status = 404;
    throw err;
  }
  const authRecord = {id: snap.docs[0].id, ...snap.docs[0].data()};
  return OutlookService.createFromAuthRecord(authRecord);
}

/**
 * GET /api/outlook/emails — list Outlook emails. Access scoped by assignedStores.
 */
export async function listOutlookEmails(req, res) {
  try {
    const {email, q, folder, maxResults = '50', pageToken} = req.query;
    if (!email) {
      return res.status(400).json({success: false, error: 'email query param is required'});
    }

    await assertEmailAccess(req, email);
    const outlookService = await loadOutlookService(email);

    const limit = Math.min(parseInt(maxResults) || 50, 100);
    const result = folder
      ? await outlookService.listMessagesByFolder(folder, limit, pageToken || undefined)
      : await outlookService.listMessages(q || '', limit, pageToken || undefined);

    return res.json({
      success: true,
      data: {messages: result.messages, nextPageToken: result.nextPageToken}
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({success: false, error: error.message});
    }
    console.error('[Outlook:Emails] List error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * GET /api/outlook/emails/:messageId — get full Outlook email
 */
export async function getOutlookEmailDetail(req, res) {
  try {
    const {messageId} = req.params;
    const email = req.query.email;
    if (!email) {
      return res.status(400).json({success: false, error: 'email query param is required'});
    }

    await assertEmailAccess(req, email);
    const outlookService = await loadOutlookService(email);
    const message = await outlookService.getFullMessage(messageId);

    return res.json({success: true, data: message});
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({success: false, error: error.message});
    }
    console.error('[Outlook:Emails] Detail error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * GET /api/outlook/folders — list Outlook mail folders
 */
export async function listOutlookFolders(req, res) {
  try {
    const {email} = req.query;
    if (!email) {
      return res.status(400).json({success: false, error: 'email query param is required'});
    }

    await assertEmailAccess(req, email);
    const outlookService = await loadOutlookService(email);
    const folders = await outlookService.listFolders();

    return res.json({success: true, data: folders});
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({success: false, error: error.message});
    }
    console.error('[Outlook:Folders] List error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}
