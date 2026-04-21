import {REST} from '@discordjs/rest';
import {Routes} from 'discord-api-types/v10';
import {DiscordConfigRepository} from '../repositories/discord-config-repository.js';
import {DiscordGroupConfigRepository} from '../repositories/discord-group-config-repository.js';
import {DiscordGlobalConfigRepository} from '../repositories/discord-global-config-repository.js';
import {getFirestore} from 'firebase-admin/firestore';

const QUEUE_COLLECTION = 'discord_send_queue';
const MAX_RETRIES = 3;
const SEND_DELAY_MS = 2000;

/**
 * Discord Service — sends email embeds via Discord REST API
 */
export class DiscordService {
  constructor(botToken, channelId) {
    this._rest = new REST({version: '10'}).setToken(botToken);
    this._channelId = channelId;
  }

  /**
   * Factory: create from Firestore config for a store (legacy — per-store)
   */
  static async createFromConfig(storeId) {
    const configRepo = new DiscordConfigRepository();
    const config = await configRepo.getByStoreId(storeId);
    if (!config || !config.botToken || !config.channelId) return null;
    return new DiscordService(config.botToken, config.channelId);
  }

  /**
   * Factory: create from Firestore config for a store group.
   * Bot token is shared globally (discord_global_config); each group only owns
   * its channelId. Falls back to the group's own botToken if present (legacy,
   * pre-global-token migration).
   */
  static async createFromGroupConfig(groupId) {
    const groupRepo = new DiscordGroupConfigRepository();
    const group = await groupRepo.getByGroupId(groupId);
    if (!group || !group.channelId || group.isActive === false) return null;

    const globalRepo = new DiscordGlobalConfigRepository();
    const global = await globalRepo.get();
    const token = global?.botToken || group.botToken;
    if (!token) return null;
    return new DiscordService(token, group.channelId);
  }

  /**
   * Return a new instance pointing to a different channel (same bot token).
   */
  withChannel(channelId) {
    const copy = Object.create(DiscordService.prototype);
    copy._rest = this._rest;
    copy._channelId = channelId;
    return copy;
  }

  /**
   * Send an embed to the configured channel
   */
  async sendEmbed(embed) {
    try {
      const result = await this._rest.post(Routes.channelMessages(this._channelId), {
        body: {embeds: [embed]}
      });
      return {success: true, messageId: result.id};
    } catch (err) {
      if (err.status === 429) {
        const retryAfter = err.retryAfter || 5;
        console.warn(`[Discord] Rate limited, retry after ${retryAfter}s`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        const result = await this._rest.post(Routes.channelMessages(this._channelId), {
          body: {embeds: [embed]}
        });
        return {success: true, messageId: result.id};
      }
      throw err;
    }
  }

  /**
   * Create a Discord embed from email data
   */
  createEmailEmbed(emailData) {
    // Color coding: blue=unread, gold=starred, red=IMPORTANT
    let color = 0x0099ff; // default blue (unread)
    if (emailData.labels?.includes('STARRED')) color = 0xffd700;
    if (emailData.labels?.includes('IMPORTANT')) color = 0xff0000;
    if (emailData.isRead) color = 0x95a5a6; // gray for read

    const subject = (emailData.subject || '(no subject)').slice(0, 240);
    const bodyPreview = (emailData.snippet || emailData.bodyText || '').slice(0, 200);

    return {
      title: subject,
      description: bodyPreview || '(no body)',
      color,
      fields: [
        {name: 'From', value: emailData.from || 'Unknown', inline: true},
        {name: 'Labels', value: (emailData.labels || []).join(', ') || 'None', inline: true},
        {name: 'Account', value: emailData.accountEmail || '', inline: false}
      ].filter(f => f.value),
      footer: {
        text: `Gmail • ${emailData.date || ''}`
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Run a detailed diagnostic: identify which bot is behind the token, which
   * guilds it belongs to, and whether the configured channel lives in one of
   * those guilds. Helps admins pinpoint "token ↔ channel in different apps"
   * mismatches without staring at raw Discord error codes.
   */
  async diagnose() {
    const out = {bot: null, channel: null, channelGuildId: null, botInGuild: null, guilds: []};
    try {
      out.bot = await this._rest.get(Routes.user('@me'));
    } catch (err) {
      return {...out, error: `Invalid bot token: ${err.message}`};
    }
    try {
      out.guilds = await this._rest.get(Routes.userGuilds());
    } catch {
      out.guilds = [];
    }
    try {
      const channel = await this._rest.get(Routes.channel(this._channelId));
      out.channel = {id: channel.id, name: channel.name, type: channel.type, guildId: channel.guild_id};
      out.channelGuildId = channel.guild_id;
      out.botInGuild = out.guilds.some(g => g.id === channel.guild_id);
    } catch (err) {
      out.channelError = err.message;
    }
    return out;
  }

  /**
   * Test bot connection — verify channel access
   */
  async testConnection() {
    try {
      const channel = await this._rest.get(Routes.channel(this._channelId));
      return {
        success: true,
        channelName: channel.name || this._channelId,
        channelType: channel.type
      };
    } catch (err) {
      return {success: false, error: err.message};
    }
  }

  /**
   * Queue an email for Discord delivery
   */
  async queueEmailForDiscord(storeId, emailData) {
    const db = getFirestore();
    await db.collection(QUEUE_COLLECTION).add({
      storeId,
      emailData,
      status: 'pending',
      attempts: 0,
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Process pending queue items
   */
  async processQueue(storeId, batchSize = 10) {
    const db = getFirestore();
    const snapshot = await db.collection(QUEUE_COLLECTION)
      .where('storeId', '==', storeId)
      .where('status', '==', 'pending')
      .orderBy('createdAt')
      .limit(batchSize)
      .get();

    let sent = 0;
    let failed = 0;

    for (const doc of snapshot.docs) {
      const item = doc.data();
      try {
        const embed = this.createEmailEmbed(item.emailData);
        await this.sendEmbed(embed);
        await doc.ref.update({status: 'sent', sentAt: new Date().toISOString()});
        sent++;
      } catch (err) {
        const attempts = (item.attempts || 0) + 1;
        const status = attempts >= MAX_RETRIES ? 'failed' : 'pending';
        await doc.ref.update({status, attempts, lastError: err.message});
        if (status === 'failed') failed++;
      }

      // Rate limit spacing
      if (snapshot.docs.indexOf(doc) < snapshot.docs.length - 1) {
        await new Promise(r => setTimeout(r, SEND_DELAY_MS));
      }
    }

    return {sent, failed};
  }
}
