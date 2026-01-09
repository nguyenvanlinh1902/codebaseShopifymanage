---
name: frontend-development
description: Use this skill when the user asks about "React admin", "Polaris pages", "translations", "loadable components", "skeleton loading", "useFetchApi", "useCreateApi", "locale", "i18n", or any admin frontend development work. Provides React/Polaris patterns for the embedded admin app.
---

# Frontend Development (packages/assets)

> **Admin Embedded App** - Uses React + Shopify Polaris
>
> For **storefront widgets** (customer-facing), see `scripttag` skill

## Directory Structure

```
packages/assets/src/
├── components/        # Reusable React components
├── pages/            # Page components with skeleton loading
├── loadables/        # Code-split components (organized in folders)
├── contexts/         # React contexts for state management
├── hooks/            # Custom React hooks (API, state)
├── services/         # API services calling admin endpoints
├── routes/           # Route definitions (routes.js)
└── locale/           # Translations
    ├── input/        # Source translation JSON files
    └── output/       # Generated translated files
```

---

## Translations

### Overview

The app supports multiple languages (en, fr, es, de, it, ja, id, uk). Translation keys are defined in JSON files in `packages/assets/src/locale/input/`, then auto-translated to all supported languages.

### Adding/Updating Translation Keys

**Step 1: Edit or create JSON file in `locale/input/`**

Files are named after components/features (PascalCase):

```json
// locale/input/Activity.json
{
  "title": "Activities",
  "subtitle": "Manage your customers' loyalty activities in one place",
  "learnMore": "Learn more",
  "pointTab": "Point Activities"
}
```

**Step 2: Run the translation script**

```bash
yarn update-label
```

**Step 3: Use in components**

```javascript
import {useTranslation} from 'react-i18next';

function ActivityPage() {
  const {t} = useTranslation();

  return (
    <Page title={t('Activity.title')}>
      <Text>{t('Activity.subtitle')}</Text>
    </Page>
  );
}
```

### Variables in Translations

```json
{
  "pointsEarned": "You earned {points} points!",
  "welcome": "Welcome, {name}!"
}
```

```javascript
t('Reward.pointsEarned', { points: 100 })
// Output: "You earned 100 points!"
```

---

## Component Guidelines

### File Extensions
- Use `.js` files only (no `.jsx`)

### Loadable Components
- Always create in organized folders with `index.js`
- Never create loadable components at top level

```javascript
// loadables/CustomerPage/index.js
export default Loadable({
  loader: () => import('../../pages/Customer'),
  loading: CustomerSkeleton
});
```

### Skeleton Loading

All data-fetching pages must have skeleton loading states:

```javascript
function CustomerPageSkeleton() {
  return (
    <SkeletonPage primaryAction>
      <Layout>
        <Layout.Section>
          <Card>
            <SkeletonBodyText lines={5} />
          </Card>
        </Layout.Section>
      </Layout>
    </SkeletonPage>
  );
}
```

---

## API Hooks

### Fetch Data

```javascript
const {data, loading, fetchApi} = useFetchApi({
  url: '/api/customers',
  defaultData: [],
  initLoad: true  // Load on mount
});
```

### Create/Update

```javascript
const {creating, handleCreate} = useCreateApi({
  url: '/api/customers',
  successMsg: 'Customer created successfully',
  successCallback: () => fetchApi()
});

// Usage
await handleCreate({ name, email, points });
```

### Delete

```javascript
const {deleting, handleDelete} = useDeleteApi({
  url: '/api/customers',
  successMsg: 'Customer deleted',
  successCallback: () => fetchApi()
});

// Usage
await handleDelete(customerId);
```

### Edit (Update)

```javascript
const {editing, handleEdit} = useEditApi({
  url: `/api/customers/${customerId}`,
  successMsg: 'Customer updated successfully',
  successCallback: () => fetchApi()
});

// Usage
await handleEdit({ name, email, points });
```

---

## Save Bar (App Bridge)

