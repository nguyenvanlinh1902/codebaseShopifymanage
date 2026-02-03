import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as userRepository from '@functions/repositories/userRepository';
import * as organizationRepository from '@functions/repositories/organizationRepository';
import * as invitationRepository from '@functions/repositories/invitationRepository';
import {generateResetToken, hashValue} from '@functions/helpers/encryption';

const BCRYPT_COST = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'chatty-jwt-secret-change-in-production';
const JWT_EXPIRY = '24h';
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Hash a password using bcrypt
 *
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * Verify a password against a hash
 *
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT access token
 *
 * @param {User} user - User object
 * @returns {string} JWT token
 */
export function generateAccessToken(user) {
  const payload = {
    userId: user.id,
    organizationId: user.organizationId,
    email: user.email,
    role: user.role
  };

  return jwt.sign(payload, JWT_SECRET, {expiresIn: JWT_EXPIRY});
}

/**
 * Generate refresh token
 *
 * @param {User} user - User object
 * @returns {string} JWT refresh token
 */
export function generateRefreshToken(user) {
  const payload = {
    userId: user.id,
    type: 'refresh'
  };

  return jwt.sign(payload, JWT_SECRET, {expiresIn: REFRESH_TOKEN_EXPIRY});
}

/**
 * Verify and decode JWT token
 *
 * @param {string} token - JWT token
 * @returns {{valid: boolean, decoded: Object|null, error: string|null}}
 */
export function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return {valid: true, decoded, error: null};
  } catch (error) {
    return {valid: false, decoded: null, error: error.message};
  }
}

/**
 * Register a new user (first user becomes owner)
 *
 * @param {Object} data - Registration data
 * @param {string} data.email - User email
 * @param {string} data.password - User password
 * @param {string} data.name - User name
 * @param {string} data.organizationName - Organization name
 * @param {string} data.shopifyDomain - Shopify store domain
 * @param {string} data.shopId - Shop ID from shops collection
 * @returns {Promise<{user: User, organization: Organization, accessToken: string, refreshToken: string}>}
 */
export async function register(data) {
  // Check if user already exists
  const existingUser = await userRepository.getByEmailGlobal(data.email);
  if (existingUser) {
    throw new Error('Email already registered');
  }

  // Generate unique email address for inbound emails
  const emailAddress = generateInboundEmailAddress(data.shopifyDomain);

  // Create organization
  const organization = await organizationRepository.create({
    name: data.organizationName,
    shopifyDomain: data.shopifyDomain,
    shopId: data.shopId,
    emailAddress
  });

  // Hash password
  const passwordHash = await hashPassword(data.password);

  // Create user as owner
  const user = await userRepository.create({
    organizationId: organization.id,
    email: data.email,
    passwordHash,
    name: data.name,
    role: 'owner',
    status: 'active'
  });

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Update last login
  await userRepository.updateLastLogin(user.id);

  return {user, organization, accessToken, refreshToken};
}

/**
 * Login user with email and password
 *
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<{user: User, organization: Organization, accessToken: string, refreshToken: string}>}
 */
