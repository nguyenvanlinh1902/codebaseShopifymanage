# Shopify Polaris (React) - v12

## Version Info

| Package | Version | Notes |
|---------|---------|-------|
| @shopify/polaris | ^12.16.0 | React component library |
| @shopify/polaris-icons | 9.3.0 | Icons v9 (no Minor/Major suffix) |
| @shopify/polaris-viz | ^15.1.3 | Charts and visualizations |
| @shopify/app-bridge-react | ^4.1.5 | Shopify App Bridge |

---

## Icons v9 (CRITICAL)

```javascript
// ✅ GOOD: v9 icons (no suffix)
import {
  PlusCircleIcon,
  DeleteIcon,
  EditIcon,
  SearchIcon,
  ChevronRightIcon,
  AlertCircleIcon,
  MenuHorizontalIcon
} from '@shopify/polaris-icons';

// ❌ BAD: Old v8 icons (with Minor/Major suffix)
import {SearchMinor, PlusMajor} from '@shopify/polaris-icons';
```

### Common Icon Names

| Action | Icon Name |
|--------|-----------|
| Add | `PlusIcon`, `PlusCircleIcon` |
| Delete | `DeleteIcon`, `XIcon` |
| Edit | `EditIcon` |
| Search | `SearchIcon` |
| Settings | `SettingsIcon` |
| Save | `SaveIcon` |
| Cancel | `XCircleIcon` |
| Info | `InfoIcon` |
| Warning | `AlertTriangleIcon` |
| Error | `AlertCircleIcon` |
| Success | `CheckIcon`, `CheckCircleIcon` |
| Menu | `MenuHorizontalIcon`, `MenuVerticalIcon` |
| Chevron | `ChevronRightIcon`, `ChevronDownIcon`, `ChevronUpIcon` |
| External | `ExternalIcon` |
| Export | `ExportIcon` |
| Import | `ImportIcon` |

---

## Layout Components

### Page Structure

```javascript
import {Page, Layout, Card, BlockStack, Box} from '@shopify/polaris';

function MyPage() {
  return (
    <Page
      title="Page Title"
      subtitle="Optional subtitle"
      primaryAction={{content: 'Save', onAction: handleSave}}
      secondaryActions={[
        {content: 'Export', onAction: handleExport}
      ]}
      backAction={{content: 'Back', onAction: () => history.goBack()}}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              {/* Main content */}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            {/* Sidebar content */}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
```

### BlockStack vs InlineStack

```javascript
import {BlockStack, InlineStack, Text, Button} from '@shopify/polaris';

// BlockStack: Vertical stacking (column)
<BlockStack gap="400">
  <Text>Item 1</Text>
  <Text>Item 2</Text>
</BlockStack>

// InlineStack: Horizontal stacking (row)
<InlineStack gap="200" align="center" blockAlign="center">
  <Button>Cancel</Button>
  <Button variant="primary">Save</Button>
</InlineStack>
```

### Box (Spacing & Layout)

```javascript
import {Box, Card, Text} from '@shopify/polaris';

<Card>
  <Box padding="400" background="bg-surface-secondary">
    <Text>Padded content with background</Text>
  </Box>
</Card>

// Common Box props
<Box
  padding="400"           // All sides
  paddingBlock="200"      // Top & bottom
  paddingInline="400"     // Left & right
  background="bg-surface"
  borderRadius="200"
  borderColor="border"
  borderWidth="025"
/>
```

### Spacing Tokens

| Token | Value | Use Case |
|-------|-------|----------|
| 100 | 4px | Tight spacing |
| 200 | 8px | Small gaps |
| 300 | 12px | Medium-small |
| 400 | 16px | Default spacing |
| 500 | 20px | Medium-large |
| 600 | 24px | Large gaps |
| 800 | 32px | Section spacing |

---

## Card Patterns

### Basic Card

```javascript
import {Card, Text, BlockStack} from '@shopify/polaris';

<Card>
  <BlockStack gap="400">
    <Text variant="headingMd" as="h2">Card Title</Text>
    <Text>Card content goes here</Text>
  </BlockStack>
</Card>
```

### Card with Sections

```javascript
import {Card, BlockStack, Box, Text, Divider} from '@shopify/polaris';

<Card>
  <BlockStack gap="400">
    <Box padding="400">
      <Text variant="headingMd">Section 1</Text>
    </Box>
    <Divider />
    <Box padding="400">
      <Text>Section 2 content</Text>
    </Box>
  </BlockStack>
</Card>
```

### LegacyCard (Avoid for new code)

```javascript
// ❌ Avoid LegacyCard in new code
import {LegacyCard} from '@shopify/polaris';

// ✅ Use Card + Box/BlockStack instead
import {Card, Box, BlockStack} from '@shopify/polaris';
```

---

