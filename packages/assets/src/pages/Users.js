import React, {useState, useEffect, useCallback} from 'react';
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
  EmptyState
} from '@shopify/polaris';
import {PlusIcon} from '@shopify/polaris-icons';
import {useApi} from '../hooks/useApi';
import {useAuth} from '../context/AuthContext';
import {useStores} from '../context/store-context';
import UserManagementModal from './users/user-management-modal';

const ROLE_TONES = {admin: 'info', manager: 'attention', staff: 'new'};

export default function Users() {
  const {user: currentUser} = useAuth();
  const {loading, error, clearError, get, post, put, del} = useApi();
  const [users, setUsers] = useState([]);
  const {stores} = useStores();
  const [modalUser, setModalUser] = useState(undefined); // undefined = closed, null = create, object = edit
  const [actionLoading, setActionLoading] = useState('');

  const fetchUsers = useCallback(async () => {
    const data = await get('/api/users');
    setUsers(data || []);
  }, [get]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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
    <Badge tone={ROLE_TONES[u.role] || 'new'} key={u.id + '-role'}>{u.role}</Badge>,
    <Badge tone={u.status === 'active' ? 'success' : 'critical'} key={u.id + '-status'}>
      {u.status || 'active'}
    </Badge>,
    u.role !== 'admin' ? (
      <Text variant="bodySm" key={u.id + '-stores'}>{(u.assignedStores || []).length} store(s)</Text>
    ) : (
      <Text variant="bodySm" tone="subdued" key={u.id + '-stores'}>All</Text>
    ),
    <InlineStack gap="200" key={u.id + '-actions'}>
      <Button size="slim" onClick={() => setModalUser(u)}>Edit</Button>
      {u.id !== currentUser?.id && u.status === 'inactive' && (
        <Button
          size="slim"
          tone="success"
          loading={actionLoading === u.id + '-active'}
          onClick={() => handleStatusToggle(u.id, 'active')}
        >
          Activate
        </Button>
      )}
      {u.id !== currentUser?.id && u.status !== 'inactive' && (
        <Button
          size="slim"
          tone="critical"
          loading={actionLoading === u.id + '-inactive'}
          onClick={() => handleStatusToggle(u.id, 'inactive')}
        >
          Deactivate
        </Button>
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
          <Banner tone="critical" onDismiss={clearError}>{error}</Banner>
        )}

        <Card padding="0">
          {loading ? (
            <div style={{padding: '40px', textAlign: 'center'}}>
              <Spinner size="large" />
            </div>
          ) : users.length === 0 ? (
            <EmptyState
              heading="No users found"
              action={{content: 'Create User', onAction: () => setModalUser(null)}}
              image=""
            >
              <Text>Create user accounts and assign access to stores.</Text>
            </EmptyState>
          ) : (
            <DataTable
              columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
              headings={['Username', 'Display Name', 'Role', 'Status', 'Stores', 'Actions']}
              rows={rows}
            />
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
