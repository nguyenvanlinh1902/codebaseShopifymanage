import {GoogleAuthRepository} from '../../repositories/googleAuthRepository.js';

const authRepo = new GoogleAuthRepository();

/**
 * GET /api/google/status
 * Check if user has any valid Google auth
 * SECURITY: Now requires storeId for proper data isolation
 */
export async function checkGoogleAuth(req, res) {
  try {
    const {userId, storeId} = req.query;

    if (!userId) {
      return res.status(400).json({success: false, error: 'userId is required'});
    }

    if (!storeId) {
      return res.status(400).json({success: false, error: 'storeId is required for security'});
    }

    // SECURITY FIX: Use store-scoped method
    const allRecords = await authRepo.getAllByStoreAndUser(storeId, userId);
    const validRecord = allRecords.find(r => r.refreshToken);

    if (!validRecord) {
      return res.json({success: true, data: {authenticated: false}});
    }

    return res.json({
      success: true,
      data: {
        authenticated: true,
        googleEmail: validRecord.googleEmail
      }
    });
  } catch (error) {
    console.error('Check Google auth error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}
