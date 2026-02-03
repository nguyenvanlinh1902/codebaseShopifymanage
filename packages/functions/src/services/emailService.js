import * as ticketRepository from '@functions/repositories/ticketRepository';
import * as messageRepository from '@functions/repositories/messageRepository';
import * as organizationRepository from '@functions/repositories/organizationRepository';
import * as customerRepository from '@functions/repositories/customerRepository';
import * as ticketService from '@functions/services/ticketService';

/**
 * Process inbound email and create/update ticket
 *
 * @param {Object} emailData - Parsed email data
 * @param {string} emailData.from - Sender email
 * @param {string} emailData.fromName - Sender name
 * @param {string} emailData.to - Recipient email (forwarding address)
 * @param {string} emailData.subject - Email subject
 * @param {string} emailData.textBody - Plain text body
 * @param {string} [emailData.htmlBody] - HTML body
 * @param {string} emailData.messageId - Email message ID for threading
 * @param {string} [emailData.inReplyTo] - In-Reply-To header
 * @param {string[]} [emailData.references] - References header
 * @param {Array<{filename: string, contentType: string, content: Buffer}>} [emailData.attachments] - Attachments
 * @returns {Promise<{ticket: Ticket, message: Message, isNewTicket: boolean}>}
 */
export async function processInboundEmail(emailData) {
  const {from, fromName, to, subject, textBody, htmlBody, messageId, inReplyTo, references} = emailData;

  // Find organization by forwarding address
  const organization = await organizationRepository.getByEmailAddress(to);
  if (!organization) {
    throw new Error('Unknown recipient address');
  }

  // Try to find existing ticket thread
  let ticket = await findExistingTicket({
    organizationId: organization.id,
    senderEmail: from,
    subject,
    messageId,
    inReplyTo,
    references
  });

  let isNewTicket = false;

  if (ticket) {
    // Add reply to existing ticket
    const {ticket: updatedTicket, message} = await ticketService.processCustomerReply({
      ticketId: ticket.id,
      content: textBody,
      contentHtml: htmlBody,
      senderEmail: from,
      senderName: fromName || from,
      emailMessageId: messageId
    });

    return {ticket: updatedTicket, message, isNewTicket: false};
  }

  // Create new ticket
  isNewTicket = true;
  const result = await ticketService.createTicket({
    organizationId: organization.id,
    subject: cleanSubject(subject),
    customerEmail: from,
    customerName: fromName || from,
    content: textBody,
    contentHtml: htmlBody,
    channel: 'email',
    emailMessageId: messageId
  });

  return {ticket: result.ticket, message: result.message, isNewTicket};
}

/**
 * Find existing ticket for threading
 *
 * @param {Object} params
 * @param {string} params.organizationId - Organization ID
 * @param {string} params.senderEmail - Sender email
 * @param {string} params.subject - Email subject
 * @param {string} params.messageId - Email message ID
 * @param {string} [params.inReplyTo] - In-Reply-To header
 * @param {string[]} [params.references] - References header
 * @returns {Promise<Ticket|null>}
 */
