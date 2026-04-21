import {DiscordScheduleRepository} from '../repositories/discord-schedule-repository.js';
import {DiscordGroupScheduleRepository} from '../repositories/discord-group-schedule-repository.js';
import {DiscordSentEmailRepository} from '../repositories/discord-sent-email-repository.js';
import {DiscordService} from './discord-service.js';
import {EmailRuleService} from './email-rule-service.js';
import {GoogleAuthRepository} from '../repositories/googleAuthRepository.js';
import {StoreRepository} from '../repositories/storeRepository.js';
import {GmailService} from './gmail-service.js';
import {OutlookService} from './outlook-service.js';
import {resolveGroupIdsForAccount} from '../helpers/resolve-groups-for-account.js';

const VN_TZ = 'Asia/Ho_Chi_Minh';
// Discord channel rate limit is ~5 msg / 5s. 400ms leaves safe headroom while
// keeping a 50-email burst under Firebase Hosting's 60s rewrite timeout.
const SEND_DELAY_MS = 400;
const MAX_EMAILS_PER_RUN = 50;
// Parallelism ceiling for Gmail/Outlook fetch — Discord send stays sequential.
const FETCH_CONCURRENCY = 5;
// Soft time budget (ms). Stops claiming new work after this so the HTTP caller
// always gets a JSON response before the 60s hosting timeout.
const RUN_TIME_BUDGET_MS = 45_000;

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
    this.groupScheduleRepo = new DiscordGroupScheduleRepository();
    this.sentRepo = new DiscordSentEmailRepository();
    this.authRepo = new GoogleAuthRepository();
    this.storeRepo = new StoreRepository();
  }

  /**
   * Run digest for a single store group. Fan-out aware: for each account attached
   * to stores in this group (directly or via linkedStoreIds), forward today's
   * emails to this group's Discord channel iff rules of THIS group allow.
   */
  async runForGroup(groupId, {testChannelId, force = false} = {}) {
    const schedule = await this.groupScheduleRepo.getByGroupId(groupId);
    if (!force && (!schedule || !schedule.enabled)) {
      return {sent: 0, failed: 0, skipped: 0, reason: 'disabled'};
    }

    const baseDiscord = await DiscordService.createFromGroupConfig(groupId);
    if (!baseDiscord) {
      return {sent: 0, failed: 0, skipped: 0, reason: 'no-discord-config'};
    }
    const discord = testChannelId ? baseDiscord.withChannel(testChannelId) : baseDiscord;

    // Rules scoped to DESTINATION group (union of stores in this group).
    const ruleService = await EmailRuleService.createForGroup(groupId);

    // Load every gmail/outlook account and keep only those whose membership
    // resolves to this group — via primary storeId, via any linkedStoreIds,
    // or via linkedGroupIds. Earlier per-store fetch missed accounts whose
    // storeId lived outside the group but whose linkedStoreIds pointed in.
    const stores = await this.storeRepo.getByGroupId(groupId);
    const allAuth = await this.authRepo.getAll();
    const candidates = allAuth.filter(a => a.authType === 'gmail' || a.authType === 'outlook');

    const accountMap = new Map();
    let viaStore = 0, viaLinkedStore = 0, viaLinkedGroup = 0;
    const storeIdSet = new Set(stores.map(s => s.id));
    for (const a of candidates) {
      const linkedStoreIds = Array.isArray(a.linkedStoreIds) ? a.linkedStoreIds : [];
      const linkedGroupIds = Array.isArray(a.linkedGroupIds) ? a.linkedGroupIds : [];
      const hasViaStore = storeIdSet.has(a.storeId);
      const hasViaLinkedStore = linkedStoreIds.some(id => storeIdSet.has(id));
      const hasViaLinkedGroup = linkedGroupIds.includes(groupId);
      if (!(hasViaStore || hasViaLinkedStore || hasViaLinkedGroup)) continue;
      if (hasViaStore) viaStore++;
      else if (hasViaLinkedStore) viaLinkedStore++;
      else if (hasViaLinkedGroup) viaLinkedGroup++;
      if (!accountMap.has(a.googleEmail)) accountMap.set(a.googleEmail, a);
    }

    // Optional sourceAccounts filter (admin-configured).
    const filterEmails = schedule?.sourceAccounts?.length > 0 ? schedule.sourceAccounts : null;
    const selected = filterEmails
      ? Array.from(accountMap.values()).filter(a => filterEmails.includes(a.googleEmail))
      : Array.from(accountMap.values());

    if (selected.length === 0) {
      return {
        sent: 0, failed: 0, skipped: 0,
        reason: 'no-accounts',
        debug: {
          storesInGroup: stores.length,
          totalAccountsChecked: candidates.length,
          viaStore, viaLinkedStore, viaLinkedGroup,
          filterEmails: filterEmails || null
        }
      };
    }

    const sinceDate = startOfDayVn(new Date());
    const startedAt = Date.now();
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let emailsFound = 0;
    const errors = [];
    const accountBreakdown = [];
    let budgetExceeded = false;

    // Phase 1: fetch today's emails from every selected account in parallel
    // (bounded concurrency). Gmail/Outlook list calls are ~1s each; sequential
    // loop across 40+ accounts blows the 60s hosting budget.
    const accountPayloads = await this._fetchAllAccountsParallel(selected, sinceDate, groupId);

    // Phase 2: sequential Discord send (rate-limit safe).
    for (const payload of accountPayloads) {
      const {account, emails, fetchError, targetGroupIds} = payload;
      const perAccount = {
        email: account.googleEmail,
        emailsToday: emails?.length || 0,
        forwarded: 0,
        rejectedByRule: 0,
        alreadySent: 0,
        failed: 0,
        skippedReason: null
      };

      if (fetchError) {
        errors.push(`${account.googleEmail}: ${fetchError}`);
        perAccount.skippedReason = fetchError;
        accountBreakdown.push(perAccount);
        continue;
      }
      if (!targetGroupIds.includes(groupId)) {
        skipped++;
        perAccount.skippedReason = 'account-not-linked-to-this-group';
        accountBreakdown.push(perAccount);
        continue;
      }

      emailsFound += emails.length;
      try {
        for (const email of emails) {
          if (sent + failed >= MAX_EMAILS_PER_RUN) break;
          if (Date.now() - startedAt > RUN_TIME_BUDGET_MS) {
            budgetExceeded = true;
            break;
          }

          const action = ruleService.evaluate({...email, accountEmail: account.googleEmail});
          if (action !== 'forward') {
            skipped++;
            perAccount.rejectedByRule++;
            continue;
          }

          const claimed = await this.sentRepo.claimForGroup(
            groupId,
            account.storeId,
            account.authType,
            account.googleEmail,
            email.id,
            {subject: (email.subject || '').slice(0, 140)}
          );
          if (!claimed) {
            skipped++;
            perAccount.alreadySent++;
            continue;
          }

          try {
            const embed = discord.createEmailEmbed({
              ...email,
              accountEmail: account.googleEmail,
              provider: account.authType
            });
            const result = await discord.sendEmbed(embed);
            await this.sentRepo.markSentForGroup(
              groupId,
              account.authType,
              account.googleEmail,
              email.id,
              {discordMessageId: result.messageId}
            );
            sent++;
            perAccount.forwarded++;
            await new Promise(r => setTimeout(r, SEND_DELAY_MS));
          } catch (err) {
            perAccount.failed++;
            await this.sentRepo.markFailedForGroup(
              groupId,
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
        console.error(`[DiscordDigest:Group] group=${groupId} acct=${account.googleEmail} error:`, err.message);
        errors.push(`${account.googleEmail}: ${err.message}`);
        perAccount.skippedReason = err.message;
      }
      accountBreakdown.push(perAccount);
      if (budgetExceeded) break;
    }

    return {
      sent,
      failed,
      skipped,
      error: errors.length > 0 ? errors.join('; ').slice(0, 500) : null,
      budgetExceeded,
      debug: {
        accountsChecked: selected.length,
        emailsFound,
        elapsedMs: Date.now() - startedAt,
        accountBreakdown: accountBreakdown.slice(0, 20)
      }
    };
  }

  /**
   * Fetch today's emails for every selected account, with bounded concurrency
   * and resolveGroupIdsForAccount resolved per account. Never throws —
   * per-account errors are bundled into the result.
   */
  async _fetchAllAccountsParallel(accounts, sinceDate, groupId) {
    const results = new Array(accounts.length);
    let cursor = 0;
    const worker = async () => {
      while (cursor < accounts.length) {
        const i = cursor++;
        const account = accounts[i];
        try {
          const targetGroupIds = await resolveGroupIdsForAccount(account);
          if (!targetGroupIds.includes(groupId)) {
            results[i] = {account, emails: [], targetGroupIds};
            continue;
          }
          const emails = await this._listTodaysEmails(account, sinceDate);
          results[i] = {account, emails, targetGroupIds};
        } catch (err) {
          results[i] = {account, emails: [], targetGroupIds: [], fetchError: err.message};
        }
      }
    };
    await Promise.all(Array.from({length: FETCH_CONCURRENCY}, worker));
    return results;
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
