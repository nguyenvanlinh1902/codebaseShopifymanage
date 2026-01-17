---
description: Update translations after adding/modifying labels
argument-hint: [optional: specific file or feature name]
---

## Translation Update Workflow

### Quick Reference
```bash
# Update all translations
yarn update-label
```

### Step-by-Step Process

1. **Add/Edit translation keys** in `packages/assets/src/locale/input/{Feature}.json`

   ```json
   // Example: locale/input/NewFeature.json
   {
     "title": "Feature Title",
     "description": "Feature description here",
     "buttons": {
       "save": "Save Changes",
       "cancel": "Cancel"
     }
   }
   ```

2. **Run translation script**
   ```bash
   yarn update-label
   ```

3. **Verify output** in `packages/assets/src/locale/output/`
   - Check `en.json` for merged keys
   - Spot-check other language files (fr.json, es.json, etc.)

### File Naming Convention
- Use PascalCase matching component/feature name
- Example: `CustomerDetails.json`, `VipTiers.json`, `Analytics.json`

### Key Naming Convention
- Use camelCase for keys
- Use nested objects for grouping
- Use `{variable}` for dynamic values

### Supported Languages
en, fr, es, de, it, ja, id, uk

### Troubleshooting
- If translation fails, check Google Translate API key in `scripts/autoTranslateV2.js`
- New keys must differ from `locale/output/origin.json` to trigger translation
- Brand names (Shopify, Joy, etc.) are not auto-translated

$ARGUMENTS