export async function login(email, password) {
  // Find user
  const user = await userRepository.getByEmailGlobal(email);
  if (!user) {
    throw new Error('Invalid email or password');
  }

  // Check if user is active
  if (user.status !== 'active') {
    throw new Error('Account is deactivated');
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new Error('Invalid email or password');
  }

  // Get organization
  const organization = await organizationRepository.getById(user.organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Update last login
  await userRepository.updateLastLogin(user.id);

  return {user, organization, accessToken, refreshToken};
}

/**
 * Refresh access token using refresh token
 *
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 */
export async function refreshAccessToken(refreshToken) {
  const {valid, decoded, error} = verifyToken(refreshToken);

  if (!valid) {
    throw new Error('Invalid refresh token: ' + error);
  }

  if (decoded.type !== 'refresh') {
    throw new Error('Invalid token type');
  }

  // Get user
  const user = await userRepository.getById(decoded.userId);
  if (!user || user.status !== 'active') {
    throw new Error('User not found or inactive');
  }

  // Generate new tokens
  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  return {accessToken: newAccessToken, refreshToken: newRefreshToken};
}

/**
 * Request password reset
 *
 * @param {string} email - User email
 * @returns {Promise<{resetToken: string, expiresAt: Date}>}
 */
export async function requestPasswordReset(email) {
  const user = await userRepository.getByEmailGlobal(email);
  if (!user) {
    // Don't reveal if email exists
    return {resetToken: null, expiresAt: null};
  }

  // Generate reset token
  const resetToken = generateResetToken();
  const resetTokenHash = hashValue(resetToken);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

  // Store reset token in user record (would be better in separate collection for production)
  // For MVP, we'll store it with the user
  await userRepository.update(user.id, {
    resetTokenHash,
    resetTokenExpiresAt: expiresAt
  });

  return {resetToken, expiresAt, userId: user.id, email: user.email};
}

/**
 * Reset password using reset token
 *
 * @param {string} resetToken - Reset token
 * @param {string} newPassword - New password
 * @returns {Promise<{success: boolean}>}
 */
export async function resetPassword(resetToken, newPassword) {
  const resetTokenHash = hashValue(resetToken);

  // Find user with this reset token
  // In production, use a separate password_resets collection with proper indexing
  // For MVP, this is a simplified approach
  const user = await findUserByResetToken(resetTokenHash);

  if (!user) {
    throw new Error('Invalid or expired reset token');
  }

  // Check if token is expired
  const expiresAt = new Date(user.resetTokenExpiresAt);
  if (expiresAt < new Date()) {
    throw new Error('Reset token has expired');
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update password and clear reset token
  await userRepository.updatePassword(user.id, passwordHash);
  await userRepository.update(user.id, {
    resetTokenHash: null,
    resetTokenExpiresAt: null
  });

  return {success: true};
}

/**
 * Find user by reset token hash
 * Note: In production, use a separate collection with proper indexing
 *
 * @param {string} resetTokenHash - Hashed reset token
 * @returns {Promise<User|null>}
 * @private
 */
async function findUserByResetToken(resetTokenHash) {
  // This is a simplified implementation
  // In production, use Firestore query on resetTokenHash field
  // For now, we'd need to add this to the user repository
  // Returning null for MVP - implement properly when needed
  return null;
}

/**
 * Accept invitation and create user
 *
 * @param {string} invitationToken - Invitation token
 * @param {string} password - User password
 * @param {string} name - User name
 * @returns {Promise<{user: User, organization: Organization, accessToken: string, refreshToken: string}>}
 */
export async function acceptInvitation(invitationToken, password, name) {
  // Validate invitation
  const {valid, invitation, error} = await invitationRepository.validateToken(invitationToken);

  if (!valid) {
    throw new Error(error);
  }

  // Get organization
  const organization = await organizationRepository.getById(invitation.organizationId);
  if (!organization) {
    throw new Error('Organization not found');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const user = await userRepository.create({
    organizationId: invitation.organizationId,
    email: invitation.email,
    passwordHash,
    name,
    role: invitation.role,
    status: 'active'
  });

  // Mark invitation as accepted
  await invitationRepository.markAccepted(invitation.id);

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Update last login
  await userRepository.updateLastLogin(user.id);

  return {user, organization, accessToken, refreshToken};
}

/**
 * Change user password
 *
 * @param {string} userId - User ID
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<{success: boolean}>}
 */
export async function changePassword(userId, currentPassword, newPassword) {
  const user = await userRepository.getById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Verify current password
  const isValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }

  // Hash and update new password
  const passwordHash = await hashPassword(newPassword);
  await userRepository.updatePassword(userId, passwordHash);

  return {success: true};
}

/**
 * Get current user with organization
 *
 * @param {string} userId - User ID
 * @returns {Promise<{user: User, organization: Organization}>}
 */
export async function getCurrentUser(userId) {
  const user = await userRepository.getById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const organization = await organizationRepository.getById(user.organizationId);

  return {user, organization};
}

/**
 * Generate unique inbound email address for organization
 *
 * @param {string} shopifyDomain - Shopify domain
 * @returns {string}
 */
function generateInboundEmailAddress(shopifyDomain) {
  // Extract store name from domain
  const storeName = shopifyDomain.replace('.myshopify.com', '').toLowerCase();
  const uniqueId = Math.random().toString(36).substring(2, 8);
  return `${storeName}-${uniqueId}@inbound.chatty.io`;
}

/**
 * Validate password strength
 *
 * @param {string} password - Password to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validatePasswordStrength(password) {
  const errors = [];

  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
