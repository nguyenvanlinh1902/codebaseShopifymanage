import {GoogleAuthRepository} from '../../repositories/googleAuthRepository.js';
import {SheetRepository} from '../../repositories/sheetRepository.js';

const authRepo = new GoogleAuthRepository();
const sheetRepo = new SheetRepository();

/**
 * POST /api/google/disconnect
 * Remove Google auth for a user
 * SECURITY: Now requires storeId for proper data isolation
 */
export async function disconnectGoogle(req, res) {
  try {
    const {userId, storeId} = req.body;

    if (!userId) {
      return res.status(400).json({success: false, error: 'userId is required'});
    }

    if (!storeId) {
      return res.status(400).json({success: false, error: 'storeId is required for security'});
    }

    // SECURITY FIX: Use store-scoped method
    await authRepo.deleteByStore(storeId, userId);
    return res.json({success: true, message: 'Google account disconnected'});
  } catch (error) {
    console.error('Disconnect Google error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/google/disconnect-account
 * Disconnect a specific Google account: remove auth record + delete all its sheets
 * SECURITY: Now requires storeId for proper data isolation
 */
export async function disconnectAccount(req, res) {
  try {
    const {userId, googleEmail, storeId} = req.body;

    if (!userId || !googleEmail) {
      return res.status(400).json({success: false, error: 'userId and googleEmail are required'});
    }

    if (!storeId) {
      return res.status(400).json({success: false, error: 'storeId is required for security'});
    }

    // SECURITY FIX: Use store-scoped methods
    // Remove auth record for this email
    await authRepo.deleteByStoreAndEmail(storeId, userId, googleEmail);

    // Remove all sheets belonging to this Google account (within this store only)
    const userSheets = await sheetRepo.getByStoreAndUser(storeId, userId);
    const sheetsToDelete = userSheets.filter(s => s.googleEmail === googleEmail);
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
 * SECURITY: Now requires storeId for proper data isolation
 */
export async function bulkDisconnectAccounts(req, res) {
  try {
    const {userId, emails, storeId} = req.body;

    if (!userId || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({success: false, error: 'userId and emails array are required'});
    }

    if (!storeId) {
      return res.status(400).json({success: false, error: 'storeId is required for security'});
    }

    let totalDeletedSheets = 0;

    // SECURITY FIX: Use store-scoped methods
    const results = await Promise.allSettled(
      emails.map(async googleEmail => {
        // Remove auth record for this email
        await authRepo.deleteByStoreAndEmail(storeId, userId, googleEmail);

        // Remove all sheets belonging to this Google account (within this store only)
        const userSheets = await sheetRepo.getByStoreAndUser(storeId, userId);
        const sheetsToDelete = userSheets.filter(s => s.googleEmail === googleEmail);
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