## Form Components

### TextField

```javascript
import {TextField} from '@shopify/polaris';

<TextField
  label="Email"
  type="email"
  value={email}
  onChange={setEmail}
  placeholder="example@shop.com"
  helpText="We'll send notifications here"
  error={emailError}
  autoComplete="email"
/>

// Number field
<TextField
  label="Points"
  type="number"
  value={points}
  onChange={setPoints}
  min={0}
  max={1000}
  suffix="pts"
/>
```

### Select

```javascript
import {Select} from '@shopify/polaris';

const options = [
  {label: 'Option 1', value: '1'},
  {label: 'Option 2', value: '2'},
  {label: 'Disabled', value: '3', disabled: true}
];

<Select
  label="Choose tier"
  options={options}
  value={selected}
  onChange={setSelected}
  helpText="Select customer tier"
/>
```

### Checkbox

```javascript
import {Checkbox} from '@shopify/polaris';

<Checkbox
  label="Enable feature"
  checked={enabled}
  onChange={setEnabled}
  helpText="Turn this on to activate"
/>
```

### FormLayout

```javascript
import {FormLayout, TextField, Select} from '@shopify/polaris';

<FormLayout>
  <TextField label="Name" value={name} onChange={setName} />
  <FormLayout.Group>
    <TextField label="First name" value={first} onChange={setFirst} />
    <TextField label="Last name" value={last} onChange={setLast} />
  </FormLayout.Group>
  <Select label="Country" options={countries} value={country} onChange={setCountry} />
</FormLayout>
```

---

## Button Patterns

### Button Variants

```javascript
import {Button, ButtonGroup} from '@shopify/polaris';
import {PlusIcon, DeleteIcon} from '@shopify/polaris-icons';

// Primary action
<Button variant="primary" onClick={handleSave}>Save</Button>

// Secondary (default)
<Button onClick={handleCancel}>Cancel</Button>

// Destructive
<Button variant="primary" tone="critical" onClick={handleDelete}>Delete</Button>

// With icon
<Button icon={PlusIcon} onClick={handleAdd}>Add tier</Button>

// Icon only
<Button icon={DeleteIcon} accessibilityLabel="Delete" onClick={handleDelete} />

// Loading state
<Button variant="primary" loading={saving} onClick={handleSave}>
  {saving ? 'Saving...' : 'Save'}
</Button>
```

### Navigation (CRITICAL)

```javascript
// ✅ GOOD: Use url prop for navigation
<Button url="/settings">Go to Settings</Button>
<Button url="https://help.shopify.com" external>Help</Button>

// ❌ BAD: onClick + window.open
<Button onClick={() => window.open('/settings')}>Settings</Button>
```

### ButtonGroup

```javascript
import {ButtonGroup, Button} from '@shopify/polaris';

<ButtonGroup>
  <Button>Cancel</Button>
  <Button variant="primary">Save</Button>
</ButtonGroup>

// Segmented (toggle group)
<ButtonGroup variant="segmented">
  <Button pressed={view === 'list'} onClick={() => setView('list')}>List</Button>
  <Button pressed={view === 'grid'} onClick={() => setView('grid')}>Grid</Button>
</ButtonGroup>
```

---

## Data Display

### Text Variants

```javascript
import {Text} from '@shopify/polaris';

<Text variant="headingXl" as="h1">Page Title</Text>
<Text variant="headingLg" as="h2">Section Title</Text>
<Text variant="headingMd" as="h3">Card Title</Text>
<Text variant="headingSm" as="h4">Subsection</Text>
<Text variant="bodyMd">Regular body text</Text>
<Text variant="bodySm">Small text</Text>

// With tone
<Text tone="subdued">Secondary text</Text>
<Text tone="success">Success message</Text>
<Text tone="critical">Error message</Text>

// Font weight
<Text fontWeight="bold">Bold text</Text>
<Text fontWeight="semibold">Semibold text</Text>
```

### Badge

```javascript
import {Badge} from '@shopify/polaris';

<Badge>Default</Badge>
<Badge tone="info">Info</Badge>
<Badge tone="success">Active</Badge>
<Badge tone="warning">Pending</Badge>
<Badge tone="critical">Error</Badge>
<Badge tone="attention">Attention</Badge>

// With progress
<Badge progress="incomplete">Draft</Badge>
<Badge progress="partiallyComplete" tone="warning">In Progress</Badge>
<Badge progress="complete" tone="success">Complete</Badge>
```

### ResourceList