async function findExistingTicket({organizationId, senderEmail, subject, messageId, inReplyTo, references}) {
  // 1. Check In-Reply-To header
  if (inReplyTo) {
    const message = await messageRepository.getByEmailMessageId(inReplyTo);
    if (message) {
      const ticket = await ticketRepository.getById(message.ticketId);
      if (ticket && ticket.organizationId === organizationId) {
        return ticket;
      }
    }
  }

  // 2. Check References header
  if (references && references.length > 0) {
    const message = await messageRepository.findByEmailReferences(references);
    if (message) {
      const ticket = await ticketRepository.getById(message.ticketId);
      if (ticket && ticket.organizationId === organizationId) {
        return ticket;
      }
    }
  }

  // 3. Check for ticket ID in subject [#1234]
  const ticketIdMatch = subject.match(/\[#(\d+)\]/);
  if (ticketIdMatch) {
    const ticketNumber = parseInt(ticketIdMatch[1]);
    const ticket = await ticketRepository.getByNumber(organizationId, ticketNumber);
    if (ticket && ticket.customerEmail === senderEmail.toLowerCase()) {
      // Only match if same customer
      return ticket;
    }
  }

  // 4. Check for similar subject from same sender in last 30 days
  // This is a fallback - in production would use more sophisticated matching
  // For now, we'll skip this to avoid false positives

  return null;
}

/**
 * Clean email subject (remove Re:, Fwd:, ticket IDs)
 *
 * @param {string} subject - Email subject
 * @returns {string} Cleaned subject
 */
function cleanSubject(subject) {
  return subject
    .replace(/^(Re:|Fwd:|RE:|FW:)\s*/gi, '')
    .replace(/\[#\d+\]/g, '')
    .trim();
}

/**
 * Build outbound email for ticket reply
 *
 * @param {Object} params
 * @param {Ticket} params.ticket - Ticket
 * @param {Message} params.message - New message
 * @param {User} params.agent - Agent who replied
 * @param {Organization} params.organization - Organization
 * @returns {Object} Email data ready for sending
 */
export function buildOutboundEmail({ticket, message, agent, organization}) {
  const fromName = organization.settings?.supportEmailName || organization.name + ' Support';
  const signature = organization.settings?.emailSignature || `\n\n---\n${agent.name}\n${fromName}`;

  // Get previous messages for quoting
  // In production, would fetch recent messages

  const subject = `Re: ${ticket.subject} [#${ticket.number}]`;

  const textBody = message.contentText + signature;

  const htmlBody = message.contentHtml
    ? message.contentHtml + signature.replace(/\n/g, '<br>')
    : `<p>${message.contentText.replace(/\n/g, '<br>')}</p>${signature.replace(/\n/g, '<br>')}`;

  return {
    from: `${fromName} <support-${organization.id}@mail.chatty.io>`,
    replyTo: organization.settings?.replyToEmail || organization.emailAddress,
    to: ticket.customerEmail,
    subject,
    text: textBody,
    html: htmlBody,
    headers: {
      'X-Chatty-Ticket-Id': ticket.id,
      'X-Chatty-Ticket-Number': ticket.number.toString(),
      'X-Chatty-Message-Id': message.id
    }
  };
}

/**
 * Send email reply (calls external email provider)
 *
 * @param {Object} emailData - Email data from buildOutboundEmail
 * @returns {Promise<{success: boolean, messageId: string}>}
 */
export async function sendEmail(emailData) {
  // TODO: Implement actual email sending via SendGrid/Postmark
  // For MVP, this is a placeholder

  console.log('Would send email:', {
    to: emailData.to,
    subject: emailData.subject,
    from: emailData.from
  });

  // Return mock success
  return {
    success: true,
    messageId: `mock-${Date.now()}`
  };
}

/**
 * Parse raw email webhook payload
 *
 * @param {Object} payload - Raw webhook payload from email provider
 * @param {string} provider - Provider name ('postmark', 'sendgrid')
 * @returns {Object} Normalized email data
 */
export function parseEmailWebhook(payload, provider = 'postmark') {
  if (provider === 'postmark') {
    return {
      from: payload.From || payload.FromFull?.Email,
      fromName: payload.FromName || payload.FromFull?.Name,
      to: payload.To || payload.ToFull?.[0]?.Email,
      subject: payload.Subject,
      textBody: payload.TextBody,
      htmlBody: payload.HtmlBody,
      messageId: payload.MessageID,
      inReplyTo: payload.Headers?.find(h => h.Name.toLowerCase() === 'in-reply-to')?.Value,
      references: payload.Headers?.find(h => h.Name.toLowerCase() === 'references')
        ?.Value?.split(/\s+/)
        .filter(Boolean),
      attachments: payload.Attachments?.map(att => ({
        filename: att.Name,
        contentType: att.ContentType,
        content: Buffer.from(att.Content, 'base64')
      }))
    };
  }

  // Add other providers as needed
  throw new Error(`Unsupported email provider: ${provider}`);
}

/**
 * Verify email webhook signature
 *
 * @param {Object} payload - Webhook payload
 * @param {string} signature - Webhook signature header
 * @param {string} provider - Provider name
 * @returns {boolean}
 */
export function verifyWebhookSignature(payload, signature, provider = 'postmark') {
  // TODO: Implement actual signature verification per provider
  // For MVP, return true (insecure - fix before production)
  return true;
}
