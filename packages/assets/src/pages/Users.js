import React, {useState, useEffect, useRef} from 'react';
import {
  Page,
  Card,
  DataTable,
  Button,
  Badge,
  BlockStack,
  InlineStack,
  Text,
  Banner,
  Spinner,
  EmptyState,
  Tooltip
} from '@shopify/polaris';
import {PlusIcon, EditIcon, PlayIcon, PauseCircleIcon, DeleteIcon} from '@shopify/polaris-icons';
import {useApi} from '../hooks/useApi';
import {useAuth} from '../context/AuthContext';
import {usePermittedStores} from '../hooks/usePermittedStores';
import PaginationControls from '../components/pagination-controls';
import UserManagementModal from './users/user-management-modal';

const ROLE_TONES = {admin: 'info', manager: 'attention', staff: 'new'};

export default function Users() {
  const {user: currentUser} = useAuth();
  const {loading, error, clearError, get, post, put, del} = useApi();
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({page: 1, perPage: 10, total: 0, totalPages: 1});
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const {stores} = usePermittedStores();
  const [modalUser, setModalUser] = useState(undefined);
  const [actionLoading, setActionLoading] = useState('');

  const fetchUsers = async () => {
    const params = new URLSearchParams({page, perPage, search});
    const json = await get(`/api/users?${params}`);
    if (json) {
      setUsers(json.data || json || []);
      if (json.pagination) setPagination(json.pagination);
    }
  };

  // Single effect: fetch + auto-reset page when filters change
  const filtersRef = useRef({perPage, search});
  useEffect(() => {
    const prev = filtersRef.current;
    const filtersChanged =
      prev.perPage !== perPage ||
      prev.search !== search;
    filtersRef.current = {perPage, search};

    if (filtersChanged && page !== 1) {
      setPage(1);
      return;
    }
    fetchUsers();
  }, [page, perPage, search]);

  const handleSave = async form => {
    const isEdit = !!modalUser;
    const body = {...form};
    if (isEdit && !body.password) delete body.password;

    if (isEdit) {
      await put(`/api/users/${modalUser.id}`, body);
    } else {
      await post('/api/users', body);
    }
    await fetchUsers();
  };

  const handleDelete = async userId => {
    if (!window.confirm('Are you sure you want to permanently delete this user? This cannot be undone.')) {
      return;
    }
    setActionLoading(userId + '-delete');
    try {
      await del(`/api/users/${userId}/permanent`);
      await fetchUsers();
    } finally {
      setActionLoading('');
    }
  };

  const handleStatusToggle = async (userId, newStatus) => {
    setActionLoading(userId + '-' + newStatus);
    try {
      if (newStatus === 'inactive') {
        await del(`/api/users/${userId}`);
      } else {
        await put(`/api/users/${userId}`, {status: 'active'});
      }
      await fetchUsers();
    } finally {
      setActionLoading('');
    }
  };

  const rows = users.map(u => [
    u.username,
    u.displayName,
    <Badge tone={ROLE_TONES[u.role] || 'new'} key={u.id + '-role'}>
      {u.role}
    </Badge>,
    <Badge tone={u.status === 'active' ? 'success' : 'critical'} key={u.id + '-status'}>
      {u.status || 'active'}
    </Badge>,
    u.role !== 'admin' ? (
      <div style={{maxWidth: 250, wordBreak: 'break-word'}} key={u.id + '-stores'}>
        <Text variant="bodySm">
          {(u.assignedStores || []).length > 0
            ? (u.assignedStores || [])
                .map(s => {
                  const id = typeof s === 'string' ? s : s.id;
                  const store = stores.find(st => st.id === id);
                  return store?.name || (typeof s === 'string' ? s : s.shopDomain);
                })
                .join(', ')
            : '—'}
        </Text>
      </div>
    ) : (
      <Text variant="bodySm" tone="subdued" key={u.id + '-stores'}>
        All
      </Text>
    ),
    <InlineStack gap="100" key={u.id + '-actions'}>
      <Tooltip content="Edit">
        <Button size="slim" icon={EditIcon} onClick={() => setModalUser(u)} accessibilityLabel="Edit" />
      </Tooltip>
      {u.id !== currentUser?.id && u.status === 'inactive' && (
        <Tooltip content="Activate">
          <Button
            size="slim"
            icon={PlayIcon}
            tone="success"
            loading={actionLoading === u.id + '-active'}
            onClick={() => handleStatusToggle(u.id, 'active')}
            accessibilityLabel="Activate"
          />
        </Tooltip>
      )}
      {u.id !== currentUser?.id && u.status !== 'inactive' && (
        <Tooltip content="Deactivate">
          <Button
            size="slim"
            icon={PauseCircleIcon}
            tone="critical"
            loading={actionLoading === u.id + '-inactive'}
            onClick={() => handleStatusToggle(u.id, 'inactive')}
            accessibilityLabel="Deactivate"
          />
        </Tooltip>
      )}
      {u.id !== currentUser?.id && (
        <Tooltip content="Delete">
          <Button
            size="slim"
            icon={DeleteIcon}
            variant="primary"
            tone="critical"
            loading={actionLoading === u.id + '-delete'}
            onClick={() => handleDelete(u.id)}
            accessibilityLabel="Delete"
          />
        </Tooltip>
      )}
    </InlineStack>
  ]);

  return (
    <Page
      title="User Management"
      primaryAction={{content: 'Create User', icon: PlusIcon, onAction: () => setModalUser(null)}}
    >
      <BlockStack gap="400">
        {error && (
          <Banner tone="critical" onDismiss={clearError}>
            {error}
          </Banner>
        )}

        <Card padding="0">
          {loading ? (
            <div style={{padding: '40px', textAlign: 'center'}}>
              <Spinner size="large" />
            </div>
          ) : users.length === 0 && !search ? (
            <EmptyState
              heading="No users found"
              action={{content: 'Create User', onAction: () => setModalUser(null)}}
              image=""
            >
              <Text>Create user accounts and assign access to stores.</Text>
            </EmptyState>
          ) : (
            <div style={{overflowX: 'hidden'}}>
              <style>{`.Polaris-DataTable__Cell { white-space: normal !important; }`}</style>
              <PaginationControls
                page={page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                perPage={perPage}
                onPageChange={setPage}
                onPerPageChange={setPerPage}
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search username, name, role..."
              />
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                headings={['Username', 'Display Name', 'Role', 'Status', 'Stores', 'Actions']}
                rows={rows}
              />
            </div>
          )}
        </Card>
      </BlockStack>

      {modalUser !== undefined && (
        <UserManagementModal
          user={modalUser}
          stores={stores}
          onClose={() => setModalUser(undefined)}
          onSave={handleSave}
        />
      )}
    </Page>
  );
}
