---
name: polaris-components
description: Use this skill when the user asks about "Polaris components", "Shopify UI", "Button", "Card", "Modal", "IndexTable", "BlockStack", "InlineStack", "icons", "Badge", "Banner", or any Shopify Polaris component usage. Provides Polaris v12+ component patterns and best practices.
---

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
// GOOD: v9 icons (no suffix)
import {
  PlusCircleIcon,
  DeleteIcon,
  EditIcon,
  SearchIcon,
  ChevronRightIcon,
  AlertCircleIcon,
  MenuHorizontalIcon
} from '@shopify/polaris-icons';

// BAD: Old v8 icons (with Minor/Major suffix)
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
| Menu | `MenuHorizontalIcon`, `MenuVerticalIcon` |
| Chevron | `ChevronRightIcon`, `ChevronDownIcon`, `ChevronUpIcon` |

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
// GOOD: Use url prop for navigation
<Button url="/settings">Go to Settings</Button>
<Button url="https://help.shopify.com" external>Help</Button>

// BAD: onClick + window.open
<Button onClick={() => window.open('/settings')}>Settings</Button>
```

---

## Data Display

### Text Variants

```javascript
import {Text} from '@shopify/polaris';

<Text variant="headingXl" as="h1">Page Title</Text>
<Text variant="headingLg" as="h2">Section Title</Text>
<Text variant="headingMd" as="h3">Card Title</Text>
<Text variant="bodyMd">Regular body text</Text>
<Text variant="bodySm">Small text</Text>

// With tone
<Text tone="subdued">Secondary text</Text>
<Text tone="success">Success message</Text>
<Text tone="critical">Error message</Text>

// Font weight
<Text fontWeight="bold">Bold text</Text>
```

### Badge

```javascript
import {Badge} from '@shopify/polaris';

<Badge>Default</Badge>
<Badge tone="info">Info</Badge>
<Badge tone="success">Active</Badge>
<Badge tone="warning">Pending</Badge>
<Badge tone="critical">Error</Badge>

// With progress
<Badge progress="incomplete">Draft</Badge>
<Badge progress="complete" tone="success">Complete</Badge>
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
```

---

## Modal

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

---

## Migration Notes (v11 to v12)

### Deprecated to New

| Deprecated | Replacement |
|------------|-------------|
| `Stack` | `BlockStack` / `InlineStack` |
| `TextStyle` | `Text` with props |
| `Heading` | `Text variant="heading*"` |
| `LegacyCard` | `Card` + `Box` |
| `LegacyStack` | `BlockStack` / `InlineStack` |

---

## Checklist

```
- Using Polaris v12+ components (not Legacy*)
- Icons from v9 (no Minor/Major suffix)
- Button navigation uses url prop (not onClick)
- Proper spacing tokens (100-800)
- Text uses variant prop for typography
- Card uses Box/BlockStack for sections
- Modal uses Modal.Section for content
- Loading states with Skeleton components
- Proper accessibility labels on icon buttons
```