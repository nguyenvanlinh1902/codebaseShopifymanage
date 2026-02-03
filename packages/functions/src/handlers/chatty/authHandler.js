import Router from 'koa-router';
import * as authService from '@functions/services/authService';
import {getCurrentUserId} from '@functions/helpers/authMiddleware';

const router = new Router({prefix: '/auth'});

/**
 * POST /auth/register
 * Register new user and organization
 */
router.post('/register', async ctx => {
  try {
    const {email, password, name, organizationName, shopifyDomain, shopId} = ctx.req.body;

    // Validate required fields
    if (!email || !password || !name || !organizationName) {
      ctx.status = 400;
      ctx.body = {success: false, error: 'Missing required fields: email, password, name, organizationName'};
      return;
    }

    // Validate password strength
    const passwordValidation = authService.validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      ctx.status = 400;
      ctx.body = {success: false, error: passwordValidation.errors.join('. ')};
      return;
    }

    const result = await authService.register({
      email,
      password,
      name,
      organizationName,
      shopifyDomain: shopifyDomain || '',
      shopId: shopId || ''
    });

    // Don't return password hash
    const {passwordHash, ...userData} = result.user;

    ctx.status = 201;
    ctx.body = {
      success: true,
      data: {
        user: userData,
        organization: result.organization,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      }
    };
  } catch (error) {
    ctx.status = error.message === 'Email already registered' ? 409 : 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * POST /auth/login
 * Login with email and password
 */
router.post('/login', async ctx => {
  try {
    const {email, password} = ctx.req.body;

    if (!email || !password) {
      ctx.status = 400;
      ctx.body = {success: false, error: 'Email and password are required'};
      return;
    }

    const result = await authService.login(email, password);

    // Don't return password hash
    const {passwordHash, ...userData} = result.user;

    ctx.body = {
      success: true,
      data: {
        user: userData,
        organization: result.organization,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      }
    };
  } catch (error) {
    ctx.status = 401;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * POST /auth/refresh
 * Refresh access token
 */
router.post('/refresh', async ctx => {
  try {
    const {refreshToken} = ctx.req.body;

    if (!refreshToken) {
      ctx.status = 400;
      ctx.body = {success: false, error: 'Refresh token is required'};
      return;
    }

    const result = await authService.refreshAccessToken(refreshToken);

    ctx.body = {
      success: true,
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      }
    };
  } catch (error) {
    ctx.status = 401;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * POST /auth/forgot-password
 * Request password reset
 */
router.post('/forgot-password', async ctx => {
  try {
    const {email} = ctx.req.body;

    if (!email) {
      ctx.status = 400;
      ctx.body = {success: false, error: 'Email is required'};
      return;
    }

    const result = await authService.requestPasswordReset(email);

    // Always return success to not reveal if email exists
    // In production, send email with reset link
    ctx.body = {
      success: true,
      message: 'If the email exists, a password reset link has been sent'
    };

    // TODO: Send email with reset link
    // The result contains resetToken, expiresAt, userId, email if user exists
  } catch (error) {
    ctx.status = 500;
    ctx.body = {success: false, error: 'Failed to process request'};
  }
});

/**
 * POST /auth/reset-password
 * Reset password using token
 */
router.post('/reset-password', async ctx => {
  try {
    const {token, newPassword} = ctx.req.body;

    if (!token || !newPassword) {
      ctx.status = 400;
      ctx.body = {success: false, error: 'Token and new password are required'};
      return;
    }

    // Validate password strength
    const passwordValidation = authService.validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      ctx.status = 400;
      ctx.body = {success: false, error: passwordValidation.errors.join('. ')};
      return;
    }

    await authService.resetPassword(token, newPassword);

    ctx.body = {success: true, message: 'Password has been reset successfully'};
  } catch (error) {
    ctx.status = 400;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * POST /auth/change-password
 * Change password (authenticated)
 */
router.post('/change-password', async ctx => {
  try {
    const userId = getCurrentUserId(ctx);
    if (!userId) {
      ctx.status = 401;
      ctx.body = {success: false, error: 'Authentication required'};
      return;
    }

    const {currentPassword, newPassword} = ctx.req.body;

    if (!currentPassword || !newPassword) {
      ctx.status = 400;
      ctx.body = {success: false, error: 'Current password and new password are required'};
      return;
    }

    // Validate password strength
    const passwordValidation = authService.validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      ctx.status = 400;
      ctx.body = {success: false, error: passwordValidation.errors.join('. ')};
      return;
    }

    await authService.changePassword(userId, currentPassword, newPassword);

    ctx.body = {success: true, message: 'Password changed successfully'};
  } catch (error) {
    ctx.status = 400;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * GET /auth/me
 * Get current user
 */
router.get('/me', async ctx => {
  try {
    const userId = getCurrentUserId(ctx);
    if (!userId) {
      ctx.status = 401;
      ctx.body = {success: false, error: 'Authentication required'};
      return;
    }

    const result = await authService.getCurrentUser(userId);

    // Don't return password hash
    const {passwordHash, ...userData} = result.user;

    ctx.body = {
      success: true,
      data: {
        user: userData,
        organization: result.organization
      }
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * POST /auth/accept-invitation
 * Accept invitation and create user
 */
router.post('/accept-invitation', async ctx => {
  try {
    const {token, password, name} = ctx.req.body;

    if (!token || !password || !name) {
      ctx.status = 400;
      ctx.body = {success: false, error: 'Token, password, and name are required'};
      return;
    }

    // Validate password strength
    const passwordValidation = authService.validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      ctx.status = 400;
      ctx.body = {success: false, error: passwordValidation.errors.join('. ')};
      return;
    }

    const result = await authService.acceptInvitation(token, password, name);

    // Don't return password hash
    const {passwordHash, ...userData} = result.user;

    ctx.status = 201;
    ctx.body = {
      success: true,
      data: {
        user: userData,
        organization: result.organization,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      }
    };
  } catch (error) {
    ctx.status = 400;
    ctx.body = {success: false, error: error.message};
  }
});

export default router;
