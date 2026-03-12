import axios from 'axios';

const BASE_URL = 'https://api.17track.net/track/v2.2';
const BATCH_SIZE = 40;

// Map 17TRACK v2.2 status strings to internal status codes
const STATUS_STRING_MAP = {
  'NotFound': 'not_found',
  'InTransit': 'in_transit',
  'Expired': 'expired',
  'PickUp': 'pick_up',
  'Undelivered': 'undelivered',
  'Delivered': 'delivered',
  'Alert': 'alert',
  'InfoReceived': 'in_transit'
};

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 Safari/604.1'
];

/**
 * SeventeenTrackService
 * Handles 17TRACK API calls with key rotation, quota management, and rate limiting.
 */
export class SeventeenTrackService {
  /** @param {import('../repositories/tracking-api-key-repository.js').TrackingApiKeyRepository} keyRepo */
  constructor(keyRepo) {
    this.keyRepo = keyRepo;
  }

  /**
   * Register new tracking numbers (consumes quota).
   * Chunks into batches of 40 with key rotation per batch.
   * @returns {{ accepted: string[], rejected: string[] }}
   */
  async registerTrackings(trackingNumbers) {
    const accepted = [];
    const rejected = [];
    const usedKeys = [];
    let error = null;
    const batches = this._chunkArray(trackingNumbers, BATCH_SIZE);

    for (const batch of batches) {
      let key;
      try {
        key = await this._getNextKey();
      } catch (err) {
        rejected.push(...batch);
        error = err.message;
        console.error('[17TRACK] No key for register:', err.message);
        continue;
      }

      try {
        const body = batch.map(n => ({number: String(n), carrier: 0}));
        const res = await this._makeRequest('/register', body, key.apiKey);
        console.log(`[17TRACK] Register response (key=${key.name}):`, JSON.stringify(res));
        const accepted17 = res?.data?.accepted || [];
        // Use original batch numbers for rejected (API may corrupt large numeric strings)
        const acceptedSet = new Set(accepted17.map(i => String(i.number)));
        accepted.push(...batch.filter(n => acceptedSet.has(String(n))));
        rejected.push(...batch.filter(n => !acceptedSet.has(String(n))));
        usedKeys.push({id: key.id, name: key.name});

        // Only increment quota by actually accepted count
        if (accepted17.length > 0) {
          await this.keyRepo.incrementQuota(key.id, accepted17.length);
        }
        await this.keyRepo.markSuccess(key.id);
      } catch (err) {
        rejected.push(...batch);
        error = err.message;
        console.error(`[17TRACK] Register error (key=${key.name}):`, err.message);
        await this.keyRepo.markError(key.id, err.message);
      }

      await this._rateLimitDelay();
    }

    return { accepted, rejected, usedKeys, error };
  }

  /**
   * Query tracking status for existing numbers (no quota cost).
   * @returns {Array<NormalizedTrackInfo>}
   */
  async getTrackInfo(trackingNumbers) {
    const results = [];
    const rejected = [];
    const usedKeys = [];
    let error = null;
    const batches = this._chunkArray(trackingNumbers, BATCH_SIZE);

    for (const batch of batches) {
      let key;
      try {
        key = await this._getAnyKey();
      } catch (err) {
        error = err.message;
        console.error('[17TRACK] No key for getTrackInfo:', err.message);
        break;
      }

      try {
        const body = batch.map(n => ({number: String(n)}));
        const res = await this._makeRequest('/gettrackinfo', body, key.apiKey);
        console.log(`[17TRACK] GetTrackInfo response (key=${key.name}):`, JSON.stringify(res));
        const accepted = res?.data?.accepted || [];
        results.push(...accepted.map(item => this._normalizeTrackInfo(item)));
        // Use original batch numbers for rejected (API may corrupt large numeric strings)
        const acceptedSet = new Set(accepted.map(i => String(i.number)));
        const batchRejected = batch.filter(n => !acceptedSet.has(String(n)));
        rejected.push(...batchRejected.map(n => ({number: n, error: 'rejected by 17TRACK'})));
        usedKeys.push({id: key.id, name: key.name});
        await this.keyRepo.markSuccess(key.id);
      } catch (err) {
        error = err.message;
        console.error(`[17TRACK] GetTrackInfo error (key=${key.name}):`, err.message);
        await this.keyRepo.markError(key.id, err.message);
      }

      await this._rateLimitDelay();
    }

    return { results, rejected, usedKeys, error };
  }

