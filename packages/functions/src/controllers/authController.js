import bcrypt from 'bcryptjs';
import * as authService from '../services/authService.js';
import {AdminUserRepository} from '../repositories/adminUserRepository.js';

const adminUserRepo = new AdminUserRepository();

export async function login(req, res) {
  try {
    const {username, password} = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    const result = await authService.login(username, password);

    return res.json({
      success: true,
      data: {
        id: result.user.id,
        username: result.user.username,
        displayName: result.user.displayName,
        role: result.user.role,
        assignedStores: result.user.assignedStores || [],
        allowedFeatures: result.user.allowedFeatures ?? null, // null = not configured (all allowed); [] = explicitly none
        token: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * POST /api/auth/setup — create initial admin user if no users exist.
 * One-time setup endpoint. Disabled once any user exists.
 */
export async function setupAdmin(req, res) {
  try {
    const existing = await adminUserRepo.getAll();
    if (existing.length > 0) {
      return res.status(403).json({success: false, error: 'Setup already completed'});
    }

    const {username = 'admin', password, displayName = 'Admin'} = req.body;
    if (!password) {
      return res.status(400).json({success: false, error: 'password is required'});
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await adminUserRepo.create({
      username,
      password: hashedPassword,
      displayName,
      role: 'admin',
      assignedStores: [],
      status: 'active'
    });

    return res.status(201).json({
      success: true,
      message: 'Admin user created. This endpoint is now disabled.',
      data: {id: user.id, username: user.username, role: user.role}
    });
  } catch (error) {
    console.error('setupAdmin error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

export async function logout(req, res) {
  try {
    await authService.logout(req.userId);
    return res.json({success: true, message: 'Logged out successfully'});
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

export async function refreshToken(req, res) {
  try {
    const {refreshToken: token} = req.body;

    if (!token) {
      return res.status(400).json({success: false, error: 'Refresh token is required'});
    }

    const result = await authService.handleRefreshToken(token);

    return res.json({
      success: true,
      data: {
        username: result.user.username,
        token: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken
      }
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message
    });
  }
}