```javascript
import {ResourceList, ResourceItem, Text, Avatar} from '@shopify/polaris';

<ResourceList
  resourceName={{singular: 'customer', plural: 'customers'}}
  items={customers}
  renderItem={(customer) => (
    <ResourceItem
      id={customer.id}
      media={<Avatar customer name={customer.name} />}
      accessibilityLabel={`View ${customer.name}`}
      onClick={() => handleClick(customer.id)}
    >
      <Text variant="bodyMd" fontWeight="bold">{customer.name}</Text>
      <Text variant="bodySm" tone="subdued">{customer.email}</Text>
    </ResourceItem>
  )}
/>
```

### IndexTable

```javascript
import {IndexTable, Text, Badge} from '@shopify/polaris';

const resourceName = {singular: 'order', plural: 'orders'};

<IndexTable
  resourceName={resourceName}
  itemCount={orders.length}
  selectedItemsCount={selectedResources.length}
  onSelectionChange={handleSelectionChange}
  headings={[
    {title: 'Order'},
    {title: 'Customer'},
    {title: 'Total'},
    {title: 'Status'}
  ]}
>
  {orders.map((order, index) => (
    <IndexTable.Row
      id={order.id}
      key={order.id}
      selected={selectedResources.includes(order.id)}
      position={index}
    >
      <IndexTable.Cell>
        <Text fontWeight="bold">#{order.number}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{order.customer}</IndexTable.Cell>
      <IndexTable.Cell>{order.total}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone="success">{order.status}</Badge>
      </IndexTable.Cell>
    </IndexTable.Row>
  ))}
</IndexTable>
```

---

## Feedback Components

### Banner

```javascript
import {Banner} from '@shopify/polaris';

// Info
<Banner title="Info" tone="info">
  This is informational content.
</Banner>

// Success
<Banner title="Success" tone="success" onDismiss={() => setShow(false)}>
  Changes saved successfully.
</Banner>

// Warning
<Banner title="Warning" tone="warning">
  This action cannot be undone.
</Banner>

// Critical
<Banner title="Error" tone="critical">
  Failed to save changes.
</Banner>

// With actions
<Banner
  title="Sync required"
  tone="warning"
  action={{content: 'Sync now', onAction: handleSync}}
  secondaryAction={{content: 'Learn more', url: '/help'}}
>
  Customer data is out of sync.
</Banner>
```

### Toast (via App Bridge)

```javascript
import {useAppBridge} from '@shopify/app-bridge-react';
import {Toast} from '@shopify/app-bridge/actions';

function MyComponent() {
  const app = useAppBridge();

  const showToast = (message, isError = false) => {
    const toast = Toast.create(app, {
      message,
      duration: 3000,
      isError
    });
    toast.dispatch(Toast.Action.SHOW);
  };

  return (
    <Button onClick={() => showToast('Saved successfully')}>
      Save
    </Button>
  );
}
```

---

## Modal

### Basic Modal

```javascript
import {Modal, Text} from '@shopify/polaris';

<Modal
  open={open}
  onClose={() => setOpen(false)}
  title="Confirm action"
  primaryAction={{
    content: 'Confirm',
    onAction: handleConfirm,
    loading: loading
  }}
  secondaryActions={[
    {content: 'Cancel', onAction: () => setOpen(false)}
  ]}
>
  <Modal.Section>
    <Text>Are you sure you want to proceed?</Text>
  </Modal.Section>
</Modal>
```

### useConfirmModal Hook Pattern

```javascript
// hooks/modal/useConfirmModal.js
import {useState, useRef} from 'react';
import {Modal} from '@shopify/polaris';

export default function useConfirmModal({
  title,
  content,
  confirmAction,
  buttonTitle = 'Confirm',
  destructive = false
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const openModal = (data = null) => {
    inputRef.current = data;
    setOpen(true);
  };

  const closeModal = () => setOpen(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await confirmAction(inputRef.current);
      closeModal();
    } finally {
      setLoading(false);
    }
  };

  const modal = (
    <Modal
      open={open}
      onClose={closeModal}
      title={title}
      primaryAction={{
        content: buttonTitle,
        onAction: handleConfirm,
        loading,
        destructive
      }}
      secondaryActions={[{content: 'Cancel', onAction: closeModal}]}
    >
      <Modal.Section>{content}</Modal.Section>
    </Modal>
  );

  return {modal, openModal, closeModal};
}

// Usage
const {modal, openModal} = useConfirmModal({
  title: 'Delete tier?',
  content: 'This action cannot be undone.',
  confirmAction: async (tierId) => await deleteTier(tierId),
  destructive: true
});

<Button tone="critical" onClick={() => openModal(tier.id)}>Delete</Button>
{modal}
```

---

## Tabs

```javascript
import {Tabs} from '@shopify/polaris';

const tabs = [
  {id: 'tiers', content: 'VIP Tiers', accessibilityLabel: 'VIP Tiers'},
  {id: 'design', content: 'Design'},
  {id: 'notifications', content: 'Notifications'}
];

<Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
  {selectedTab === 0 && <TiersContent />}
  {selectedTab === 1 && <DesignContent />}
  {selectedTab === 2 && <NotificationsContent />}
</Tabs>
```

