import React, {useState, useCallback} from 'react';
import {
  Page,
  Layout,
  Card,
  Tabs,
  TextField,
  Select,
  Button,
  InlineStack,
  BlockStack,
  Badge,
  Text,
  Spinner,
  EmptyState
} from '@shopify/polaris';
import {SearchIcon, FilterIcon} from '@shopify/polaris-icons';
import useFetchApi from '@assets/hooks/api/useFetchApi';
import TicketCard from '@assets/components/Tickets/TicketCard';

const STATUS_TABS = [
  {id: 'all', content: 'All'},
  {id: 'open', content: 'Open'},
  {id: 'pending', content: 'Pending'},
  {id: 'resolved', content: 'Resolved'}
];

const PRIORITY_OPTIONS = [
  {label: 'All priorities', value: ''},
  {label: 'Urgent', value: 'urgent'},
  {label: 'High', value: 'high'},
  {label: 'Normal', value: 'normal'},
  {label: 'Low', value: 'low'}
];

/**
 * Tickets page - main inbox view
 */
export default function TicketsPage() {
  const [selectedTab, setSelectedTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const statusFilter = STATUS_TABS[selectedTab].id === 'all' ? '' : STATUS_TABS[selectedTab].id;

  const {data: tickets, loading, fetchApi, pageInfo, count} = useFetchApi({
    url: '/api/v1/chatty/tickets',
    defaultData: [],
    initQueries: {hasCount: true, limit: 20}
  });

  const {data: counts} = useFetchApi({
    url: '/api/v1/chatty/tickets/counts',
    defaultData: {open: 0, pending: 0, resolved: 0, closed: 0}
  });

  const handleTabChange = useCallback(
    selectedTabIndex => {
      setSelectedTab(selectedTabIndex);
      const status = STATUS_TABS[selectedTabIndex].id === 'all' ? '' : STATUS_TABS[selectedTabIndex].id;
      fetchApi('/api/v1/chatty/tickets', {status, priority: priorityFilter, hasCount: true});
    },
    [priorityFilter]
  );

  const handlePriorityChange = useCallback(
    value => {
      setPriorityFilter(value);
      fetchApi('/api/v1/chatty/tickets', {status: statusFilter, priority: value, hasCount: true});
    },
    [statusFilter]
  );

  const handleSearch = useCallback(() => {
    if (searchQuery.trim().length >= 2) {
      fetchApi('/api/v1/chatty/tickets/search', {q: searchQuery});
    }
  }, [searchQuery]);

  const handleLoadMore = useCallback(() => {
    if (pageInfo.hasNext && tickets.length > 0) {
      const lastTicket = tickets[tickets.length - 1];
      fetchApi(
        '/api/v1/chatty/tickets',
        {status: statusFilter, priority: priorityFilter, after: lastTicket.id},
        true
      );
    }
  }, [tickets, pageInfo, statusFilter, priorityFilter]);

  // Format tab labels with counts
  const tabsWithCounts = STATUS_TABS.map(tab => {
    if (tab.id === 'all') {
      return {...tab, content: `All (${counts.open + counts.pending + counts.resolved})`};
    }
    return {...tab, content: `${tab.content} (${counts[tab.id] || 0})`};
  });

  return (
    <Page title="Inbox" fullWidth>
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {/* Search and filters */}
            <Card>
              <InlineStack gap="400" blockAlign="center">
                <div style={{flex: 1, maxWidth: '400px'}}>
                  <TextField
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search by email or subject..."
                    prefix={<SearchIcon />}
                    autoComplete="off"
                    onBlur={handleSearch}
                  />
                </div>
                <Select
                  label="Priority"
                  labelHidden
                  options={PRIORITY_OPTIONS}
                  value={priorityFilter}
                  onChange={handlePriorityChange}
                />
              </InlineStack>
            </Card>

            {/* Status tabs */}
            <Tabs tabs={tabsWithCounts} selected={selectedTab} onSelect={handleTabChange} fitted>
              <Card>
                {loading && tickets.length === 0 ? (
                  <div style={{padding: '40px', textAlign: 'center'}}>
                    <Spinner size="large" />
                  </div>
                ) : tickets.length === 0 ? (
                  <EmptyState
                    heading="No tickets found"
                    image=""
                  >
                    <p>When customers send emails, they&apos;ll appear here as tickets.</p>
                  </EmptyState>
                ) : (
                  <BlockStack gap="0">
                    {tickets.map(ticket => (
                      <TicketCard key={ticket.id} ticket={ticket} />
                    ))}
                  </BlockStack>
                )}

                {/* Load more */}
                {pageInfo.hasNext && (
                  <div style={{padding: '16px', textAlign: 'center'}}>
                    <Button onClick={handleLoadMore} loading={loading}>
                      Load more
                    </Button>
                  </div>
                )}
              </Card>
            </Tabs>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
