import * as ticketRepository from '@functions/repositories/ticketRepository';
import * as messageRepository from '@functions/repositories/messageRepository';
import * as activityRepository from '@functions/repositories/activityRepository';
import * as customerRepository from '@functions/repositories/customerRepository';
import * as userRepository from '@functions/repositories/userRepository';
import * as tagRepository from '@functions/repositories/tagRepository';

/**
 * Create a new ticket
 *
 * @param {Object} params
 * @param {string} params.organizationId - Organization ID
 * @param {string} params.subject - Ticket subject
 * @param {string} params.customerEmail - Customer email
 * @param {string} params.customerName - Customer name
 * @param {string} params.content - Initial message content
 * @param {string} [params.contentHtml] - HTML content
 * @param {'email'|'manual'} [params.channel='manual'] - Ticket channel
 * @param {string} [params.userId] - Creating user ID (for manual tickets)
 * @param {string} [params.emailMessageId] - Email message ID for threading
 * @returns {Promise<{ticket: Ticket, message: Message}>}
 */
export async function createTicket(params) {
  const {organizationId, subject, customerEmail, customerName, content, contentHtml, channel, userId, emailMessageId} =
    params;

  // Try to match customer from Shopify data
  const customer = await customerRepository.matchCustomer(organizationId, customerEmail);

  // Create ticket
  const ticket = await ticketRepository.create({
    organizationId,
    subject,
    customerEmail,
    customerName,
    customerId: customer?.id || null,
    channel: channel || 'manual'
  });

  // Create initial message
  const message = await messageRepository.create({
    ticketId: ticket.id,
    userId: channel === 'email' ? null : userId,
    type: 'reply',
    contentText: content,
    contentHtml: contentHtml || null,
    senderType: channel === 'email' ? 'customer' : 'agent',
    senderEmail: channel === 'email' ? customerEmail : null,
    senderName: channel === 'email' ? customerName : null,
    emailMessageId: emailMessageId || null,
    isInternal: false
  });

  // Update ticket message count
  await ticketRepository.incrementMessageCount(ticket.id);

  // Log activity
  await activityRepository.logCreated(ticket.id, userId, {channel});

  // Reload ticket to get updated message count
  const updatedTicket = await ticketRepository.getById(ticket.id);

  return {ticket: updatedTicket, message};
}

/**
 * Get ticket by ID with validation
 *
 * @param {string} ticketId - Ticket ID
 * @param {string} organizationId - Organization ID for validation
 * @returns {Promise<Ticket>}
 */
export async function getTicket(ticketId, organizationId) {
  const ticket = await ticketRepository.getById(ticketId);

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  if (ticket.organizationId !== organizationId) {
    throw new Error('Ticket not found'); // Don't reveal existence to other orgs
  }

  return ticket;
}

/**
 * Get ticket with full details (messages, customer, assignee, tags)
 *
 * @param {string} ticketId - Ticket ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<{ticket: Ticket, messages: Message[], customer: Customer|null, assignee: User|null, tags: Tag[]}>}
 */
export async function getTicketWithDetails(ticketId, organizationId) {
  const ticket = await getTicket(ticketId, organizationId);

  // Load related data in parallel
  const [messages, customer, assignee, tags] = await Promise.all([
    messageRepository.getAllByTicket(ticketId),
    ticket.customerId ? customerRepository.getById(ticket.customerId) : null,
    ticket.assigneeId ? userRepository.getById(ticket.assigneeId) : null,
    ticket.tagIds?.length > 0 ? tagRepository.getByIds(ticket.tagIds) : []
  ]);

  return {ticket, messages, customer, assignee, tags};
}

/**
 * List tickets with filters
 *
 * @param {Object} params
 * @param {string} params.organizationId - Organization ID
 * @param {TicketFilters} [params.filters] - Filter options
 * @param {PaginationQuery} [params.query] - Pagination options
 * @returns {Promise<PaginationResult<Ticket>>}
 */
export async function listTickets({organizationId, filters = {}, query = {}}) {
  return ticketRepository.listByOrganization({organizationId, filters, query});
}

/**
 * Reply to a ticket
 *
 * @param {Object} params
 * @param {string} params.ticketId - Ticket ID
 * @param {string} params.organizationId - Organization ID
 * @param {string} params.userId - Replying user ID
 * @param {string} params.content - Reply content
 * @param {string} [params.contentHtml] - HTML content
 * @returns {Promise<{ticket: Ticket, message: Message}>}
 */
