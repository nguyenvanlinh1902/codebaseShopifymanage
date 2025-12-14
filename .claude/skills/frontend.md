# Frontend Development (packages/assets)

> **Admin Embedded App** - Uses React + Shopify Polaris
>
> For **storefront widgets** (customer-facing), see `.claude/skills/scripttag.md`

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

### File Structure

```
packages/assets/src/locale/
├── input/                    # Source files (English keys)
│   ├── Activity.json
│   ├── Analytics.json
│   ├── Customer.json
│   └── ... (170+ files)
└── output/                   # Generated translations
    ├── en.json              # English (source)
    ├── fr.json              # French
    ├── es.json              # Spanish
    ├── de.json              # German
    ├── it.json              # Italian
    ├── ja.json              # Japanese
    ├── id.json              # Indonesian
    ├── uk.json              # Ukrainian
    └── origin.json          # Snapshot for change detection
```

### Adding/Updating Translation Keys

**Step 1: Edit or create JSON file in `locale/input/`**

Files are named after components/features (PascalCase):

```json
// locale/input/Activity.json
{
  "title": "Activities",
  "subtitle": "Manage your customers' loyalty activities in one place",
  "learnMore": "Learn more",
  "pointTab": "Point Activities",
  "referralTab": "Referral Activities"
}
```

**Step 2: Run the translation script**

```bash
yarn update-label
```

This script:
1. Merges all `input/*.json` files into `output/en.json`
2. Detects new/changed keys by comparing with `origin.json`
3. Auto-translates only changed keys using Google Translate API
4. Updates all language files (`fr.json`, `es.json`, etc.)
5. Updates `origin.json` snapshot

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

### Key Naming Convention

- File names: PascalCase matching component/feature name
- Key names: camelCase
- Nested keys allowed for organization

```json
// locale/input/Customer.json
{
  "title": "Customers",
  "tabs": {
    "all": "All Customers",
    "vip": "VIP Members",
    "inactive": "Inactive"
  },
  "actions": {
    "export": "Export",
    "import": "Import",
    "addPoints": "Add Points"
  }
}
```

Usage: `t('Customer.tabs.all')`, `t('Customer.actions.export')`

### Variables in Translations

Use `{variable}` syntax for dynamic values:

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

### Best Practices

| Do | Don't |
|----|-------|
| Use descriptive key names | Use generic names like `label1`, `text` |
| Group related keys in objects | Flat structure for everything |
| Keep translations short | Long sentences (harder to translate) |
| Use variables for dynamic data | Concatenate strings |
| One file per feature/component | Dump everything in one file |

### Labels NOT Auto-Translated

The script skips:
- All uppercase text (API, CSV, VIP, POS)
- Numbers and percentages (100%, 65)
- Brand names (Shopify, Klaviyo, Joy)
- URLs and emails
- Very short text (2 chars or less)
- File extensions (.csv, .xlsx)

### Other Translation Commands

```bash
# Detect untranslated labels across all languages
# (Uncomment detectUntranslatedLabels() in autoTranslateV2.js)

# Translate missing labels from report
# (Uncomment translateMissingLabels() in autoTranslateV2.js)

# Translate all keys to a new language
# (Uncomment translateAllKeysToNewLanguage('lang') in autoTranslateV2.js)
```

---

## Component Guidelines

### File Extensions
- Use `.js` files only (no `.jsx`)

### Loadable Components
- Always create in organized folders with `index.js`
- Never create loadable components at top level

```javascript
// ✅ GOOD: loadables/CustomerPage/index.js
export default Loadable({
  loader: () => import('../../pages/Customer'),
  loading: CustomerSkeleton
});

// ❌ BAD: loadables/CustomerPage.js (no folder)
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

### Polaris Usage

**See `.claude/skills/polaris.md` for comprehensive Polaris patterns.**

Quick rules:
- Use Polaris v12+ components (avoid `Legacy*` components)
- Use Icons v9 (no `Minor`/`Major` suffix)
- Button navigation: use `url` prop, not `onClick`

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