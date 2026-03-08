import jwt from 'jsonwebtoken';
import {KeyTokenRepository} from '../repositories/keyTokenRepository.js';
import authConfig from '../config/auth.js';

const keyTokenRepo = new KeyTokenRepository();

const HEADERS = {
  CLIENT_ID: 'x-client-id',
  AUTHORIZATION: 'authorization'
};

export async function authentication(req, res, next) {
  try {
    // 1. Check client ID
    const userId = req.headers[HEADERS.CLIENT_ID];
    if (!userId) {
      return res.status(401).json({success: false, error: 'Missing x-client-id header'});
    }

    // 2. Check key token exists (user is logged in)
    const keyToken = await keyTokenRepo.getByUserId(userId);
    if (!keyToken) {
      return res.status(401).json({success: false, error: 'Not authenticated'});
    }

    // 3. Extract and verify access token
    const authHeader = req.headers[HEADERS.AUTHORIZATION];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({success: false, error: 'Missing authorization header'});
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(accessToken, authConfig.jwtSecret);

    // 4. Cross-check userId
    if (decoded.userId !== userId) {
      return res.status(401).json({success: false, error: 'Invalid token'});
    }

    // 5. Attach to request
    req.userId = decoded.userId;
    req.username = decoded.username;
    req.userRole = decoded.role || 'staff';
    req.keyToken = keyToken;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Access token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({success: false, error: 'Invalid token'});
    }
    return res.status(500).json({success: false, error: 'Authentication error'});
  }
}
