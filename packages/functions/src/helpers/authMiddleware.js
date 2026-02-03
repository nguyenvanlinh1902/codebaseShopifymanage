import {verifyToken} from '@functions/services/authService';
import * as userRepository from '@functions/repositories/userRepository';
import * as organizationRepository from '@functions/repositories/organizationRepository';

/**
 * JWT authentication middleware for Koa
 * Extracts and validates JWT from Authorization header
 *
 * @returns {Function} Koa middleware
 */
export function jwtAuth() {
  return async (ctx, next) => {
    const authHeader = ctx.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      ctx.status = 401;
      ctx.body = {success: false, error: 'Missing or invalid authorization header'};
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const {valid, decoded, error} = verifyToken(token);

    if (!valid) {
      ctx.status = 401;
      ctx.body = {success: false, error: 'Invalid token: ' + error};
      return;
    }

    // Load user and organization
    const user = await userRepository.getById(decoded.userId);

    if (!user) {
      ctx.status = 401;
      ctx.body = {success: false, error: 'User not found'};
      return;
    }

    if (user.status !== 'active') {
      ctx.status = 401;
      ctx.body = {success: false, error: 'Account is deactivated'};
      return;
    }

    const organization = await organizationRepository.getById(decoded.organizationId);

    if (!organization) {
      ctx.status = 401;
      ctx.body = {success: false, error: 'Organization not found'};
      return;
    }

    // Set user context
    ctx.state.chattyUser = user;
    ctx.state.chattyOrganization = organization;
    ctx.state.chattyAuth = {
      userId: user.id,
      organizationId: organization.id,
      role: user.role
    };

    await next();
  };
}

/**
 * Role-based authorization middleware
 * Must be used after jwtAuth()
 *
 * @param {...string} allowedRoles - Roles allowed to access the route
 * @returns {Function} Koa middleware
 */
export function requireRole(...allowedRoles) {
  return async (ctx, next) => {
    const user = ctx.state.chattyUser;

    if (!user) {
      ctx.status = 401;
      ctx.body = {success: false, error: 'Authentication required'};
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      ctx.status = 403;
      ctx.body = {success: false, error: 'Insufficient permissions'};
      return;
    }

    await next();
  };
}

/**
 * Admin-only middleware (owner or admin role)
 *
 * @returns {Function} Koa middleware
 */
export function requireAdmin() {
  return requireRole('owner', 'admin');
}

/**
 * Owner-only middleware
 *
 * @returns {Function} Koa middleware
 */
export function requireOwner() {
  return requireRole('owner');
}

/**
 * Get current authenticated user from context
 *
 * @param {Object} ctx - Koa context
 * @returns {User}
 */
export function getCurrentUser(ctx) {
  return ctx.state.chattyUser;
}

/**
 * Get current organization from context
 *
 * @param {Object} ctx - Koa context
 * @returns {Organization}
 */
export function getCurrentOrganization(ctx) {
  return ctx.state.chattyOrganization;
}

/**
 * Get current user ID from context
 *
 * @param {Object} ctx - Koa context
 * @returns {string}
 */
export function getCurrentUserId(ctx) {
  return ctx.state.chattyAuth?.userId;
}

/**
 * Get current organization ID from context
 *
 * @param {Object} ctx - Koa context
 * @returns {string}
 */
export function getCurrentOrganizationId(ctx) {
  return ctx.state.chattyAuth?.organizationId;
}

/**
 * Check if current user has admin role
 *
 * @param {Object} ctx - Koa context
 * @returns {boolean}
 */
export function isAdmin(ctx) {
  const role = ctx.state.chattyAuth?.role;
  return role === 'owner' || role === 'admin';
}

/**
 * Check if current user is owner
 *
 * @param {Object} ctx - Koa context
 * @returns {boolean}
 */
export function isOwner(ctx) {
  return ctx.state.chattyAuth?.role === 'owner';
}

/**
 * Optional authentication middleware
 * Doesn't fail if no auth header, just sets user to null
 *
 * @returns {Function} Koa middleware
 */
export function optionalAuth() {
  return async (ctx, next) => {
    const authHeader = ctx.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const {valid, decoded} = verifyToken(token);

      if (valid) {
        const user = await userRepository.getById(decoded.userId);
        if (user && user.status === 'active') {
          const organization = await organizationRepository.getById(decoded.organizationId);
          if (organization) {
            ctx.state.chattyUser = user;
            ctx.state.chattyOrganization = organization;
            ctx.state.chattyAuth = {
              userId: user.id,
              organizationId: organization.id,
              role: user.role
            };
          }
        }
      }
    }

    await next();
  };
}
