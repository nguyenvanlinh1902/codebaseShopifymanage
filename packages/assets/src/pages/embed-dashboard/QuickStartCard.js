import React from 'react';
import PropTypes from 'prop-types';
import {
  Card,
  BlockStack,
  InlineStack,
  InlineGrid,
  Text,
  Button,
  Box,
  Divider,
  Collapsible,
  ProgressBar
} from '@shopify/polaris';
import {ChevronDownIcon, ChevronUpIcon} from '@shopify/polaris-icons';
import QuickStartTask from './QuickStartTask';

export default function QuickStartCard({
  quickStartDismissed,
  quickStartOpen,
  setQuickStartOpen,
  completedCount,
  totalTasks,
  percentCompleted,
  tasks,
  selectedTask,
  setSelectedTask
}) {
  if (quickStartDismissed) return null;

  return (
    <Card padding="0">
      <Box padding="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingSm" as="h3">
            Quick Start
          </Text>
          <InlineStack gap="100" blockAlign="center">
            <Button
              variant="plain"
              onClick={() => setQuickStartOpen(prev => !prev)}
              icon={quickStartOpen ? ChevronUpIcon : ChevronDownIcon}
            />
          </InlineStack>
        </InlineStack>
      </Box>
      <Divider />
      <Box padding="400">
        <InlineGrid columns="auto 1fr" alignItems="center" gap="300">
          <Text variant="bodySm" tone="subdued">
            {completedCount} of {totalTasks} tasks completed
          </Text>
          <ProgressBar progress={percentCompleted} size="small" tone="primary" />
        </InlineGrid>
      </Box>
      <Collapsible
        open={quickStartOpen}
        transition={{duration: '200ms', timingFunction: 'ease-in-out'}}
      >
        <Box paddingInline="200" paddingBlockEnd="200">
          <BlockStack gap="100">
            {tasks.map(task => (
              <QuickStartTask
                key={task.id}
                completed={task.completed}
                label={task.label}
                description={task.description}
                selected={selectedTask === task.id}
                onSelect={() => setSelectedTask(task.id)}
                buttons={task.buttons}
              />
            ))}
          </BlockStack>
        </Box>
      </Collapsible>
    </Card>
  );
}

QuickStartCard.propTypes = {
  quickStartDismissed: PropTypes.bool.isRequired,
  quickStartOpen: PropTypes.bool.isRequired,
  setQuickStartOpen: PropTypes.func.isRequired,
  completedCount: PropTypes.number.isRequired,
  totalTasks: PropTypes.number.isRequired,
  percentCompleted: PropTypes.number.isRequired,
  tasks: PropTypes.array.isRequired,
  selectedTask: PropTypes.string,
  setSelectedTask: PropTypes.func.isRequired
};
