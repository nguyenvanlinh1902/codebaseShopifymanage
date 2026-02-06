import {PubSub} from '@google-cloud/pubsub';

const pubsub = new PubSub();

/**
 * Get or create PubSub topic
 * Automatically creates topic if it doesn't exist (useful for local emulator)
 */
export async function getOrCreateTopic(topicName) {
  try {
    const topic = pubsub.topic(topicName);

    // Check if topic exists
    const [exists] = await topic.exists();

    if (!exists) {
      console.log(`Topic ${topicName} doesn't exist. Creating...`);
      await topic.create();
      console.log(`✅ Created topic: ${topicName}`);
    }

    return topic;
  } catch (error) {
    console.error(`Error getting/creating topic ${topicName}:`, error);
    throw error;
  }
}

/**
 * Publish message to topic (with auto-creation)
 */
export async function publishMessage(topicName, message) {
  try {
    const topic = await getOrCreateTopic(topicName);
    const messageId = await topic.publishMessage({json: message});
    return messageId;
  } catch (error) {
    console.error(`Error publishing to ${topicName}:`, error);
    throw error;
  }
}

export {pubsub};
