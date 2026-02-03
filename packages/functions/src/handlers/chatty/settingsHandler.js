import Router from 'koa-router';
import * as settingsService from '@functions/services/settingsService';
import {
  getCurrentUserId,
  getCurrentOrganizationId,
  requireAdmin
} from '@functions/helpers/authMiddleware';

const router = new Router({prefix: '/settings'});

/**
 * GET /settings
 * Get all settings
 */
router.get('/', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const result = await settingsService.getSettings(organizationId);

    ctx.body = {success: true, data: result};
  } catch (error) {
    ctx.status = 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * GET /settings/timezones
 * Get available timezones
 */
router.get('/timezones', async ctx => {
  const timezones = settingsService.getTimezones();
  ctx.body = {success: true, data: timezones};
});

/**
 * GET /settings/shopify
 * Get Shopify connection status
 */
router.get('/shopify', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const status = await settingsService.getShopifyStatus(organizationId);

    ctx.body = {success: true, data: status};
  } catch (error) {
    ctx.status = 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * PATCH /settings/general
 * Update general settings
 */
router.patch('/general', requireAdmin(), async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const {name, timezone} = ctx.req.body;

    const organization = await settingsService.updateGeneralSettings(organizationId, {name, timezone});

    ctx.body = {success: true, data: organization};
  } catch (error) {
    ctx.status = 400;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * PATCH /settings/email
 * Update email settings
 */
router.patch('/email', requireAdmin(), async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const {supportEmailName, emailSignature, replyToEmail} = ctx.req.body;

    const organization = await settingsService.updateEmailSettings(organizationId, {
      supportEmailName,
      emailSignature,
      replyToEmail
    });

    ctx.body = {success: true, data: organization};
  } catch (error) {
    ctx.status = 400;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * PATCH /settings/auto-close
 * Update auto-close settings
 */
router.patch('/auto-close', requireAdmin(), async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const {autoCloseAfterDays} = ctx.req.body;

    if (autoCloseAfterDays === undefined) {
      ctx.status = 400;
      ctx.body = {success: false, error: 'autoCloseAfterDays is required'};
      return;
    }

    const organization = await settingsService.updateAutoCloseSettings(organizationId, parseInt(autoCloseAfterDays));

    ctx.body = {success: true, data: organization};
  } catch (error) {
    ctx.status = 400;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * GET /settings/profile
 * Get current user profile
 */
router.get('/profile', async ctx => {
  try {
    const user = ctx.state.chattyUser;
    const {passwordHash, ...userData} = user;

    ctx.body = {success: true, data: userData};
  } catch (error) {
    ctx.status = 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * PATCH /settings/profile
 * Update current user profile
 */
router.patch('/profile', async ctx => {
  try {
    const userId = getCurrentUserId(ctx);
    const {name, avatarUrl} = ctx.req.body;

    const user = await settingsService.updateUserProfile(userId, {name, avatarUrl});

    const {passwordHash, ...userData} = user;

    ctx.body = {success: true, data: userData};
  } catch (error) {
    ctx.status = 400;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * PATCH /settings/notifications
 * Update notification preferences
 */
router.patch('/notifications', async ctx => {
  try {
    const userId = getCurrentUserId(ctx);
    const {emailOnAssignment, emailOnCustomerReply} = ctx.req.body;

    const preferences = {};
    if (emailOnAssignment !== undefined) preferences.emailOnAssignment = emailOnAssignment;
    if (emailOnCustomerReply !== undefined) preferences.emailOnCustomerReply = emailOnCustomerReply;

    const user = await settingsService.updateNotificationPreferences(userId, preferences);

    const {passwordHash, ...userData} = user;

    ctx.body = {success: true, data: userData};
  } catch (error) {
    ctx.status = 400;
    ctx.body = {success: false, error: error.message};
  }
});

export default router;