---

## Loading States

### Skeleton

```javascript
import {
  SkeletonPage,
  SkeletonBodyText,
  SkeletonDisplayText,
  Card,
  Layout
} from '@shopify/polaris';

function PageSkeleton() {
  return (
    <SkeletonPage primaryAction>
      <Layout>
        <Layout.Section>
          <Card>
            <SkeletonDisplayText size="small" />
            <SkeletonBodyText lines={3} />
          </Card>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}
```

### Spinner

```javascript
import {Spinner, Box} from '@shopify/polaris';

// Inline spinner
<Spinner size="small" />

// Centered spinner
<Box padding="800" textAlign="center">
  <Spinner />
</Box>
```

---

## Popover & Tooltip

### Popover

```javascript
import {Popover, ActionList, Button} from '@shopify/polaris';
import {MenuHorizontalIcon} from '@shopify/polaris-icons';

const [active, setActive] = useState(false);

<Popover
  active={active}
  activator={
    <Button icon={MenuHorizontalIcon} onClick={() => setActive(true)} />
  }
  onClose={() => setActive(false)}
>
  <ActionList
    items={[
      {content: 'Edit', onAction: handleEdit},
      {content: 'Duplicate', onAction: handleDuplicate},
      {content: 'Delete', destructive: true, onAction: handleDelete}
    ]}
  />
</Popover>
```

### Tooltip

```javascript
import {Tooltip, Button} from '@shopify/polaris';
import {InfoIcon} from '@shopify/polaris-icons';

<Tooltip content="This feature requires the Advanced plan">
  <Button icon={InfoIcon} accessibilityLabel="Info" />
</Tooltip>
```

---

## Collapsible

```javascript
import {Collapsible, Button, Card, BlockStack} from '@shopify/polaris';
import {ChevronDownIcon, ChevronUpIcon} from '@shopify/polaris-icons';

const [open, setOpen] = useState(false);

<Card>
  <BlockStack gap="400">
    <Button
      onClick={() => setOpen(!open)}
      ariaExpanded={open}
      icon={open ? ChevronUpIcon : ChevronDownIcon}
      fullWidth
      textAlign="left"
    >
      Advanced settings
    </Button>
    <Collapsible open={open}>
      <Box padding="400">
        {/* Collapsible content */}
      </Box>
    </Collapsible>
  </BlockStack>
</Card>
```

---

## Polaris Viz (Charts)

```javascript
import {BarChart, LineChart} from '@shopify/polaris-viz';

// Bar Chart
<BarChart
  data={[
    {
      name: 'Points earned',
      data: [
        {key: 'Jan', value: 1200},
        {key: 'Feb', value: 1800},
        {key: 'Mar', value: 2400}
      ]
    }
  ]}
/>

// Line Chart
<LineChart
  data={[
    {
      name: 'Revenue',
      data: [
        {key: 'Jan', value: 5000},
        {key: 'Feb', value: 7500},
        {key: 'Mar', value: 6800}
      ]
    }
  ]}
/>
```

---

## Migration Notes (v11 → v12)

### Deprecated → New

| Deprecated | Replacement |
|------------|-------------|
| `Stack` | `BlockStack` / `InlineStack` |
| `Stack.Item` | Direct children |
| `TextStyle` | `Text` with props |
| `Heading` | `Text variant="heading*"` |
| `Subheading` | `Text variant="headingSm"` |
| `Caption` | `Text variant="bodySm"` |
| `DisplayText` | `Text variant="heading*"` |
| `LegacyCard` | `Card` + `Box` |
| `LegacyStack` | `BlockStack` / `InlineStack` |

### Component Changes

```javascript
// ❌ OLD: Stack
<Stack vertical spacing="loose">
  <Stack.Item fill>Content</Stack.Item>
</Stack>

// ✅ NEW: BlockStack
<BlockStack gap="400">
  <Box width="100%">Content</Box>
</BlockStack>

// ❌ OLD: TextStyle
<TextStyle variation="strong">Bold</TextStyle>
<TextStyle variation="subdued">Muted</TextStyle>

// ✅ NEW: Text
<Text fontWeight="bold">Bold</Text>
<Text tone="subdued">Muted</Text>
```

---

## Checklist

```
□ Using Polaris v12+ components (not Legacy*)
□ Icons from v9 (no Minor/Major suffix)
□ Button navigation uses url prop (not onClick)
□ Proper spacing tokens (100-800)
□ Text uses variant prop for typography
□ Card uses Box/BlockStack for sections
□ Modal uses Modal.Section for content
□ Loading states with Skeleton components
□ Proper accessibility labels on icon buttons
□ Translations via useTranslation hook
```