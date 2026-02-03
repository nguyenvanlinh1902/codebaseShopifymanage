import React from 'react';
import {Box, InlineStack, Text} from '@shopify/polaris';
import PropTypes from 'prop-types';
import {formatDistanceToNow} from 'date-fns';

const ACTIVITY_MESSAGES = {
  created: activity => `${activity.actorName} created this ticket`,
  status_changed: activity =>
    `${activity.actorName} changed status from ${formatStatus(activity.metadata?.from)} to ${formatStatus(activity.metadata?.to)}`,
  assigned: activity =>
    activity.metadata?.to
      ? `${activity.actorName} assigned to ${activity.metadata.to}`
      : `${activity.actorName} removed assignment`,
  priority_changed: activity =>
    `${activity.actorName} changed priority from ${formatPriority(activity.metadata?.from)} to ${formatPriority(activity.metadata?.to)}`,
  tagged: activity =>
    activity.metadata?.action === 'added'
      ? `${activity.actorName} added tag "${activity.metadata.tagName}"`
      : `${activity.actorName} removed tag "${activity.metadata.tagName}"`,
  merged: activity => `${activity.actorName} merged ticket #${activity.metadata?.fromTicketNumber}`,
  reopened: activity => `${activity.actorName} reopened this ticket`
};

function formatStatus(status) {
  if (!status) return 'Unknown';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatPriority(priority) {
  if (!priority) return 'Unknown';
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

/**
 * Activity timeline entry component
 * Displays a single activity in the conversation timeline
 */
export default function ActivityTimeline({activity}) {
  const getMessage = () => {
    const messageGenerator = ACTIVITY_MESSAGES[activity.type];
    if (messageGenerator) {
      return messageGenerator(activity);
    }
    return `${activity.actorName} performed ${activity.type}`;
  };

  const timeAgo = formatDistanceToNow(new Date(activity.createdAt), {addSuffix: true});

  return (
    <Box padding="200">
      <InlineStack gap="200" blockAlign="center" align="center">
        <Text variant="bodySm" tone="subdued">
          {getMessage()}
        </Text>
        <Text variant="bodySm" tone="subdued">
          &middot;
        </Text>
        <Text variant="bodySm" tone="subdued">
          {timeAgo}
        </Text>
      </InlineStack>
    </Box>
  );
}

ActivityTimeline.propTypes = {
  activity: PropTypes.shape({
    id: PropTypes.string.isRequired,
    type: PropTypes.oneOf([
      'created',
      'status_changed',
      'assigned',
      'priority_changed',
      'tagged',
      'merged',
      'reopened'
    ]).isRequired,
    actorName: PropTypes.string.isRequired,
    metadata: PropTypes.object,
    createdAt: PropTypes.string.isRequired
  }).isRequired
};
