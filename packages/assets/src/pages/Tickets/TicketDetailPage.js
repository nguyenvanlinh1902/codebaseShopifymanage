import React, {useState, useCallback} from 'react';
import {useParams, useNavigate} from 'react-router-dom';
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Select,
  Button,
  TextField,
  Spinner,
  Box,
  Divider,
  Banner
} from '@shopify/polaris';
import {ArrowLeftIcon} from '@shopify/polaris-icons';
import useFetchApi from '@assets/hooks/api/useFetchApi';
import useCreateApi from '@assets/hooks/api/useCreateApi';
import useEditApi from '@assets/hooks/api/useEditApi';
import MessageBubble from '@assets/components/Tickets/MessageBubble';
import CustomerSidebar from '@assets/components/Tickets/CustomerSidebar';

const STATUS_OPTIONS = [
  {label: 'Open', value: 'open'},
  {label: 'Pending', value: 'pending'},
  {label: 'Resolved', value: 'resolved'},
  {label: 'Closed', value: 'closed'}
];

const PRIORITY_OPTIONS = [
  {label: 'Urgent', value: 'urgent'},
  {label: 'High', value: 'high'},
  {label: 'Normal', value: 'normal'},
  {label: 'Low', value: 'low'}
];

/**
 * Ticket detail page with conversation view
 */
export default function TicketDetailPage() {
  const {id} = useParams();
  const navigate = useNavigate();
  const [replyContent, setReplyContent] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);

  const {data, loading, fetchApi} = useFetchApi({
    url: `/api/v1/chatty/tickets/${id}`,
    defaultData: {ticket: null, messages: [], customer: null, assignee: null, tags: []}
  });

  const {creating: sendingReply, handleCreate: sendReply} = useCreateApi({
    url: `/api/v1/chatty/tickets/${id}/messages`
  });

  const {editing: updatingTicket, handleEdit: updateTicket} = useEditApi({
    url: `/api/v1/chatty/tickets/${id}`
  });

  const {data: teamMembers} = useFetchApi({
    url: '/api/v1/chatty/team/active',
    defaultData: []
  });

  const {ticket, messages, customer, assignee, tags} = data;

  const handleSendReply = useCallback(async () => {
    if (!replyContent.trim()) return;

    const success = await sendReply({
      content: replyContent,
      isInternal: isInternalNote
    });

    if (success) {
      setReplyContent('');
      setIsInternalNote(false);
      fetchApi();
    }
  }, [replyContent, isInternalNote]);

  const handleStatusChange = useCallback(
    async newStatus => {
      await updateTicket({status: newStatus});
      fetchApi();
    },
    [updateTicket]
  );

  const handlePriorityChange = useCallback(
    async newPriority => {
      await updateTicket({priority: newPriority});
      fetchApi();
    },
    [updateTicket]
  );

  const handleAssigneeChange = useCallback(
    async newAssigneeId => {
      await updateTicket({assigneeId: newAssigneeId || null});
      fetchApi();
    },
    [updateTicket]
  );

  if (loading && !ticket) {
    return (
      <Page>
        <div style={{padding: '100px', textAlign: 'center'}}>
          <Spinner size="large" />
        </div>
      </Page>
    );
  }

  if (!ticket) {
    return (
      <Page>
        <Banner tone="critical">Ticket not found</Banner>
      </Page>
    );
  }

  const assigneeOptions = [
    {label: 'Unassigned', value: ''},
    ...teamMembers.map(member => ({label: member.name, value: member.id}))
  ];

  return (
    <Page
      backAction={{content: 'Inbox', onAction: () => navigate('/tickets')}}
      title={`#${ticket.number}: ${ticket.subject}`}
      titleMetadata={
        <InlineStack gap="200">
          <Badge tone={ticket.status === 'open' ? 'critical' : ticket.status === 'resolved' ? 'success' : undefined}>
            {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
          </Badge>
          {ticket.priority !== 'normal' && (
            <Badge tone={ticket.priority === 'urgent' ? 'critical' : ticket.priority === 'high' ? 'warning' : undefined}>
              {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
            </Badge>
          )}
        </InlineStack>
      }
      fullWidth
    >
      <Layout>
        {/* Main conversation area */}
        <Layout.Section>
          <BlockStack gap="400">
            {/* Ticket controls */}
            <Card>
              <InlineStack gap="400" blockAlign="center">
                <Select
                  label="Status"
                  labelInline
                  options={STATUS_OPTIONS}
                  value={ticket.status}
                  onChange={handleStatusChange}
                  disabled={updatingTicket}
                />
                <Select
                  label="Priority"
                  labelInline
                  options={PRIORITY_OPTIONS}
                  value={ticket.priority}
                  onChange={handlePriorityChange}
                  disabled={updatingTicket}
                />
                <Select
                  label="Assignee"
                  labelInline
                  options={assigneeOptions}
                  value={assignee?.id || ''}
                  onChange={handleAssigneeChange}
                  disabled={updatingTicket}
                />
              </InlineStack>
            </Card>

            {/* Messages */}
            <Card>
              <BlockStack gap="400">
                {messages.map((message, index) => (
                  <React.Fragment key={message.id}>
                    {index > 0 && <Divider />}
                    <MessageBubble message={message} />
                  </React.Fragment>
                ))}
              </BlockStack>
            </Card>

            {/* Reply composer */}
            <Card>
              <BlockStack gap="300">
                <InlineStack gap="200">
                  <Button
                    pressed={!isInternalNote}
                    onClick={() => setIsInternalNote(false)}
                  >
                    Reply
                  </Button>
                  <Button
                    pressed={isInternalNote}
                    onClick={() => setIsInternalNote(true)}
                  >
                    Internal Note
                  </Button>
                </InlineStack>

                {isInternalNote && (
                  <Banner tone="warning">
                    Internal notes are only visible to your team
                  </Banner>
                )}

                <TextField
                  value={replyContent}
                  onChange={setReplyContent}
                  multiline={4}
                  placeholder={isInternalNote ? 'Add an internal note...' : 'Type your reply...'}
                  autoComplete="off"
                />

                <InlineStack gap="200" align="end">
                  <Button
                    variant="primary"
                    onClick={handleSendReply}
                    loading={sendingReply}
                    disabled={!replyContent.trim()}
                  >
                    {isInternalNote ? 'Add Note' : 'Send Reply'}
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        {/* Customer sidebar */}
        <Layout.Section variant="oneThird">
          <CustomerSidebar customer={customer} ticketId={ticket.id} />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
