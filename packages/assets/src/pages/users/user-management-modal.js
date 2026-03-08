import React, {useState, useEffect} from 'react';
import PropTypes from 'prop-types';
import {Modal, FormLayout, TextField, Select, Banner, BlockStack, Divider} from '@shopify/polaris';
import UserFeatureAssignment from './user-feature-assignment';
import UserStoreAssignment from './user-store-assignment';

const ROLE_OPTIONS = [
  {label: 'Admin', value: 'admin'},
  {label: 'Manager', value: 'manager'},
  {label: 'Staff', value: 'staff'}
];

export default function UserManagementModal({user, stores, onClose, onSave}) {
  const isEdit = !!user;

  const [form, setForm] = useState({
    username: '',
    password: '',
    displayName: '',
    role: 'staff',
    assignedStores: [],
    allowedFeatures: []
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        username: user.username,
        password: '',
        displayName: user.displayName,
        role: user.role,
        assignedStores: user.assignedStores || [],
        allowedFeatures: user.allowedFeatures || []
      });
    }
  }, [user]);

  const set = field => val => setForm(f => ({...f, [field]: val}));

  const handleSave = async () => {
    setError('');
    if (!form.displayName || !form.role) {
      setError('Display name and role are required');
      return;
    }
    if (!isEdit && (!form.username || !form.password)) {
      setError('Username and password are required for new users');
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const isNonAdmin = form.role !== 'admin';

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Edit User' : 'Create User'}
      primaryAction={{content: 'Save', onAction: handleSave, loading: saving}}
      secondaryActions={[{content: 'Cancel', onAction: onClose}]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          {error && <Banner tone="critical">{error}</Banner>}
          <FormLayout>
            {!isEdit && (
              <TextField
                label="Username"
                value={form.username}
                onChange={set('username')}
                autoComplete="off"
              />
            )}
            <TextField
              label="Display Name"
              value={form.displayName}
              onChange={set('displayName')}
              autoComplete="off"
            />
            <TextField
              label={isEdit ? 'New Password (leave blank to keep current)' : 'Password'}
              type="password"
              value={form.password}
              onChange={set('password')}
              autoComplete="new-password"
            />
            <Select label="Role" options={ROLE_OPTIONS} value={form.role} onChange={set('role')} />
          </FormLayout>
        </BlockStack>
      </Modal.Section>

      {isNonAdmin && (
        <Modal.Section>
          <BlockStack gap="400">
            <UserStoreAssignment
              stores={stores || []}
              selectedStoreIds={form.assignedStores}
              onChange={set('assignedStores')}
            />
            <Divider />
            <UserFeatureAssignment
              selectedFeatures={form.allowedFeatures}
              onChange={set('allowedFeatures')}
            />
          </BlockStack>
        </Modal.Section>
      )}
    </Modal>
  );
}

UserManagementModal.propTypes = {
  user: PropTypes.object,
  stores: PropTypes.array,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired
};

UserManagementModal.defaultProps = {
  stores: []
};
