import {GoogleAuthRepository} from '../../repositories/googleAuthRepository.js';
import {SheetRepository} from '../../repositories/sheetRepository.js';

const authRepo = new GoogleAuthRepository();
const sheetRepo = new SheetRepository();

/**
 * GET /api/google/connected-accounts
 * Get paginated list of ALL connected Google accounts with sheet counts
 */
export async function getConnectedAccounts(req, res) {
  try {
    const {page, limit, search} = req.query;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 5));

    // Build accounts map from auth records + sheets
    const accountMap = new Map();

    const allAuthRecords = await authRepo.getAll();
    allAuthRecords.forEach(record => {
      if (record.googleEmail) {
        accountMap.set(record.googleEmail, {email: record.googleEmail, sheetCount: 0});
      }
    });

    const allSheets = await sheetRepo.getAll();
    allSheets.forEach(sheet => {
      if (!sheet.googleEmail) return;
      if (accountMap.has(sheet.googleEmail)) {
        accountMap.get(sheet.googleEmail).sheetCount++;
      } else {
        accountMap.set(sheet.googleEmail, {email: sheet.googleEmail, sheetCount: 1});
      }
    });

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
