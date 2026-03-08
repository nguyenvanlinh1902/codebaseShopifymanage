import {GoogleAuthRepository} from '../../repositories/googleAuthRepository.js';
import {SheetRepository} from '../../repositories/sheetRepository.js';

const authRepo = new GoogleAuthRepository();
const sheetRepo = new SheetRepository();

/**
 * POST /api/google/disconnect
 * Remove all Google auth records
 */
export async function disconnectGoogle(req, res) {
  try {
    const allRecords = await authRepo.getAll();
    for (const record of allRecords) {
      await authRepo.collection.doc(record.id).delete();
    }
    return res.json({success: true, message: 'All Google accounts disconnected'});
  } catch (error) {
    console.error('Disconnect Google error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/google/disconnect-account
 * Disconnect a specific Google account by email: remove auth record + its sheets
 */
export async function disconnectAccount(req, res) {
  try {
    const {googleEmail} = req.body;

    if (!googleEmail) {
      return res.status(400).json({success: false, error: 'googleEmail is required'});
    }

    // Remove all auth records for this email
    const allRecords = await authRepo.getAll();
    const matching = allRecords.filter(r => r.googleEmail === googleEmail);
    for (const record of matching) {
      await authRepo.collection.doc(record.id).delete();
    }

    // Remove all sheets belonging to this Google account
    const allSheets = await sheetRepo.getAll();
    const sheetsToDelete = allSheets.filter(s => s.googleEmail === googleEmail);
    for (const sheet of sheetsToDelete) {
      await sheetRepo.delete(sheet.id);
    }

    return res.json({
      success: true,
      message: `Disconnected ${googleEmail}`,
      data: {deletedSheets: sheetsToDelete.length}
    });
  } catch (error) {
    console.error('Disconnect account error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/google/bulk-disconnect-accounts
 * Disconnect multiple Google accounts at once
 */
export async function bulkDisconnectAccounts(req, res) {
  try {
    const {emails} = req.body;

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({success: false, error: 'emails array is required'});
    }

    let totalDeletedSheets = 0;

    const results = await Promise.allSettled(
      emails.map(async googleEmail => {
        // Remove auth records for this email
        const allRecords = await authRepo.getAll();
        const matching = allRecords.filter(r => r.googleEmail === googleEmail);
        for (const record of matching) {
          await authRepo.collection.doc(record.id).delete();
        }

        // Remove all sheets belonging to this Google account
        const allSheets = await sheetRepo.getAll();
        const sheetsToDelete = allSheets.filter(s => s.googleEmail === googleEmail);
        for (const sheet of sheetsToDelete) {
          await sheetRepo.delete(sheet.id);
        }

        totalDeletedSheets += sheetsToDelete.length;
        return {email: googleEmail, success: true, deletedSheets: sheetsToDelete.length};
      })
    );

    const disconnected = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - disconnected;

    return res.json({
      success: true,
      message: `Disconnected ${disconnected} account(s)${failed > 0 ? `, ${failed} failed` : ''}`,
      disconnected,
      failed,
      totalDeletedSheets
    });
  } catch (error) {
    console.error('Bulk disconnect accounts error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}
