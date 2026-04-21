import {DiscordGlobalConfigRepository} from '../../repositories/discord-global-config-repository.js';
import {DiscordGroupConfigRepository} from '../../repositories/discord-group-config-repository.js';
import {probeBotToken} from '../../helpers/discord-token-probe.js';

const globalRepo = new DiscordGlobalConfigRepository();
const groupRepo = new DiscordGroupConfigRepository();

/** GET /api/discord/global-config — admin only. Returns masked config. */
export async function getGlobalConfig(req, res) {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({success: false, error: 'Forbidden: admin only'});
    }
    const cfg = await globalRepo.get();
    return res.json({
      success: true,
      data: cfg
        ? {hasToken: !!cfg.botToken, botUsername: cfg.botUsername || null, updatedAt: cfg.updatedAt}
        : {hasToken: false, botUsername: null}
    });
  } catch (error) {
    console.error('[Discord:GlobalConfig:Get]', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/** PUT /api/discord/global-config — admin only. Validates with Discord before saving. */
export async function upsertGlobalConfig(req, res) {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({success: false, error: 'Forbidden: admin only'});
    }
    let {botToken} = req.body;
    if (typeof botToken !== 'string' || !botToken.trim()) {
      return res.status(400).json({success: false, error: 'botToken is required'});
    }
    // Strip whitespace/newlines/quotes that leak in when pasting.
    botToken = botToken.trim().replace(/^["']|["']$/g, '');

    if (!/^[\w-]{20,}\.[\w-]{5,}\.[\w-]{20,}$/.test(botToken)) {
      return res.status(400).json({
        success: false,
        error: 'botToken does not look like a Discord bot token (expect 3 segments separated by dots).'
      });
    }

    const probe = await probeBotToken(botToken);
    if (!probe.ok) {
      return res.status(400).json({
        success: false,
        error: `Discord rejected this token: ${probe.error}. Reset it in Developer Portal → Bot → Reset Token and paste the fresh one.`
      });
    }

    await globalRepo.upsert({botToken, botUsername: probe.username, botId: probe.id});
    return res.json({
      success: true,
      data: {hasToken: true, botUsername: probe.username}
    });
  } catch (error) {
    console.error('[Discord:GlobalConfig:Upsert]', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/** DELETE /api/discord/global-config — admin only. */
export async function deleteGlobalConfig(req, res) {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({success: false, error: 'Forbidden: admin only'});
    }
    await globalRepo.delete();
    return res.json({success: true, data: {message: 'Global bot token deleted'}});
  } catch (error) {
    console.error('[Discord:GlobalConfig:Delete]', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/discord/global-config/adopt-from-group/:groupId — admin only.
 * One-shot migration helper: if the caller already has a working per-group
 * token, copy it up to the global doc so every other group can reuse it.
 */
export async function adoptGlobalConfigFromGroup(req, res) {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({success: false, error: 'Forbidden: admin only'});
    }
    const {groupId} = req.params;
    const group = await groupRepo.getByGroupId(groupId);
    if (!group?.botToken) {
      return res.status(404).json({success: false, error: 'That group has no stored bot token'});
    }
    const probe = await probeBotToken(group.botToken);
    if (!probe.ok) {
      return res.status(400).json({
        success: false,
        error: `The group's stored token is stale: ${probe.error}`
      });
    }
    await globalRepo.upsert({botToken: group.botToken, botUsername: probe.username, botId: probe.id});
    return res.json({success: true, data: {hasToken: true, botUsername: probe.username}});
  } catch (error) {
    console.error('[Discord:GlobalConfig:Adopt]', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}
