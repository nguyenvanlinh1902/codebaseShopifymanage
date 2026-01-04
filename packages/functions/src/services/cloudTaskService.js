import {getFunctions} from 'firebase-admin/functions';
import appConfig from '../config/app';
import fetch from 'node-fetch';
import {delay} from '@avada/utils/lib/delay';

export const ENQUEUE_SUBSCRIBER_FUNC_NAME = 'enqueueSubscriber';

// Cache task queues to avoid recreating them on every call
const queueCache = new Map();

const getTaskQueue = functionName => {
  if (!queueCache.has(functionName)) {
    queueCache.set(functionName, getFunctions().taskQueue(functionName));
  }
  return queueCache.get(functionName);
};

/**
 * Enqueue a task for background processing via Cloud Tasks
 *
 * Usage:
 *   await enqueueTask({
 *     data: { type: 'processOrder', shopId: '123', orderId: '456' },
 *     opts: { scheduleDelaySeconds: 60 } // optional delay
 *   });
 *
 * @description
 * There is no local emulator for cloud task, so if there is delay, we use nodejs delay to handle on local
 * @link https://firebase.google.com/docs/functions/task-functions?gen=2nd
 * @param {string} functionName - The cloud function name to enqueue to
 * @param {object} opts - Task options (scheduleDelaySeconds, etc.)
 * @param {object} data - The data payload to send to the task handler
 * @returns {Promise<any>}
 */
export async function enqueueTask({
  functionName = ENQUEUE_SUBSCRIBER_FUNC_NAME,
  opts = {},
  data = {}
}) {
  if (appConfig.isLocal) {
    if (opts.scheduleDelaySeconds) {
      await delay(opts.scheduleDelaySeconds * 1000);
    }

    return fetch(
      `http://localhost:5011/${process.env.GCLOUD_PROJECT}/us-central1/${functionName}`,
      {
        headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
        method: 'POST',
        body: JSON.stringify({data})
      }
    );
  }

  const queue = getTaskQueue(functionName);
  await queue.enqueue(data, opts);
}
