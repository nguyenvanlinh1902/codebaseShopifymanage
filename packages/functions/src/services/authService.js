import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {AdminUserRepository} from '../repositories/adminUserRepository.js';
import {KeyTokenRepository} from '../repositories/keyTokenRepository.js';
import authConfig from '../config/auth.js';

const adminUserRepo = new AdminUserRepository();
const keyTokenRepo = new KeyTokenRepository();

function createTokenPair(payload) {
  const accessToken = jwt.sign(payload, authConfig.jwtSecret, {
    expiresIn: authConfig.accessTokenExpiry
  });

  const refreshToken = jwt.sign(payload, authConfig.jwtSecret, {
    expiresIn: authConfig.refreshTokenExpiry
  });

  return {accessToken, refreshToken};
}

export async function login(username, password) {
  // 1. Find user
  const user = await adminUserRepo.getByUsername(username);
  if (!user) {
    throw Object.assign(new Error('Invalid username or password'), {statusCode: 401});
  }

  // 2. Check status
  if (user.status !== 'active') {
    throw Object.assign(new Error('Account is inactive'), {statusCode: 403});
  }

  // 3. Compare password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw Object.assign(new Error('Invalid username or password'), {statusCode: 401});
  }

  // 4. Ensure linhnv is always admin
  if (user.username === 'linhnv' && user.role !== 'admin') {
    user.role = 'admin';
    await adminUserRepo.update(user.id, {role: 'admin'});
  }

  // 5. Create tokens
  const tokens = createTokenPair({userId: user.id, username: user.username, role: user.role});

  // 5. Store refresh token
  await keyTokenRepo.createOrUpdate(user.id, tokens.refreshToken);

  return {
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      assignedStores: user.assignedStores || [],
      allowedFeatures: user.allowedFeatures ?? null
    },
    tokens
  };
}

export async function logout(userId) {
  await keyTokenRepo.deleteByUserId(userId);
  return {message: 'Logged out successfully'};
}

export async function handleRefreshToken(refreshToken) {
  // 1. Reuse detection
  const usedTokenDoc = await keyTokenRepo.findByRefreshTokenUsed(refreshToken);
  if (usedTokenDoc) {
    await keyTokenRepo.deleteById(usedTokenDoc.id);
    throw Object.assign(new Error('Token reuse detected. Please login again.'), {statusCode: 403});
  }

  // 2. Find current valid token
  const keyToken = await keyTokenRepo.findByRefreshToken(refreshToken);
  if (!keyToken) {
    throw Object.assign(new Error('Invalid refresh token'), {statusCode: 401});
  }

  // 3. Verify JWT
  let decoded;
  try {
    decoded = jwt.verify(refreshToken, authConfig.jwtSecret);
  } catch (err) {
    await keyTokenRepo.deleteById(keyToken.id);
    throw Object.assign(new Error('Refresh token expired. Please login again.'), {statusCode: 401});
  }

  // 4. Create new token pair — preserve role across rotation
  //    Fallback: fetch user from DB if role missing in legacy tokens
  let role = decoded.role;
  if (!role) {
    const user = await adminUserRepo.getById(decoded.userId);
    role = user?.role || 'staff';
  }
  const newTokens = createTokenPair({
    userId: decoded.userId,
    username: decoded.username,
    role
  });

  // 5. Rotate tokens
  await keyTokenRepo.updateRefreshToken(keyToken.id, newTokens.refreshToken, refreshToken);

  return {
    user: {userId: decoded.userId, username: decoded.username},
    tokens: newTokens
  };
}
