import {DiscordGroupConfigRepository} from '../../repositories/discord-group-config-repository.js';
import {DiscordGroupScheduleRepository} from '../../repositories/discord-group-schedule-repository.js';
import {DiscordGlobalConfigRepository} from '../../repositories/discord-global-config-repository.js';
import {StoreGroupRepository} from '../../repositories/storeGroupRepository.js';
import {StoreRepository} from '../../repositories/storeRepository.js';
import {DiscordService} from '../../services/discord-service.js';

const configRepo = new DiscordGroupConfigRepository();
const scheduleRepo = new DiscordGroupScheduleRepository();
const globalRepo = new DiscordGlobalConfigRepository();
const groupRepo = new StoreGroupRepository();
const storeRepo = new StoreRepository();

/**
 * GET /api/discord/groups — list ALL groups with their config + schedule summary.
 * Admin-only. Used by the Discord Group Management page.
 */
export async function listGroupsWithDiscord(req, res) {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({success: false, error: 'Forbidden: admin only'});
    }

    const [groups, global] = await Promise.all([
      groupRepo.getAll(),
      globalRepo.get()
    ]);
    const hasGlobalToken = !!global?.botToken;

    // Load all configs/schedules in parallel (small cardinality).
    const rows = await Promise.all(groups.map(async group => {
      const [config, schedule, stores] = await Promise.all([
        configRepo.getByGroupId(group.id),
        scheduleRepo.getByGroupId(group.id),
        storeRepo.getByGroupId(group.id)
      ]);
      // Strip botToken from per-group doc (legacy field). Effective token comes
      // from the global doc; group only owns channelId.
      let safeConfig = null;
      if (config) {
        // eslint-disable-next-line no-unused-vars
        const {botToken, ...rest} = config;
        safeConfig = {...rest, hasToken: hasGlobalToken || !!botToken};
      } else if (hasGlobalToken) {
        safeConfig = {hasToken: true, channelId: null};
      }
      return {
        id: group.id,
        name: group.name,
        description: group.description || '',
        storeCount: stores.length,
        config: safeConfig,
        schedule: schedule || null
      };
    }));

    return res.json({success: true, data: rows, globalToken: {hasToken: hasGlobalToken}});
  } catch (error) {
    console.error('[Discord:GroupList]', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/** GET /api/discord/groups/:groupId/config */
export async function getGroupConfig(req, res) {
  try {
    const {groupId} = req.params;
    const config = await configRepo.getByGroupId(groupId);
    if (!config) return res.json({success: true, data: null});
    // eslint-disable-next-line no-unused-vars
    const {botToken, ...safe} = config;
    return res.json({success: true, data: {...safe, hasToken: !!botToken}});
  } catch (error) {
    console.error('[Discord:GroupConfig:Get]', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * PUT /api/discord/groups/:groupId/config — admin only.
 * Per-group config now only stores channelId; bot token is global
 * (see discord-global-config-handler.js).
 */
export async function upsertGroupConfig(req, res) {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({success: false, error: 'Forbidden: admin only'});
    }
    const {groupId} = req.params;
    let {channelId} = req.body;
    if (typeof channelId === 'string') channelId = channelId.trim();

    if (!channelId) {
      return res.status(400).json({success: false, error: 'channelId is required'});
    }
    if (!/^\d{17,20}$/.test(channelId)) {
      return res.status(400).json({
        success: false,
        error: 'channelId must be a 17-20 digit number. Right-click channel → Copy Channel ID (Developer Mode on).'
      });
    }

    const updated = await configRepo.upsert(groupId, {channelId});
    // eslint-disable-next-line no-unused-vars
    const {botToken: _token, ...safe} = updated;
    const global = await globalRepo.get();
    return res.json({
      success: true,
      data: {...safe, hasToken: !!global?.botToken || !!_token}
    });
  } catch (error) {
    console.error('[Discord:GroupConfig:Upsert]', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/** DELETE /api/discord/groups/:groupId/config — admin only */
export async function deleteGroupConfig(req, res) {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({success: false, error: 'Forbidden: admin only'});
    }
    await configRepo.delete(req.params.groupId);
    return res.json({success: true, data: {message: 'Config deleted'}});
  } catch (error) {
    console.error('[Discord:GroupConfig:Delete]', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/** POST /api/discord/groups/:groupId/test — admin only */
export async function testGroupConnection(req, res) {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({success: false, error: 'Forbidden: admin only'});
    }
    const {groupId} = req.params;
    const svc = await DiscordService.createFromGroupConfig(groupId);
    if (!svc) {
      return res.status(404).json({success: false, error: 'Discord group config missing or inactive'});
    }

    const result = await svc.testConnection();
    if (!result.success) {
      // Run a detailed diagnostic so the admin can see WHICH bot the token
      // belongs to and WHICH guild owns the channel — these often differ when
      // someone copies a token/channel from two separate Discord apps.
      const diag = await svc.diagnose().catch(err => ({error: err.message}));
      const raw = result.error || 'unknown';

      let hint = '';
      if (/missing access/i.test(raw) && diag?.bot) {
        const botName = diag.bot.username;
        const guildList = (diag.guilds || []).map(g => g.name).join(', ') || '(none)';
        if (!diag.channel) {
          // Channel lookup was rejected — almost always because bot is NOT in
          // the guild that owns it, or the channel id is invalid / not a text
          // channel. Listing the guilds bot IS in lets the admin compare.
          hint = ` — channel lookup failed (bot "${botName}" cannot see channel ${req.body?.channelId || ''}). Bot is currently in ${diag.guilds?.length || 0} server(s): ${guildList}. Invite the bot to the server that owns this channel, or paste a channel ID from a server above. Also verify Channel ID is correct and the channel is text-based.`;
        } else if (!diag.botInGuild) {
          hint = ` — bot "${botName}" is NOT a member of the server that owns channel "${diag.channel.name}" (guild ${diag.channel.guildId}). Bot is in: ${guildList}. Invite this bot to that server, or pick a channel from a server above.`;
        } else {
          hint = ` — bot "${botName}" IS in the guild but lacks View Channel / Send Messages overrides for #${diag.channel.name}. Open channel Edit → Permissions → add the bot and grant those.`;
        }
      }

      return res.status(400).json({
        success: false,
        error: `Cannot access channel: ${raw}${hint}`,
        diagnostic: diag
      });
    }

    const embed = svc.createEmailEmbed({
      subject: 'Test message from group config',
      from: 'system@group-config',
      snippet: 'If you see this, the Discord bot can post to this channel.',
      labels: ['TEST'],
      date: new Date().toISOString(),
      isRead: false,
      accountEmail: 'system@group-config'
    });
    await svc.sendEmbed(embed);

    return res.json({
      success: true,
      data: {channelName: result.channelName, messageSent: true}
    });
  } catch (error) {
    console.error('[Discord:GroupConfig:Test]', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}
