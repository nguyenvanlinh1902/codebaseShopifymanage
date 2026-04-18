import {DiscordScheduleRepository} from '../repositories/discord-schedule-repository.js';
import {DiscordSentEmailRepository} from '../repositories/discord-sent-email-repository.js';
import {DiscordService} from './discord-service.js';
import {EmailRuleService} from './email-rule-service.js';
import {GoogleAuthRepository} from '../repositories/googleAuthRepository.js';
import {GmailService} from './gmail-service.js';
import {OutlookService} from './outlook-service.js';

const VN_TZ = 'Asia/Ho_Chi_Minh';
const SEND_DELAY_MS = 1500;
const MAX_EMAILS_PER_RUN = 50;

/**
 * Return the UTC Date representing 00:00:00 of today in Asia/Ho_Chi_Minh.
 */
export function startOfDayVn(now = new Date()) {
  // VN is UTC+7, no DST.
  const utcMs = now.getTime();
  const vnMs = utcMs + 7 * 3600 * 1000;
  const vnDate = new Date(vnMs);
  vnDate.setUTCHours(0, 0, 0, 0);
  return new Date(vnDate.getTime() - 7 * 3600 * 1000);
}

/**
 * Compute next run time. If fromDate + interval is still in the past,
 * snap forward to the next future slot relative to now.
 */
export function calculateNextRun(intervalHours, fromDate = new Date()) {
  const hours = Number(intervalHours) || 1;
  // Round to whole minutes to avoid float drift (e.g. 0.0167h → 60.12s → misses cron tick)
  const intervalMs = Math.max(1, Math.round(hours * 60)) * 60 * 1000;
  const next = new Date(fromDate.getTime() + intervalMs);
  const now = new Date();
  if (next > now) return next;
  // Snap forward: find next future slot
  const elapsed = now.getTime() - fromDate.getTime();
  const slots = Math.ceil(elapsed / intervalMs);
  return new Date(fromDate.getTime() + slots * intervalMs);
}

/**
 * Discord Digest Service — runs a scheduled digest:
 * 1. List today's emails from each configured Gmail/Outlook account.
 * 2. Apply email rules (forward vs ignore).
 * 3. Atomically claim each message, send to Discord, mark sent.
 * 4. Skip any already-sent message (deduped by DiscordSentEmailRepository).
 */
export class DiscordDigestService {
  constructor() {
    this.scheduleRepo = new DiscordScheduleRepository();
    this.sentRepo = new DiscordSentEmailRepository();
    this.authRepo = new GoogleAuthRepository();
  }

  async runForStore(storeId, {sourceAccounts: overrideAccounts, testChannelId, force = false} = {}) {
    const schedule = await this.scheduleRepo.getByStoreId(storeId);
    if (!force && (!schedule || !schedule.enabled)) {
      return {sent: 0, failed: 0, skipped: 0, reason: 'disabled'};
    }

    const baseDiscord = await DiscordService.createFromConfig(storeId);
    if (!baseDiscord) {
      return {sent: 0, failed: 0, skipped: 0, reason: 'no-discord-config'};
    }

    const discord = testChannelId ? baseDiscord.withChannel(testChannelId) : baseDiscord;

    const ruleService = await EmailRuleService.createForStore(storeId);
    const allAccounts = await this.authRepo.getAllByStore(storeId);

    // Override from run-now takes priority, then schedule config, then all email accounts.
    const filterEmails = overrideAccounts?.length > 0
      ? overrideAccounts
      : schedule.sourceAccounts?.length > 0
        ? schedule.sourceAccounts
        : null;

    const selected = filterEmails
      ? allAccounts.filter(a => filterEmails.includes(a.googleEmail))
      : allAccounts.filter(a => a.authType === 'gmail' || a.authType === 'outlook');

    const sinceDate = startOfDayVn(new Date());
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const errors = [];

    for (const account of selected) {
      try {
        const emails = await this._listTodaysEmails(account, sinceDate);
        for (const email of emails) {
          if (sent + failed >= MAX_EMAILS_PER_RUN) break;

          // Apply user rules
          const action = ruleService.evaluate({...email, accountEmail: account.googleEmail});
          if (action !== 'forward') {
            skipped++;
            continue;
          }

          // Atomic claim — returns false if already sent
          const claimed = await this.sentRepo.claim(
            storeId,
            account.authType,
            account.googleEmail,
            email.id,
            {subject: (email.subject || '').slice(0, 140)}
          );
          if (!claimed) {
            skipped++;
            continue;
          }

          try {
            const embed = discord.createEmailEmbed({
              ...email,
              accountEmail: account.googleEmail,
              provider: account.authType
            });
            const result = await discord.sendEmbed(embed);
            await this.sentRepo.markSent(
              account.authType,
              account.googleEmail,
              email.id,
              {discordMessageId: result.messageId}
            );
            sent++;
            await new Promise(r => setTimeout(r, SEND_DELAY_MS));
          } catch (err) {
            await this.sentRepo.markFailed(
              account.authType,
              account.googleEmail,
              email.id,
              err.message
            );
            failed++;
            errors.push(`${account.googleEmail}/${email.id}: ${err.message}`);
          }
        }
      } catch (err) {
        console.error(`[DiscordDigest] Account ${account.googleEmail} error:`, err.message);
        errors.push(`${account.googleEmail}: ${err.message}`);
      }
    }

    return {
      sent,
      failed,
      skipped,
      error: errors.length > 0 ? errors.join('; ').slice(0, 500) : null
    };
  }

  /**
   * List emails received today (VN time) for a single auth account.
   */
  async _listTodaysEmails(account, sinceDate) {
    if (account.authType === 'gmail') {
      const service = GmailService.createFromAuthRecord(account);
      // Gmail query: after:YYYY/MM/DD (UTC-based; include today + yesterday VN boundary)
      const y = sinceDate.getUTCFullYear();
      const m = String(sinceDate.getUTCMonth() + 1).padStart(2, '0');
      const d = String(sinceDate.getUTCDate()).padStart(2, '0');
      const query = `after:${y}/${m}/${d}`;
      const {messages} = await service.listMessages(query, MAX_EMAILS_PER_RUN);
      return messages.filter(msg => {
        if (!msg.date) return true;
        const msgDate = new Date(msg.date);
        return !Number.isNaN(msgDate.getTime()) && msgDate >= sinceDate;
      });
    }

    if (account.authType === 'outlook') {
      const service = await OutlookService.createFromAuthRecord(account);
      const {messages} = await service.listMessages('', MAX_EMAILS_PER_RUN);
      return messages.filter(msg => {
        const iso = msg.receivedDateTime || msg.date;
        if (!iso) return false;
        const d = new Date(iso);
        return !Number.isNaN(d.getTime()) && d >= sinceDate;
      });
    }

    return [];
  }

  /**
   * Format a UTC date as Vietnam time for UI display.
   */
  static formatVn(utcDate) {
    if (!utcDate) return null;
    const d = utcDate instanceof Date ? utcDate : new Date(utcDate);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString('vi-VN', {
      timeZone: VN_TZ,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
