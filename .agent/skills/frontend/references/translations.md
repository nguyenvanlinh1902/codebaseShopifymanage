# Translations (i18n)

## Overview

The app supports multiple languages (en, fr, es, de, it, ja, id, uk). Translation keys are defined in JSON files in `packages/assets/src/locale/input/`, then auto-translated to all supported languages.

## Adding/Updating Translation Keys

### Step 1: Edit or create JSON file in `locale/input/`

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

### Step 2: Run the translation script

```bash
yarn update-label
```

### Step 3: Use in components

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

## Variables in Translations

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

## Translation Key Naming Convention

| Pattern | Example |
|---------|---------|
| Page title | `{Page}.title` |
| Page subtitle | `{Page}.subtitle` |
| Button labels | `{Page}.{action}Button` |
| Form labels | `{Page}.{field}Label` |
| Error messages | `{Page}.{field}Error` |
| Placeholders | `{Page}.{field}Placeholder` |

## File Structure

```
packages/assets/src/locale/
├── input/        # Source translation JSON files
│   ├── Activity.json
│   ├── Customer.json
│   └── Settings.json
└── output/       # Generated translated files (auto-generated)
    ├── en.json
    ├── fr.json
    └── ...
```
