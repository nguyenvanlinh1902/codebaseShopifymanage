import {OutlookService} from '../../services/outlook-service.js';

/**
 * GET /api/outlook/emails — list Outlook emails
 */
export async function listOutlookEmails(req, res) {
  try {
    const {email, q, folder, maxResults = '50', pageToken} = req.query;
    if (!email) {
      return res.status(400).json({success: false, error: 'email query param is required'});
    }

    const storeId = req.query.storeId || 'default';
    const outlookService = await OutlookService.createForEmail(storeId, req.userId, email);

    let result;
    const limit = Math.min(parseInt(maxResults) || 50, 100);

    if (folder) {
      result = await outlookService.listMessagesByFolder(folder, limit, pageToken || undefined);
    } else {
      result = await outlookService.listMessages(q || '', limit, pageToken || undefined);
    }

    return res.json({
      success: true,
      data: {
        messages: result.messages,
        nextPageToken: result.nextPageToken
      }
    });
  } catch (error) {
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

    const storeId = req.query.storeId || 'default';
    const outlookService = await OutlookService.createForEmail(storeId, req.userId, email);
    const message = await outlookService.getFullMessage(messageId);

    return res.json({success: true, data: message});
  } catch (error) {
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

    const storeId = req.query.storeId || 'default';
    const outlookService = await OutlookService.createForEmail(storeId, req.userId, email);
    const folders = await outlookService.listFolders();

    return res.json({success: true, data: folders});
  } catch (error) {
    console.error('[Outlook:Folders] List error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}
