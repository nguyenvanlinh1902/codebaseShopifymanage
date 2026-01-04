/**
 * Background handler for PubSub messages
 *
 * Usage:
 *   publishTopic('backgroundHandling', {
 *     type: 'processOrder',
 *     shopId: '...',
 *     data: {...}
 *   })
 *
 * @param event - CloudEvent with PubSub message
 * @returns {Promise<void>}
 */
export default async function subscribeBackgroundHandling(event) {
  try {
    const data = event.data.message.json;
    const {type, shopId} = data;

    switch (type) {
      case 'afterInstall':
        // TODO: Add your post-installation logic here
        // Example: sync initial data, register webhooks, etc.
        console.log('Processing afterInstall for shop:', shopId);
        break;
      default:
        console.log('Unknown background task type:', type);
    }
  } catch (e) {
    console.error('Background handling error:', e);
  }
}
