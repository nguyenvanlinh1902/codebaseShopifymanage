import React, {useState, useEffect} from 'react';
import {
  Modal,
  ResourceList,
  ResourceItem,
  TextField,
  Button,
  InlineStack,
  BlockStack,
  Text,
  Spinner,
  Badge
} from '@shopify/polaris';
import {api} from '../../helpers/api';
import {useStores} from '../../context/store-context';
import SearchableChoiceList from '../../components/searchable-choice-list';

/**
 * StoreGroupManager — admin modal to create/edit/delete store groups
 * and assign stores to groups via checkboxes.
 */
export default function StoreGroupManager({open, onClose}) {
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStoreIds, setEditStoreIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // Stores from shared context
  const {stores: allStores, groups, loading: storesLoading, refetch} = useStores();

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await api('/api/store-groups', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name: newName.trim(), description: newDesc.trim()})
      });
      const data = await res.json();
      if (data.success) {
        await refetch();
        setNewName('');
        setNewDesc('');
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(groupId) {
    setSaving(true);
    try {
      // 1. Update group metadata
      const res = await api(`/api/store-groups/${groupId}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name: editName, description: editDesc})
      });
      const data = await res.json();
      if (!data.success) return;

      // 2. Batch-assign stores: compare current vs selected
      const currentInGroup = allStores.filter(s => s.groupId === groupId).map(s => s.id);
      const toAssign = editStoreIds.filter(id => !currentInGroup.includes(id));
      const toUnassign = currentInGroup.filter(id => !editStoreIds.includes(id));

      await Promise.all([
        ...toAssign.map(id =>
          api(`/api/stores/${id}`, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({groupId})})
        ),
        ...toUnassign.map(id =>
          api(`/api/stores/${id}`, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({groupId: null})})
        )
      ]);

      await refetch();
      setEditId(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setDeleting(id);
    try {
      const res = await api(`/api/store-groups/${id}`, {method: 'DELETE'});
      const data = await res.json();
      if (data.success) {
        await refetch();
      }
    } finally {
      setDeleting(null);
    }
  }

  function startEdit(group) {
    setEditId(group.id);
    setEditName(group.name);
    setEditDesc(group.description || '');
    setEditStoreIds(allStores.filter(s => s.groupId === group.id).map(s => s.id));
  }

  const storeChoices = allStores.map(s => ({
    label: s.name || s.shopDomain,
    value: s.id
  }));

  return (
    <Modal open={open} onClose={onClose} title="Manage Store Groups" large>
      <Modal.Section>
        <BlockStack gap="300">
          <Text variant="headingSm">Create New Group</Text>
          <TextField label="Name" value={newName} onChange={setNewName} placeholder="Group name" autoComplete="off" />
          <TextField label="Description (optional)" value={newDesc} onChange={setNewDesc} placeholder="Brief description" autoComplete="off" />
          <Button variant="primary" onClick={handleCreate} loading={creating} disabled={!newName.trim()}>
            Create Group
          </Button>
        </BlockStack>
      </Modal.Section>

      <Modal.Section>
        <Text variant="headingSm">Existing Groups</Text>
        {groups.length === 0 ? (
          <Text tone="subdued">No groups yet. Create one above.</Text>
        ) : (
          <ResourceList
            resourceName={{singular: 'group', plural: 'groups'}}
            items={groups}
            renderItem={group => {
              const storeCount = allStores.filter(s => s.groupId === group.id).length;
              return (
                <ResourceItem id={group.id} accessibilityLabel={group.name}>
                  {editId === group.id ? (
                    <BlockStack gap="300">
                      <TextField label="Name" value={editName} onChange={setEditName} autoComplete="off" />
                      <TextField label="Description" value={editDesc} onChange={setEditDesc} autoComplete="off" />
                      {storesLoading ? (
                        <InlineStack gap="200"><Spinner size="small" /><Text>Loading stores...</Text></InlineStack>
                      ) : storeChoices.length > 0 ? (
                        <SearchableChoiceList
                          title="Assign Stores"
                          choices={storeChoices}
                          selected={editStoreIds}
                          onChange={setEditStoreIds}
                          showSelectAll
                          searchPlaceholder="Search stores..."
                        />
                      ) : (
                        <Text tone="subdued">No stores available</Text>
                      )}
                      <InlineStack gap="200">
                        <Button variant="primary" onClick={() => handleUpdate(group.id)} loading={saving}>Save</Button>
                        <Button onClick={() => setEditId(null)}>Cancel</Button>
                      </InlineStack>
                    </BlockStack>
                  ) : (
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <InlineStack gap="200" blockAlign="center">
                          <Text variant="bodyMd" fontWeight="bold">{group.name}</Text>
                          <Badge>{storeCount} store{storeCount !== 1 ? 's' : ''}</Badge>
                        </InlineStack>
                        {group.description && <Text variant="bodySm" tone="subdued">{group.description}</Text>}
                      </BlockStack>
                      <InlineStack gap="200">
                        <Button variant="plain" onClick={() => startEdit(group)} disabled={storesLoading}>Edit</Button>
                        <Button variant="plain" tone="critical" onClick={() => handleDelete(group.id)} loading={deleting === group.id}>Delete</Button>
                      </InlineStack>
                    </InlineStack>
                  )}
                </ResourceItem>
              );
            }}
          />
        )}
      </Modal.Section>
    </Modal>
  );
}
