import * as userRepository from '@functions/repositories/userRepository';
import * as invitationRepository from '@functions/repositories/invitationRepository';
import * as organizationRepository from '@functions/repositories/organizationRepository';

/**
 * List team members for an organization
 *
 * @param {Object} params
 * @param {string} params.organizationId - Organization ID
 * @param {PaginationQuery} [params.query] - Pagination options
 * @param {string} [params.status] - Filter by status
 * @returns {Promise<PaginationResult<User>>}
 */
export async function listTeamMembers({organizationId, query = {}, status}) {
  return userRepository.listByOrganization({organizationId, query, status});
}

/**
 * List active team members (for dropdowns)
 *
 * @param {string} organizationId - Organization ID
 * @returns {Promise<User[]>}
 */
export async function listActiveMembers(organizationId) {
  return userRepository.listActiveUsers(organizationId);
}

/**
 * Get team member by ID
 *
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID for validation
 * @returns {Promise<User>}
 */
export async function getTeamMember(userId, organizationId) {
  const user = await userRepository.getById(userId);

  if (!user) {
    throw new Error('User not found');
  }

  if (user.organizationId !== organizationId) {
    throw new Error('User not found');
  }

  return user;
}

/**
 * Invite a new team member
 *
 * @param {Object} params
 * @param {string} params.organizationId - Organization ID
 * @param {string} params.email - Invitee email
 * @param {'admin'|'agent'} params.role - Role to assign
 * @param {string} params.invitedBy - User ID of inviter
 * @returns {Promise<Invitation>}
 */
export async function inviteTeamMember({organizationId, email, role, invitedBy}) {
  const normalizedEmail = email.toLowerCase().trim();

  // Check if user already exists in organization
  const existingUser = await userRepository.getByEmail(organizationId, normalizedEmail);
  if (existingUser) {
    throw new Error('User with this email already exists in the organization');
  }

  // Check if there's already a pending invitation
  const existingInvitation = await invitationRepository.getPendingByEmail(organizationId, normalizedEmail);
  if (existingInvitation) {
    throw new Error('An invitation has already been sent to this email');
  }

  // Validate role
  if (!['admin', 'agent'].includes(role)) {
    throw new Error('Invalid role. Must be admin or agent');
  }

  // Create invitation
  const invitation = await invitationRepository.create({
    organizationId,
    email: normalizedEmail,
    role,
    invitedBy
  });

  // TODO: Send invitation email
  // The invitation.token should be included in the invite link

  return invitation;
}

/**
 * Get pending invitations for an organization
 *
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Invitation[]>}
 */
export async function getPendingInvitations(organizationId) {
  return invitationRepository.listPendingByOrganization(organizationId);
}

/**
 * Cancel an invitation
 *
 * @param {string} invitationId - Invitation ID
 * @param {string} organizationId - Organization ID for validation
 * @returns {Promise<void>}
 */
export async function cancelInvitation(invitationId, organizationId) {
  const invitation = await invitationRepository.getById(invitationId);

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  if (invitation.organizationId !== organizationId) {
    throw new Error('Invitation not found');
  }

  if (invitation.status !== 'pending') {
    throw new Error('Can only cancel pending invitations');
  }

  await invitationRepository.remove(invitationId);
}

/**
 * Resend an invitation
 *
 * @param {string} invitationId - Invitation ID
 * @param {string} organizationId - Organization ID for validation
 * @returns {Promise<Invitation>}
 */
export async function resendInvitation(invitationId, organizationId) {
  const invitation = await invitationRepository.getById(invitationId);

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  if (invitation.organizationId !== organizationId) {
    throw new Error('Invitation not found');
  }

  if (invitation.status !== 'pending') {
    throw new Error('Can only resend pending invitations');
  }

  // Delete old invitation and create new one
  await invitationRepository.remove(invitationId);

  const newInvitation = await invitationRepository.create({
    organizationId: invitation.organizationId,
    email: invitation.email,
    role: invitation.role,
    invitedBy: invitation.invitedBy
  });

  // TODO: Send invitation email

  return newInvitation;
}

/**
 * Update team member role
 *
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @param {'admin'|'agent'} newRole - New role
 * @param {string} updatedBy - User ID making the change
 * @returns {Promise<User>}
 */
export async function updateMemberRole(userId, organizationId, newRole, updatedBy) {
  const user = await getTeamMember(userId, organizationId);

  // Can't change owner role
  if (user.role === 'owner') {
    throw new Error('Cannot change owner role');
  }

  // Validate role
  if (!['admin', 'agent'].includes(newRole)) {
    throw new Error('Invalid role. Must be admin or agent');
  }

  // Can't demote yourself if you're the only admin
  if (updatedBy === userId && user.role === 'admin' && newRole === 'agent') {
    const admins = await userRepository.listByOrganization({
      organizationId,
      query: {getAll: true},
      status: 'active'
    });
    const adminCount = admins.data.filter(u => u.role === 'admin' || u.role === 'owner').length;
    if (adminCount <= 1) {
      throw new Error('Cannot demote yourself when you are the only admin');
    }
  }

  return userRepository.update(userId, {role: newRole});
}

/**
 * Update team member profile
 *
 * @param {string} userId - User ID
 * @param {string} organizationId - Organization ID
 * @param {Object} data - Profile data
 * @param {string} [data.name] - User name
 * @param {string} [data.avatarUrl] - Avatar URL
 * @returns {Promise<User>}
 */
export async function updateMemberProfile(userId, organizationId, data) {
  await getTeamMember(userId, organizationId);

  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;

  return userRepository.update(userId, updateData);
}

/**
 * Update notification preferences
 *
 * @param {string} userId - User ID
 * @param {Partial<UserNotificationPreferences>} preferences - Preferences to update
 * @returns {Promise<User>}
 */
export async function updateNotificationPreferences(userId, preferences) {
  return userRepository.updateNotificationPreferences(userId, preferences);
}

/**
 * Deactivate team member
 *
 * @param {string} userId - User ID to deactivate
 * @param {string} organizationId - Organization ID
 * @param {string} deactivatedBy - User ID making the change
 * @returns {Promise<User>}
 */
export async function deactivateMember(userId, organizationId, deactivatedBy) {
  const user = await getTeamMember(userId, organizationId);

  // Can't deactivate owner
  if (user.role === 'owner') {
    throw new Error('Cannot deactivate organization owner');
  }

  // Can't deactivate yourself
  if (userId === deactivatedBy) {
    throw new Error('Cannot deactivate yourself');
  }

  return userRepository.deactivate(userId);
}

/**
 * Reactivate team member
 *
 * @param {string} userId - User ID to reactivate
 * @param {string} organizationId - Organization ID
 * @returns {Promise<User>}
 */
export async function reactivateMember(userId, organizationId) {
  const user = await userRepository.getById(userId);

  if (!user || user.organizationId !== organizationId) {
    throw new Error('User not found');
  }

  if (user.status !== 'deactivated') {
    throw new Error('User is not deactivated');
  }

  return userRepository.reactivate(userId);
}

/**
 * Get team statistics
 *
 * @param {string} organizationId - Organization ID
 * @returns {Promise<{totalMembers: number, activeMembers: number, pendingInvitations: number}>}
 */
export async function getTeamStats(organizationId) {
  const [totalMembers, pendingInvitations] = await Promise.all([
    userRepository.countByOrganization(organizationId),
    invitationRepository.listPendingByOrganization(organizationId)
  ]);

  return {
    totalMembers,
    activeMembers: totalMembers, // All counted are active
    pendingInvitations: pendingInvitations.length
  };
}
