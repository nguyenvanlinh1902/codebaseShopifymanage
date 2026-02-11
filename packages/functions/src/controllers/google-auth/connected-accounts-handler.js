import {GoogleAuthRepository} from '../../repositories/googleAuthRepository.js';
import {SheetRepository} from '../../repositories/sheetRepository.js';

const authRepo = new GoogleAuthRepository();
const sheetRepo = new SheetRepository();

/**
 * GET /api/google/connected-accounts
 * Get paginated list of connected Google accounts with sheet counts
 * SECURITY: Now requires storeId for proper data isolation
 */
export async function getConnectedAccounts(req, res) {
  try {
    const {userId, page, limit, search, storeId} = req.query;

    if (!userId) {
      return res.status(400).json({success: false, error: 'userId is required'});
    }

    const isStandalone = userId === 'default-user';

    if (!isStandalone && !storeId) {
      return res.status(400).json({success: false, error: 'storeId is required for security'});
    }

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 5));

    // Build accounts map
    const accountMap = new Map();

    if (isStandalone && !storeId) {
      // Standalone mode: get all sheets and extract unique google emails
      const allSheets = await sheetRepo.getAll();
      allSheets.forEach(sheet => {
        if (!sheet.googleEmail) return;
        if (accountMap.has(sheet.googleEmail)) {
          accountMap.get(sheet.googleEmail).sheetCount++;
        } else {
          accountMap.set(sheet.googleEmail, {email: sheet.googleEmail, sheetCount: 1});
        }
      });
    } else {
      // Store-scoped mode
      const allAuthRecords = await authRepo.getAllByStoreAndUser(storeId, userId);
      allAuthRecords.forEach(record => {
        if (record.googleEmail) {
          accountMap.set(record.googleEmail, {email: record.googleEmail, sheetCount: 0});
        }
      });

      const userSheets = await sheetRepo.getByStoreAndUser(storeId, userId);
      userSheets.forEach(sheet => {
        if (!sheet.googleEmail) return;
        if (accountMap.has(sheet.googleEmail)) {
          accountMap.get(sheet.googleEmail).sheetCount++;
        } else {
          accountMap.set(sheet.googleEmail, {email: sheet.googleEmail, sheetCount: 1});
        }
      });
    }

    let filteredAccounts = Array.from(accountMap.values());

    if (search) {
      const searchLower = search.toLowerCase();
      filteredAccounts = filteredAccounts.filter(a => a.email.toLowerCase().includes(searchLower));
    }

    const total = filteredAccounts.length;
    const offset = (pageNum - 1) * limitNum;
    const accounts = filteredAccounts.slice(offset, offset + limitNum);

    return res.json({
      success: true,
      data: accounts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get connected accounts error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}
