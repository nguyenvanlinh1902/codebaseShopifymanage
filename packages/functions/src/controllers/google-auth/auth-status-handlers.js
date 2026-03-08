import {GoogleAuthRepository} from '../../repositories/googleAuthRepository.js';

const authRepo = new GoogleAuthRepository();

/**
 * GET /api/google/status
 * Check if any valid Google auth exists
 */
export async function checkGoogleAuth(req, res) {
  try {
    const allRecords = await authRepo.getAll();
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
