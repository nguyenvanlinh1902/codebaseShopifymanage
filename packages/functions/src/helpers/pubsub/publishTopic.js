import {PubSub} from '@google-cloud/pubsub';

// Reuse PubSub client across calls to avoid connection overhead
const pubSub = new PubSub();

// Cache topics to avoid recreating them
const topicCache = new Map();

const getTopic = name => {
  if (!topicCache.has(name)) {
    topicCache.set(name, pubSub.topic(name, {gaxOpts: {timeout: 540000}}));
  }
  return topicCache.get(name);
};

const publishTopic = async (name, data) => {
  const topic = getTopic(name);
  const message = Buffer.from(JSON.stringify(data));
  await topic.publish(message);
};

/**
 * Fire-and-forget version of publishTopic.
 * Does not wait for the publish to complete - useful when you don't need confirmation.
 * Errors are logged but not thrown.
 */
export const publishTopicAsync = (name, data) => {
  const topic = getTopic(name);
  const message = Buffer.from(JSON.stringify(data));
  topic.publish(message).catch(err => {
    console.error(`Failed to publish to topic ${name}:`, err);
  });
};

export default publishTopic;
