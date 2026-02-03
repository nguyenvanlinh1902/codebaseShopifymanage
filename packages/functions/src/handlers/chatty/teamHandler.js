import Router from 'koa-router';
import * as teamService from '@functions/services/teamService';
import {
  getCurrentUserId,
  getCurrentOrganizationId,
  requireAdmin
} from '@functions/helpers/authMiddleware';

const router = new Router({prefix: '/team'});

/**
 * GET /team
 * List team members
 */
router.get('/', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const {status, limit, after, before, hasCount} = ctx.query;

    const query = {
      limit: parseInt(limit) || 20,
      after,
      before,
      hasCount: hasCount === 'true'
    };

    const result = await teamService.listTeamMembers({organizationId, query, status});

    // Remove password hashes from response
    const sanitizedData = result.data.map(({passwordHash, ...user}) => user);

    ctx.body = {
      success: true,
      data: sanitizedData,
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
 * GET /team/active
 * List active team members (for dropdowns)
 */
router.get('/active', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const members = await teamService.listActiveMembers(organizationId);

    // Remove password hashes and return minimal data
    const sanitizedData = members.map(({id, name, email, role, avatarUrl}) => ({
      id,
      name,
      email,
      role,
      avatarUrl
    }));

    ctx.body = {success: true, data: sanitizedData};
  } catch (error) {
    ctx.status = 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * GET /team/stats
 * Get team statistics
 */
router.get('/stats', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const stats = await teamService.getTeamStats(organizationId);

    ctx.body = {success: true, data: stats};
  } catch (error) {
    ctx.status = 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * GET /team/invitations
 * Get pending invitations
 */
router.get('/invitations', requireAdmin(), async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const invitations = await teamService.getPendingInvitations(organizationId);

    ctx.body = {success: true, data: invitations};
  } catch (error) {
    ctx.status = 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * GET /team/:id
 * Get team member details
 */
router.get('/:id', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const {id} = ctx.params;

    const user = await teamService.getTeamMember(id, organizationId);

    // Remove password hash
    const {passwordHash, ...userData} = user;

    ctx.body = {success: true, data: userData};
  } catch (error) {
    ctx.status = error.message === 'User not found' ? 404 : 500;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * POST /team/invite
 * Invite new team member
 */
router.post('/invite', requireAdmin(), async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const invitedBy = getCurrentUserId(ctx);
    const {email, role} = ctx.req.body;

    if (!email || !role) {
      ctx.status = 400;
      ctx.body = {success: false, error: 'Email and role are required'};
      return;
    }

    const invitation = await teamService.inviteTeamMember({
      organizationId,
      email,
      role,
      invitedBy
    });

    ctx.status = 201;
    ctx.body = {success: true, data: invitation};
  } catch (error) {
    ctx.status = 400;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * POST /team/invitations/:id/resend
 * Resend invitation
 */
router.post('/invitations/:id/resend', requireAdmin(), async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const {id} = ctx.params;

    const invitation = await teamService.resendInvitation(id, organizationId);

    ctx.body = {success: true, data: invitation};
  } catch (error) {
    ctx.status = error.message.includes('not found') ? 404 : 400;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * DELETE /team/invitations/:id
 * Cancel invitation
 */
router.delete('/invitations/:id', requireAdmin(), async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const {id} = ctx.params;

    await teamService.cancelInvitation(id, organizationId);

    ctx.body = {success: true, message: 'Invitation cancelled'};
  } catch (error) {
    ctx.status = error.message.includes('not found') ? 404 : 400;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * PATCH /team/:id
 * Update team member
 */
router.patch('/:id', async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const currentUserId = getCurrentUserId(ctx);
    const {id} = ctx.params;
    const {name, avatarUrl, role} = ctx.req.body;

    let user;

    // Update profile (name, avatar)
    if (name !== undefined || avatarUrl !== undefined) {
      // Users can update their own profile, admins can update anyone's
      if (id !== currentUserId) {
        // Check if admin
        const currentUser = ctx.state.chattyUser;
        if (!['owner', 'admin'].includes(currentUser.role)) {
          ctx.status = 403;
          ctx.body = {success: false, error: 'Cannot update other users'};
          return;
        }
      }

      user = await teamService.updateMemberProfile(id, organizationId, {name, avatarUrl});
    }

    // Update role (admin only)
    if (role !== undefined) {
      const currentUser = ctx.state.chattyUser;
      if (!['owner', 'admin'].includes(currentUser.role)) {
        ctx.status = 403;
        ctx.body = {success: false, error: 'Only admins can change roles'};
        return;
      }

      user = await teamService.updateMemberRole(id, organizationId, role, currentUserId);
    }

    if (!user) {
      user = await teamService.getTeamMember(id, organizationId);
    }

    // Remove password hash
    const {passwordHash, ...userData} = user;

    ctx.body = {success: true, data: userData};
  } catch (error) {
    ctx.status = error.message === 'User not found' ? 404 : 400;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * POST /team/:id/deactivate
 * Deactivate team member
 */
router.post('/:id/deactivate', requireAdmin(), async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const deactivatedBy = getCurrentUserId(ctx);
    const {id} = ctx.params;

    const user = await teamService.deactivateMember(id, organizationId, deactivatedBy);

    const {passwordHash, ...userData} = user;

    ctx.body = {success: true, data: userData};
  } catch (error) {
    ctx.status = error.message === 'User not found' ? 404 : 400;
    ctx.body = {success: false, error: error.message};
  }
});

/**
 * POST /team/:id/reactivate
 * Reactivate team member
 */
router.post('/:id/reactivate', requireAdmin(), async ctx => {
  try {
    const organizationId = getCurrentOrganizationId(ctx);
    const {id} = ctx.params;

    const user = await teamService.reactivateMember(id, organizationId);

    const {passwordHash, ...userData} = user;

    ctx.body = {success: true, data: userData};
  } catch (error) {
    ctx.status = error.message === 'User not found' ? 404 : 400;
    ctx.body = {success: false, error: error.message};
  }
});

export default router;
