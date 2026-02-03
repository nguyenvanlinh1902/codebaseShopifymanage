import Router from 'koa-router';
import * as tagService from '@functions/services/tagService';
import {getCurrentOrganizationId, requireAdmin} from '@functions/helpers/authMiddleware';

const router = new Router({prefix: '/tags'});

/**
 * GET /tags
 * List all tags
 */
router.get('/', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const tags = await tagService.listTags(organizationId);

    ctx.body = {success: true, data: tags};
  } catch (error) {
    ctx.status = 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * GET /tags/:id
 * Get single tag
 */
router.get('/:id', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const {id} = ctx.params;

    const tag = await tagService.getTag(id, organizationId);

    ctx.body = {success: true, data: tag};
  } catch (error) {
    ctx.status = error.message === 'Tag not found' ? 404 : 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * POST /tags
 * Create new tag
 */
router.post('/', requireAdmin(), async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const {name, color} = ctx.req.body;

    if (!name) {
      ctx.status = 400;
      ctx.body = {success: false, error: 'Tag name is required'};
      return;
    }

    const tag = await tagService.createTag({organizationId, name, color});

    ctx.status = 201;
    ctx.body = {success: true, data: tag};
  } catch (error) {
    ctx.status = error.message.includes('already exists') ? 409 : 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * PATCH /tags/:id
 * Update tag
 */
router.patch('/:id', requireAdmin(), async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const {id} = ctx.params;
    const {name, color} = ctx.req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;

    const tag = await tagService.updateTag(id, organizationId, updateData);

    ctx.body = {success: true, data: tag};
  } catch (error) {
    ctx.status = error.message === 'Tag not found' ? 404 : 400;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * DELETE /tags/:id
 * Delete tag
 */
router.delete('/:id', requireAdmin(), async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const {id} = ctx.params;

    await tagService.deleteTag(id, organizationId);

    ctx.body = {success: true, message: 'Tag deleted'};
  } catch (error) {
    ctx.status = error.message === 'Tag not found' ? 404 : 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * POST /tags/:id/merge
 * Merge tag into another
 */
router.post('/:id/merge', requireAdmin(), async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const {id} = ctx.params;
    const {targetId} = ctx.req.body;

    if (!targetId) {
      ctx.status = 400;
      ctx.body = {success: false, error: 'targetId is required'};
      return;
    }

    const tag = await tagService.mergeTags(id, targetId, organizationId);

    ctx.body = {success: true, data: tag};
  } catch (error) {
    ctx.status = error.message.includes('not found') ? 404 : 400;
    ctx.body = {success: false, error: error.message};
  }
});

export default router;
