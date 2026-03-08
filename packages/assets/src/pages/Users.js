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
import {api} from '../helpers/api';
import {useAuth} from '../context/AuthContext';
import UserManagementModal from './users/user-management-modal';

const ROLE_TONES = {admin: 'info', manager: 'attention', staff: 'new'};

export default function Users() {
  const {user: currentUser} = useAuth();
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalUser, setModalUser] = useState(undefined); // undefined = closed, null = create, object = edit
  const [actionLoading, setActionLoading] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api('/api/users');
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setUsers(data.data);
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStores = useCallback(async () => {
    try {
      const res = await api('/api/stores?limit=100');
      const data = await res.json();
      if (data.success) setStores(data.data || []);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchStores();
  }, [fetchUsers, fetchStores]);

  const handleSave = async form => {
    const isEdit = !!modalUser;
    const url = isEdit ? `/api/users/${modalUser.id}` : '/api/users';
    const method = isEdit ? 'PUT' : 'POST';

    const body = {...form};
    if (isEdit && !body.password) delete body.password;

    const res = await api(url, {method, body: JSON.stringify(body)});
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    await fetchUsers();
  };

  const handleDeactivate = async userId => {
    setActionLoading(userId);
    try {
      const res = await api(`/api/users/${userId}`, {method: 'DELETE'});
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await fetchUsers();
    } catch (err) {
      setError(err.message || 'Deactivate failed');
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
      <Text variant="bodySm" key={u.id + '-stores'}>
        {(u.assignedStores || []).length} store(s)
      </Text>
    ) : (
      <Text variant="bodySm" tone="subdued" key={u.id + '-stores'}>All</Text>
    ),
    <InlineStack gap="200" key={u.id + '-actions'}>
      <Button size="slim" onClick={() => setModalUser(u)}>
        Edit
      </Button>
      {u.id !== currentUser?.id && u.status !== 'inactive' && (
        <Button
          size="slim"
          tone="critical"
          loading={actionLoading === u.id}
          onClick={() => handleDeactivate(u.id)}
        >
          Deactivate
        </Button>
      )}
    </InlineStack>
  ]);

  return (
    <Page
      title="User Management"
      primaryAction={{
        content: 'Create User',
        icon: PlusIcon,
        onAction: () => setModalUser(null)
      }}
    >
      <BlockStack gap="400">
        {error && (
          <Banner tone="critical" onDismiss={() => setError('')}>
            {error}
          </Banner>
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
