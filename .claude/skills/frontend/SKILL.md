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