  /**
   * Get remaining quota from 17TRACK for a specific API key.
   * @param {string} apiKey - The 17TRACK API key
   * @returns {{ quotaTotal, quotaUsed, quotaRemain, todayUsed, maxTrackDaily }}
   */
  async getQuota(apiKey) {
    const res = await axios.post(`${BASE_URL}/getquota`, [], {
      headers: {
        '17token': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': this._randomUserAgent()
      },
      timeout: 10000
    });
    const d = res.data?.data || {};
    return {
      quotaTotal: d.quota_total ?? 0,
      quotaUsed: d.quota_used ?? 0,
      quotaRemain: d.quota_remain ?? 0,
      todayUsed: d.today_used ?? 0,
      maxTrackDaily: d.max_track_daily ?? 0
    };
  }

  /**
   * Register new numbers and query existing ones in one call.
   * @returns {{ registered: object, trackInfo: Array }}
   */
  async registerAndQuery(newNumbers, existingNumbers) {
    const [registered, trackInfo] = await Promise.all([
      newNumbers.length ? this.registerTrackings(newNumbers) : Promise.resolve({ accepted: [], rejected: [] }),
      existingNumbers.length ? this.getTrackInfo(existingNumbers) : Promise.resolve({ results: [], usedKeys: [] })
    ]);
    return { registered, trackInfo };
  }

  // --- Internal helpers ---

  /** POST to 17TRACK endpoint, handles 429 key-switch retry once */
  async _makeRequest(endpoint, body, apiKey, isRetry = false) {
    try {
      const res = await axios.post(`${BASE_URL}${endpoint}`, body, {
        headers: {
          '17token': apiKey,
          'Content-Type': 'application/json',
          'User-Agent': this._randomUserAgent()
        },
        timeout: 15000
      });
      return res.data;
    } catch (err) {
      const status = err.response?.status;

      if (status === 429 && !isRetry) {
        // Rate limited: get a fresh key and retry once
        const freshKey = await this._getNextKey();
        return this._makeRequest(endpoint, body, freshKey.apiKey, true);
      }

      if (status === 401 || status === 403) {
        // Find and ban the offending key
        const allKeys = await this.keyRepo.getAll();
        const match = allKeys.find(k => k.apiKey === apiKey);
        if (match) await this.keyRepo.update(match.id, { status: 'banned' });
      }

      throw new Error(`17TRACK ${endpoint} failed [${status || 'network'}]: ${err.message}`);
    }
  }

  /** Get next key with quota remaining (for register). Throws if none available. */
  async _getNextKey() {
    const key = await this.keyRepo.getAvailableKey();
    if (!key) throw new Error('No available 17TRACK API keys (quota >= 80%)');
    return key;
  }

  /** Get any active key regardless of quota (for free query operations). */
  async _getAnyKey() {
    const key = await this.keyRepo.getAnyActiveKey();
    if (!key) throw new Error('No active 17TRACK API keys');
    return key;
  }

  /** Random delay 1000-3000ms to respect 3 req/sec rate limit */
  _rateLimitDelay() {
    const ms = 1000 + Math.floor(Math.random() * 2000);
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** Random UA from pool */
  _randomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  /** Split array into chunks of given size */
  _chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
  }

  /** Normalize 17TRACK v2.2 response item to internal schema */
  _normalizeTrackInfo(item) {
    const info = item.track_info || {};
    const latestStatus = info.latest_status || {};
    const latestEvent = info.latest_event || {};
    const provider = info.tracking?.providers?.[0]?.provider || {};
    const providerEvents = info.tracking?.providers?.[0]?.events || [];

    const statusStr = latestStatus.status || '';
    const status = STATUS_STRING_MAP[statusStr] ?? 'not_found';

    const events = providerEvents.map(e => ({
      date: e.time_iso || '',
      description: e.description || '',
      location: e.location || '',
      stage: e.stage || ''
    }));

    return {
      trackingNumber: item.number,
      carrier: provider.name || '',
      carrierCode: item.carrier || provider.key || 0,
      status,
      statusCode: statusStr,
      subStatus: latestStatus.sub_status || '',
      lastEvent: latestEvent.description || '',
      lastEventDate: latestEvent.time_iso || '',
      lastEventLocation: latestEvent.location || '',
      daysInTransit: info.time_metrics?.days_of_transit || 0,
      serviceType: info.misc_info?.service_type || '',
      events
    };
  }
}