export async function replyToTicket(params) {
  const {ticketId, organizationId, userId, content, contentHtml} = params;

  // Get ticket and validate
  const ticket = await getTicket(ticketId, organizationId);

  // Get user for sender info
  const user = await userRepository.getById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Create message
  const message = await messageRepository.create({
    ticketId,
    userId,
    type: 'reply',
    contentText: content,
    contentHtml: contentHtml || null,
    senderType: 'agent',
    senderEmail: user.email,
    senderName: user.name,
    isInternal: false
  });

  // Update ticket
  await ticketRepository.incrementMessageCount(ticketId);

  // If ticket was resolved or pending, keep it that way (don't auto-open on agent reply)
  // Only customer replies auto-open tickets

  // Log activity
  await activityRepository.logReplied(ticketId, userId, message.id);

  const updatedTicket = await ticketRepository.getById(ticketId);

  return {ticket: updatedTicket, message};
}

/**
 * Add internal note to a ticket
 *
 * @param {Object} params
 * @param {string} params.ticketId - Ticket ID
 * @param {string} params.organizationId - Organization ID
 * @param {string} params.userId - User ID
 * @param {string} params.content - Note content
 * @returns {Promise<{ticket: Ticket, message: Message}>}
 */
export async function addInternalNote(params) {
  const {ticketId, organizationId, userId, content} = params;

  // Get ticket and validate
  const ticket = await getTicket(ticketId, organizationId);

  // Get user for sender info
  const user = await userRepository.getById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Create internal note
  const message = await messageRepository.create({
    ticketId,
    userId,
    type: 'note',
    contentText: content,
    senderType: 'agent',
    senderEmail: user.email,
    senderName: user.name,
    isInternal: true
  });

  // Log activity
  await activityRepository.logNoteAdded(ticketId, userId, message.id);

  return {ticket, message};
}

/**
 * Change ticket status
 *
 * @param {string} ticketId - Ticket ID
 * @param {string} organizationId - Organization ID
 * @param {string} userId - User making the change
 * @param {Ticket['status']} newStatus - New status
 * @returns {Promise<Ticket>}
 */
export async function changeStatus(ticketId, organizationId, userId, newStatus) {
  const ticket = await getTicket(ticketId, organizationId);
  const oldStatus = ticket.status;

  if (oldStatus === newStatus) {
    return ticket;
  }

  // Update status
  const updatedTicket = await ticketRepository.updateStatus(ticketId, newStatus);

  // Log activity
  await activityRepository.logStatusChanged(ticketId, userId, oldStatus, newStatus);

  return updatedTicket;
}

/**
 * Assign ticket to user
 *
 * @param {string} ticketId - Ticket ID
 * @param {string} organizationId - Organization ID
 * @param {string} userId - User making the assignment
 * @param {string|null} assigneeId - User ID to assign (null to unassign)
 * @returns {Promise<Ticket>}
 */
export async function assignTicket(ticketId, organizationId, userId, assigneeId) {
  const ticket = await getTicket(ticketId, organizationId);
  const oldAssigneeId = ticket.assigneeId;

  if (oldAssigneeId === assigneeId) {
    return ticket;
  }

  // Validate assignee exists in same organization
  if (assigneeId) {
    const assignee = await userRepository.getById(assigneeId);
    if (!assignee || assignee.organizationId !== organizationId) {
      throw new Error('Invalid assignee');
    }
  }

  // Update assignment
  const updatedTicket = await ticketRepository.assign(ticketId, assigneeId);

  // Get names for activity log
  const [oldAssignee, newAssignee] = await Promise.all([
    oldAssigneeId ? userRepository.getById(oldAssigneeId) : null,
    assigneeId ? userRepository.getById(assigneeId) : null
  ]);

  // Log activity
  await activityRepository.logAssigned(ticketId, userId, oldAssigneeId, assigneeId, {
    oldAssigneeName: oldAssignee?.name || null,
    newAssigneeName: newAssignee?.name || null
  });

  return updatedTicket;
}

/**
 * Change ticket priority
 *
 * @param {string} ticketId - Ticket ID
 * @param {string} organizationId - Organization ID
 * @param {string} userId - User making the change
 * @param {Ticket['priority']} newPriority - New priority
 * @returns {Promise<Ticket>}
 */
export async function changePriority(ticketId, organizationId, userId, newPriority) {
  const ticket = await getTicket(ticketId, organizationId);
  const oldPriority = ticket.priority;

  if (oldPriority === newPriority) {
    return ticket;
  }

  // Update priority
  const updatedTicket = await ticketRepository.updatePriority(ticketId, newPriority);

  // Log activity
  await activityRepository.logPriorityChanged(ticketId, userId, oldPriority, newPriority);

  return updatedTicket;
}

