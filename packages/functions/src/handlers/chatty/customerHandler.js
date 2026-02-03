import Router from 'koa-router';
import * as customerService from '@functions/services/customerService';
import {getCurrentOrganizationId} from '@functions/helpers/authMiddleware';

const router = new Router({prefix: '/customers'});

/**
 * GET /customers
 * List customers with pagination
 */
router.get('/', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const {limit, after, before, hasCount, order} = ctx.query;

    const query = {
      limit: parseInt(limit) || 20,
      after,
      before,
      hasCount: hasCount === 'true',
      order: order || 'createdAt_desc'
    };

    const result = await customerService.listCustomers({organizationId, query});

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
 * GET /customers/search
 * Search customers
 */
router.get('/search', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const {q, limit} = ctx.query;

    if (!q || q.trim().length < 2) {
      ctx.body = {success: true, data: []};
      return;
    }

    const customers = await customerService.searchCustomers(organizationId, q, parseInt(limit) || 20);

    ctx.body = {success: true, data: customers};
  } catch (error) {
    ctx.status = 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * GET /customers/:id
 * Get customer with details
 */
router.get('/:id', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const {id} = ctx.params;

    const result = await customerService.getCustomerWithDetails(id, organizationId);

    ctx.body = {success: true, data: result};
  } catch (error) {
    ctx.status = error.message === 'Customer not found' ? 404 : 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * GET /customers/:id/orders
 * Get customer orders
 */
router.get('/:id/orders', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const {id} = ctx.params;
    const {limit} = ctx.query;

    const orders = await customerService.getCustomerOrders(id, organizationId, parseInt(limit) || 10);

    ctx.body = {success: true, data: orders};
  } catch (error) {
    ctx.status = error.message === 'Customer not found' ? 404 : 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * GET /customers/:id/tickets
 * Get customer tickets
 */
router.get('/:id/tickets', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const {id} = ctx.params;
    const {limit, after, before} = ctx.query;

    const result = await customerService.getCustomerTickets(id, organizationId, {
      limit: parseInt(limit) || 10,
      after,
      before
    });

    ctx.body = {
      success: true,
      data: result.data,
      count: result.count,
      pageInfo: result.pageInfo
    };
  } catch (error) {
    ctx.status = error.message === 'Customer not found' ? 404 : 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * POST /customers/match
 * Match customer by email
 */
router.post('/match', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const {email} = ctx.req.body;

    if (!email) {
      ctx.status = 400;
      ctx.body = {success: false, error: 'Email is required'};
      return;
    }

    const customer = await customerService.matchByEmail(organizationId, email);

    ctx.body = {
      success: true,
      data: customer,
      found: !!customer
    };
  } catch (error) {
    ctx.status = 500;
    ctx.body = {success: false, error: error.message};
  }
});

export default router;
