import {DiscordSentEmailRepository} from '../../repositories/discord-sent-email-repository.js';

const sentRepo = new DiscordSentEmailRepository();

/**
 * GET /api/discord/groups/:groupId/history?limit&from&to&after
 *
 * Returns the most-recently forwarded emails for a single group, scoped via
 * the `groupId` field stamped on every group-scoped claim doc. Useful for
 * admins to verify what the digest actually sent, especially when debugging
 * "Run now didn't post anything" scenarios.
 */
export async function listGroupHistory(req, res) {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({success: false, error: 'Forbidden: admin only'});
    }
    const {groupId} = req.params;
    const {limit, from, to, after} = req.query;
    const rows = await sentRepo.listRecentByGroup(groupId, {
      limit: Math.min(parseInt(limit, 10) || 50, 200),
      from,
      to,
      after
    });
    return res.json({
      success: true,
      data: rows.map(r => ({
        id: r.id,
        provider: r.provider,
        accountEmail: r.accountEmail,
        messageId: r.messageId,
        subject: r.subject || null,
        storeId: r.storeId || null,
        claimedAt: r.claimedAt || null,
        sentAt: r.sentAt || null,
        discordMessageId: r.discordMessageId || null
      }))
    });
  } catch (error) {
    console.error('[Discord:GroupHistory:List]', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}
