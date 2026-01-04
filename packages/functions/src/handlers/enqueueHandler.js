/**
 * Cloud Tasks queue handler for scheduled/delayed task processing
 *
 * Usage:
 *   import {enqueueTask} from '@functions/services/cloudTaskService';
 *
 *   // Simple enqueue
 *   await enqueueTask({
 *     data: {type: 'processOrder', shopId: '123', orderId: '456'}
 *   });
 *
 *   // With delay (60 seconds)
 *   await enqueueTask({
 *     data: {type: 'sendEmail', shopId: '123'},
 *     opts: {scheduleDelaySeconds: 60}
 *   });
 *
 * @param request - Task request with data payload
 * @returns {Promise<void>}
 */
export default async function enqueueHandler(request) {
  try {
    const {type, shopId} = request.data;

    switch (type) {
      case 'processOrder':
        // TODO: Add your order processing logic here
        console.log('Processing order for shop:', shopId);
        break;
      default:
        console.log('Unknown enqueue task type:', type);
    }
  } catch (e) {
    console.error('Enqueue handler error:', e);
    throw e; // Re-throw to trigger retry if configured
  }
}