/**
 * Add tag to ticket
 *
 * @param {string} ticketId - Ticket ID
 * @param {string} organizationId - Organization ID
 * @param {string} userId - User adding the tag
 * @param {string} tagId - Tag ID to add
 * @returns {Promise<Ticket>}
 */
export async function addTag(ticketId, organizationId, userId, tagId) {
  const ticket = await getTicket(ticketId, organizationId);

  // Validate tag exists in same organization
  const tag = await tagRepository.getById(tagId);
  if (!tag || tag.organizationId !== organizationId) {
    throw new Error('Invalid tag');
  }

  // Check if already tagged
  if (ticket.tagIds?.includes(tagId)) {
    return ticket;
  }

  // Add tag
  const updatedTicket = await ticketRepository.addTag(ticketId, tagId);

  // Log activity
  await activityRepository.logTagged(ticketId, userId, tagId, tag.name);

  return updatedTicket;
}

/**
 * Remove tag from ticket
 *
 * @param {string} ticketId - Ticket ID
 * @param {string} organizationId - Organization ID
 * @param {string} userId - User removing the tag
 * @param {string} tagId - Tag ID to remove
 * @returns {Promise<Ticket>}
 */
export async function removeTag(ticketId, organizationId, userId, tagId) {
  const ticket = await getTicket(ticketId, organizationId);

  // Check if tag exists on ticket
  if (!ticket.tagIds?.includes(tagId)) {
    return ticket;
  }

  // Get tag name for activity
  const tag = await tagRepository.getById(tagId);

  // Remove tag
  const updatedTicket = await ticketRepository.removeTag(ticketId, tagId);

  // Log activity
  await activityRepository.logUntagged(ticketId, userId, tagId, tag?.name || 'Unknown');

  return updatedTicket;
}

/**
 * Process customer email reply (auto-reopen if needed)
 *
 * @param {Object} params
 * @param {string} params.ticketId - Ticket ID
 * @param {string} params.content - Message content
 * @param {string} [params.contentHtml] - HTML content
 * @param {string} params.senderEmail - Customer email
 * @param {string} params.senderName - Customer name
 * @param {string} [params.emailMessageId] - Email message ID
 * @returns {Promise<{ticket: Ticket, message: Message}>}
 */
export async function processCustomerReply(params) {
  const {ticketId, content, contentHtml, senderEmail, senderName, emailMessageId} = params;

  const ticket = await ticketRepository.getById(ticketId);
  if (!ticket) {
    throw new Error('Ticket not found');
  }

  // Create customer message
  const message = await messageRepository.create({
    ticketId,
    type: 'reply',
    contentText: content,
    contentHtml: contentHtml || null,
    senderType: 'customer',
    senderEmail,
    senderName,
    emailMessageId: emailMessageId || null,
    isInternal: false
  });

  // Update ticket
  await ticketRepository.incrementMessageCount(ticketId);

  // Auto-reopen if pending or resolved
  if (['pending', 'resolved'].includes(ticket.status)) {
    await ticketRepository.updateStatus(ticketId, 'open');
  }

  const updatedTicket = await ticketRepository.getById(ticketId);

  return {ticket: updatedTicket, message};
}

/**
 * Get ticket counts by status
 *
 * @param {string} organizationId - Organization ID
 * @returns {Promise<{open: number, pending: number, resolved: number, closed: number}>}
 */
export async function getTicketCounts(organizationId) {
  return ticketRepository.countByStatus(organizationId);
}

/**
 * Get agent workload (open tickets per agent)
 *
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Array<{user: User, count: number}>>}
 */
export async function getAgentWorkload(organizationId) {
  // Get ticket counts by assignee
  const counts = await ticketRepository.countByAssignee(organizationId);

  // Get user details
  const workload = await Promise.all(
    counts.map(async ({assigneeId, count}) => {
      const user = await userRepository.getById(assigneeId);
      return {user, count};
    })
  );

  return workload.filter(w => w.user !== null);
}

/**
 * Search tickets
 *
 * @param {string} organizationId - Organization ID
 * @param {string} searchTerm - Search term
 * @param {number} [limit=20] - Max results
 * @returns {Promise<Ticket[]>}
 */
export async function searchTickets(organizationId, searchTerm, limit = 20) {
  return ticketRepository.search(organizationId, searchTerm, limit);
}