The `<ui-save-bar>` web component requires refs and `setAttribute` for loading state (React props don't work on web components).

### Pattern

```javascript
import {useRef, useEffect} from 'react';
import {useAppBridge} from '@shopify/app-bridge-react';

function MyForm() {
  const shopify = useAppBridge();
  const saveButtonRef = useRef(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Show/hide save bar based on form changes
  useEffect(() => {
    if (isDirty) {
      shopify.saveBar.show('my-save-bar');
    } else {
      shopify.saveBar.hide('my-save-bar');
    }
  }, [isDirty, shopify]);

  // Set loading state on save button (CRITICAL: use setAttribute)
  useEffect(() => {
    if (saveButtonRef.current) {
      if (saving) {
        saveButtonRef.current.setAttribute('loading', '');
        saveButtonRef.current.setAttribute('disabled', '');
      } else {
        saveButtonRef.current.removeAttribute('loading');
        saveButtonRef.current.removeAttribute('disabled');
      }
    }
  }, [saving]);

  const handleSave = async () => {
    setSaving(true);
    await saveData();
    setSaving(false);
    setIsDirty(false);
  };

  const handleDiscard = () => {
    resetForm();
    setIsDirty(false);
  };

  return (
    <Page title="Settings">
      <ui-save-bar id="my-save-bar">
        <button ref={saveButtonRef} variant="primary" onClick={handleSave}>
          Save
        </button>
        <button onClick={handleDiscard}>Discard</button>
      </ui-save-bar>
      {/* Form content */}
    </Page>
  );
}
```

### Key Points

| Issue | Solution |
|-------|----------|
| Loading state not working | Use `setAttribute('loading', '')` via ref |
| Disabled state not working | Use `setAttribute('disabled', '')` via ref |
| Save bar not showing | Call `shopify.saveBar.show('bar-id')` |
| Save bar not hiding | Call `shopify.saveBar.hide('bar-id')` |

---

## Resource Picker (App Bridge)

Use App Bridge's resource picker for selecting Shopify resources (products, collections, etc.).

### Product Selection

```javascript
import {useAppBridge} from '@shopify/app-bridge-react';

function ProductSelector({selectedProducts, onSelect}) {
  const shopify = useAppBridge();

  const handleSelectProducts = async () => {
    try {
      const selected = await shopify.resourcePicker({
        type: 'product',
        multiple: true,
        selectionIds: selectedProducts.map(p => ({id: p.id})),
        filter: {
          variants: false  // Exclude variants
        }
      });

      if (selected) {
        onSelect(selected.map(product => ({
          id: product.id,
          title: product.title,
          image: product.images?.[0]?.originalSrc || null
        })));
      }
    } catch (error) {
      console.error('Resource picker error:', error);
    }
  };

  return (
    <Button icon={SearchIcon} onClick={handleSelectProducts}>
      Browse products
    </Button>
  );
}
```

### Resource Picker Options

| Option | Type | Description |
|--------|------|-------------|
| `type` | string | `'product'`, `'collection'`, `'variant'` |
| `multiple` | boolean | Allow multiple selection |
| `selectionIds` | array | Pre-selected resource IDs `[{id: 'gid://...'}]` |
| `filter.variants` | boolean | Include/exclude variants |
| `filter.draft` | boolean | Include draft products |

---

## State Management

- Use React Context for global state
- Use local state for component-specific data
- Use Redux Saga sparingly (legacy patterns)

```javascript
// contexts/ShopContext.js
const ShopContext = createContext();

export function ShopProvider({ children }) {
  const [shop, setShop] = useState(null);

  return (
    <ShopContext.Provider value={{ shop, setShop }}>
      {children}
    </ShopContext.Provider>
  );
}

export const useShop = () => useContext(ShopContext);
```

---

## Development Commands

```bash
# Start embedded app development
cd packages/assets && npm run watch:embed

# Start standalone development
cd packages/assets && npm run watch:standalone

# Production build
cd packages/assets && npm run production
```