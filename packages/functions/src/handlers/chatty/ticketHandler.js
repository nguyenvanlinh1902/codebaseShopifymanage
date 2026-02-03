import Router from 'koa-router';
import * as ticketService from '@functions/services/ticketService';
import {getCurrentUserId, getCurrentOrganizationId} from '@functions/helpers/authMiddleware';

const router = new Router({prefix: '/tickets'});

/**
 * GET /tickets
 * List tickets with filters and pagination
 */
router.get('/', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const {status, priority, assigneeId, tagId, limit, after, before, hasCount, order} = ctx.query;

    const filters = {};
    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (assigneeId) filters.assigneeId = assigneeId;
    if (tagId) filters.tagId = tagId;

    const query = {
      limit: parseInt(limit) || 20,
      after,
      before,
      hasCount: hasCount === 'true',
      order: order || 'lastMessageAt_desc'
    };

    const result = await ticketService.listTickets({organizationId, filters, query});

    ctx.body = {
      success: true,
      data: result.data,
      count: result.count,
      total: result.total,
      pageInfo: result.pageInfo
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * GET /tickets/counts
 * Get ticket counts by status
 */
router.get('/counts', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const counts = await ticketService.getTicketCounts(organizationId);

    ctx.body = {success: true, data: counts};
  } catch (error) {
    ctx.status = 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * GET /tickets/workload
 * Get agent workload
 */
router.get('/workload', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const workload = await ticketService.getAgentWorkload(organizationId);

    ctx.body = {success: true, data: workload};
  } catch (error) {
    ctx.status = 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * GET /tickets/search
 * Search tickets
 */
router.get('/search', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const {q, limit} = ctx.query;

    if (!q || q.trim().length < 2) {
      ctx.body = {success: true, data: []};
      return;
    }

    const tickets = await ticketService.searchTickets(organizationId, q, parseInt(limit) || 20);

    ctx.body = {success: true, data: tickets};
  } catch (error) {
    ctx.status = 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * GET /tickets/:id
 * Get single ticket with details
 */
router.get('/:id', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const {id} = ctx.params;

    const result = await ticketService.getTicketWithDetails(id, organizationId);

    ctx.body = {success: true, data: result};
  } catch (error) {
    ctx.status = error.message === 'Ticket not found' ? 404 : 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * POST /tickets
 * Create a new ticket manually
 */
router.post('/', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const userId = getCurrentUserId(ctx);
    const {subject, customerEmail, customerName, content, contentHtml} = ctx.req.body;

    // Validate required fields
    if (!subject || !customerEmail || !customerName || !content) {
      ctx.status = 400;
      ctx.body = {success: false, error: 'Missing required fields: subject, customerEmail, customerName, content'};
      return;
    }

    const result = await ticketService.createTicket({
      organizationId,
      userId,
      subject,
      customerEmail,
      customerName,
      content,
      contentHtml,
      channel: 'manual'
    });

    ctx.status = 201;
    ctx.body = {success: true, data: result};
  } catch (error) {
    ctx.status = 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * PATCH /tickets/:id
 * Update ticket (status, priority, assignee)
 */
router.patch('/:id', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const userId = getCurrentUserId(ctx);
    const {id} = ctx.params;
    const {status, priority, assigneeId} = ctx.req.body;

    let ticket = await ticketService.getTicket(id, organizationId);

    // Update status if provided
    if (status && status !== ticket.status) {
      ticket = await ticketService.changeStatus(id, organizationId, userId, status);
    }

    // Update priority if provided
    if (priority && priority !== ticket.priority) {
      ticket = await ticketService.changePriority(id, organizationId, userId, priority);
    }

    // Update assignee if provided (can be null to unassign)
    if (assigneeId !== undefined && assigneeId !== ticket.assigneeId) {
      ticket = await ticketService.assignTicket(id, organizationId, userId, assigneeId);
    }

    ctx.body = {success: true, data: ticket};
  } catch (error) {
    ctx.status = error.message === 'Ticket not found' ? 404 : 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * POST /tickets/:id/messages
 * Add a reply or note to ticket
 */
router.post('/:id/messages', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const userId = getCurrentUserId(ctx);
    const {id} = ctx.params;
    const {content, contentHtml, isInternal} = ctx.req.body;

    if (!content) {
      ctx.status = 400;
      ctx.body = {success: false, error: 'Content is required'};
      return;
    }

    let result;
    if (isInternal) {
      result = await ticketService.addInternalNote({
        ticketId: id,
        organizationId,
        userId,
        content
      });
    } else {
      result = await ticketService.replyToTicket({
        ticketId: id,
        organizationId,
        userId,
        content,
        contentHtml
      });
    }

    ctx.status = 201;
    ctx.body = {success: true, data: result};
  } catch (error) {
    ctx.status = error.message === 'Ticket not found' ? 404 : 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * POST /tickets/:id/tags
 * Add tag to ticket
 */
router.post('/:id/tags', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const userId = getCurrentUserId(ctx);
    const {id} = ctx.params;
    const {tagId} = ctx.req.body;

    if (!tagId) {
      ctx.status = 400;
      ctx.body = {success: false, error: 'tagId is required'};
      return;
    }

    const ticket = await ticketService.addTag(id, organizationId, userId, tagId);

    ctx.body = {success: true, data: ticket};
  } catch (error) {
    ctx.status = error.message === 'Ticket not found' ? 404 : 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * DELETE /tickets/:id/tags/:tagId
 * Remove tag from ticket
 */
router.delete('/:id/tags/:tagId', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const userId = getCurrentUserId(ctx);
    const {id, tagId} = ctx.params;

    const ticket = await ticketService.removeTag(id, organizationId, userId, tagId);

    ctx.body = {success: true, data: ticket};
  } catch (error) {
    ctx.status = error.message === 'Ticket not found' ? 404 : 500;
    ctx.body = {success: false, error: error.message};
  }
});

export default router;
