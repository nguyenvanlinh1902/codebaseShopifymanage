import {DiscordConfigRepository} from '../../repositories/discord-config-repository.js';

const configRepo = new DiscordConfigRepository();

/**
 * GET /api/discord/config
 */
export async function getConfig(req, res) {
  try {
    const config = await configRepo.getByStoreId((req.query.storeId || req.body?.storeId || 'default'));
    if (!config) {
      return res.json({success: true, data: null});
    }
    // Never return botToken
    const {botToken, ...safeConfig} = config;
    return res.json({success: true, data: {...safeConfig, hasToken: !!botToken}});
  } catch (error) {
    console.error('[Discord:Config:Get] Error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * POST /api/discord/config
 */
export async function upsertConfig(req, res) {
  try {
    const {botToken, channelId, guildId} = req.body;
    if (!botToken || !channelId) {
      return res.status(400).json({success: false, error: 'botToken and channelId are required'});
    }

    const data = {botToken, channelId};
    if (guildId) data.guildId = guildId;
    const config = await configRepo.upsert((req.query.storeId || req.body?.storeId || 'default'), data);
    const {botToken: _token, ...safeConfig} = config;
    return res.json({success: true, data: {...safeConfig, hasToken: true}});
  } catch (error) {
    console.error('[Discord:Config:Upsert] Error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}

/**
 * DELETE /api/discord/config
 */
export async function deleteConfig(req, res) {
  try {
    await configRepo.delete((req.query.storeId || req.body?.storeId || 'default'));
    return res.json({success: true, data: {message: 'Config deleted'}});
  } catch (error) {
    console.error('[Discord:Config:Delete] Error:', error.message);
    return res.status(500).json({success: false, error: error.message});
  }
}
