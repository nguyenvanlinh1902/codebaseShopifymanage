---
description: Check labels and text for Shopify Polaris content guidelines compliance
argument-hint: [optional: specific file or feature name]
---

## Label Check Workflow

Check UI labels, headings, button text, and other user-facing content for Shopify Polaris content guidelines compliance.

## Polaris Content Guidelines Summary

### Capitalization Rules

**Use Sentence Case (first word + proper nouns only):**
- Headings and subheadings
- Button labels
- Card titles
- Menu items
- Form labels
- Modal titles
- Email subject lines
- Task list items

```
✓ "Get started with Puzzlify"
✗ "Get Started With Puzzlify"

✓ "Create purchase order"
✗ "Create Purchase Order"

✓ "Set up brand defaults"
✗ "Set Up Brand Defaults"

✓ "Configure your first puzzle"
✗ "Configure Your First Puzzle"
```

**Always Capitalize:**
- Proper nouns (Shopify, Joy, Google, etc.)
- Trademarked product names (Shopify Payments, App Store)
- Brand names
- Country names
- Person names

**Use Lowercase For:**
- Generic features (blogs, navigation, admin, settings)
- Descriptive feature names (analytics, fraud analysis, themes)
- Job titles without names attached

**Capitalize in Navigation:**
- Top-level navigation items (Products, Orders, Customers)

### Common Title Case Violations

Words that should NOT be capitalized mid-sentence:
- Articles: a, an, the
- Conjunctions: and, but, or, for, nor
- Prepositions: at, by, for, in, of, on, to, up, with, your, first

### Additional Rules

- Use contractions: "can't", "it's", "you're", "don't"
- Use Oxford commas
- Use American English spelling
- Keep headings concise (single sentence, no ending punctuation)

## Check Process

1. **Scan locale/translation files** (JSON):
   ```bash
   # Find all locale JSON files
   find packages/assets/src/locale -name "*.json" 2>/dev/null
   ```

2. **Scan JSX/TSX files for hardcoded strings**:
   - Check `<Text>`, `<Heading>`, `<Button>`, `<Card>` components
   - Check `title`, `label`, `placeholder` props
   - Check Polaris component text content

3. **Common patterns to flag**:
   ```
   # Title Case pattern (multiple consecutive capitalized words)
   /\b[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+/

   # Specific violations
   "Get Started" -> "Get started"
   "Set Up" -> "Set up"
   "Sign In" -> "Sign in"
   "Log Out" -> "Log out"
   "Add New" -> "Add new"
   "Create New" -> "Create new"
   "View All" -> "View all"
   "Learn More" -> "Learn more"
   "Read More" -> "Read more"
   "Show More" -> "Show more"
   "Load More" -> "Load more"
   "Try Again" -> "Try again"
   "Go Back" -> "Go back"
   "Save Changes" -> "Save changes"
   "Delete All" -> "Delete all"
   ```

4. **Check specific file patterns**:
   - `packages/assets/src/locale/**/*.json` - Translation files
   - `packages/assets/src/pages/**/*.{js,jsx,ts,tsx}` - Page components
   - `packages/assets/src/components/**/*.{js,jsx,ts,tsx}` - Reusable components
   - `extensions/**/*.{js,jsx,ts,tsx}` - Shopify extensions

## Output Format

### Summary
- Total files scanned
- Total labels checked
- Violations found

### Violations Table
| File | Line | Current | Suggested | Type |
|------|------|---------|-----------|------|
| path/to/file.json | 12 | "Get Started" | "Get started" | Title Case |

### Categories
1. **Critical** - User-facing labels (buttons, headings, titles)
2. **Warning** - Descriptions, helper text
3. **Info** - Comments, internal strings

### Auto-fix Suggestions
Provide sed/code snippets to fix violations when possible.

## Exceptions

These should remain capitalized:
- Brand names: Shopify, Joy, Avada, Google, Facebook, etc.
- Product names: Shopify Payments, App Store, Admin API
- Proper nouns: United States, English, etc.
- Top-level nav items when used as navigation labels
- Acronyms: API, URL, SKU, SEO, etc.

$ARGUMENTS
