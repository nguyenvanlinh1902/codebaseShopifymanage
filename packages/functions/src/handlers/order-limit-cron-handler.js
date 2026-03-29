import {resetDailyCounters} from '../services/order-limit-service.js';

export async function processOrderLimitReset() {
  console.log('[OrderLimit] Cron: starting daily reset check');
  const result = await resetDailyCounters();
  console.log('[OrderLimit] Cron: completed', result);
}
