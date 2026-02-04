---
description: Generate grey box testing checklist from current MR/branch changes
---

Generate a comprehensive grey box testing checklist based on the current MR/branch changes.

## How to Use

Run this command after completing changes to get a structured test checklist before submitting a merge request.

## Analysis Process

### Step 1: Gather Changes

```bash
# Get branch name
git branch --show-current

# Get changed files
git diff --name-only origin/master...HEAD

# Get detailed stats
git diff origin/master...HEAD --stat

# Get full diff for analysis
git diff origin/master...HEAD
```

### Step 2: Categorize Each Changed File

| Category | Path Pattern | Testing Focus |
|----------|--------------|---------------|
| **API Handlers** | `handlers/*.js` | Request/response, validation, auth |
| **Services** | `services/*.js` | Business logic, calculations, edge cases |
| **Repositories** | `repositories/*.js` | CRUD, queries, data integrity |
| **Frontend Pages** | `pages/**/*.jsx` | Rendering, flows, state management |
| **Components** | `components/**/*.jsx` | Props, events, visual correctness |
| **Hooks** | `hooks/*.js` | Side effects, data fetching |
| **Extensions** | `extensions/` | Shopify integration, checkout flow |
| **Scripttag** | `scripttag/` | Widget display, performance |

### Step 3: Analyze Impact

For each file:
1. Read the diff to understand changes
2. Identify what function/component was modified
3. Find callers (who uses this code)
4. Find callees (what this code uses)
5. Map data flow: input → processing → output → side effects

### Step 4: Generate Test Cases

For each change, generate tests covering:

**Functional Tests**
- [ ] Happy path works as expected
- [ ] Invalid inputs rejected with proper errors
- [ ] Edge cases handled (null, empty, boundaries)
- [ ] Error states handled gracefully

**Integration Tests**
- [ ] API responds correctly
- [ ] Database operations successful
- [ ] External APIs called correctly

**UI Tests** (if frontend)
- [ ] Component renders
- [ ] User actions work
- [ ] Loading/error states correct
- [ ] Responsive behavior

**Regression Tests**
- [ ] Related features still work
- [ ] Existing tests pass

## Output Template

```markdown
# Grey Box Test Checklist

**Branch**: `{branch-name}`
**Date**: {date}
**Files Changed**: {count}

---

## Summary of Changes

{Brief description of what was changed and why}

---

## Areas Affected

| Area | Files | Risk |
|------|-------|------|
| Backend | {list} | Low/Med/High |
| Frontend | {list} | Low/Med/High |
| Extensions | {list} | Low/Med/High |

---

## Critical Tests (Block MR if fail)

### {Feature/Area 1}

#### TC-001: {Test Name}
- **Preconditions**: {Setup required}
- **Steps**:
  1. {Step 1}
  2. {Step 2}
- **Expected Result**: {What should happen}
- **Verify in**:
  - [ ] UI
  - [ ] Database (Firestore)
  - [ ] Logs (firebase-debug.log)
  - [ ] Network (API response)

#### TC-002: {Test Name}
...

---

## High Priority Tests

### {Area 2}

- [ ] **{Test}**: {Description}
  - Steps: {Brief steps}
  - Expected: {Result}

- [ ] **{Test}**: {Description}
  - Steps: {Brief steps}
  - Expected: {Result}

---

## Edge Cases & Negative Tests

- [ ] **Empty state**: {What happens with no data}
- [ ] **Invalid input**: {What happens with bad data}
- [ ] **Permission denied**: {What happens without auth}
- [ ] **Network failure**: {What happens when API fails}
- [ ] **Concurrent access**: {What happens with race conditions}

---

## Regression Tests

- [ ] {Existing feature that might be affected}
- [ ] {Related flow that uses same code}
- [ ] {Previously buggy area}

---

## Data Verification

For each test, verify data in:

| Location | What to Check |
|----------|---------------|
| Firestore | {Collections/documents to check} |
| Shopify | {Metafields, orders, customers} |
| Logs | {Expected log entries} |

---

## Test Data Required

| Data Type | Description | How to Create |
|-----------|-------------|---------------|
| {Type} | {What it is} | {Steps to create} |

---

## Environment

- **Test on**: Local emulators / Dev store
- **Store**: {Store name from shopify.app.toml}
- **App URL**: `https://admin.shopify.com/store/{store}/apps/{app-handle}/embed`
- **Storefront**: `https://{store}.myshopify.com`

---

## Quick Verification Commands

```bash
# Check for errors in logs
grep -i "error\|warn" firebase-debug.log | tail -20

# Run unit tests
npm test

# Check lint
npm run lint

# Build check
npm run build
```
```

## Grey Box Testing Techniques

### 1. Code-Informed Testing
- Read the code to understand logic branches
- Test each branch/condition
- Test boundary values based on code logic

### 2. Data Flow Testing
- Trace data from input to output
- Verify data transformations are correct
- Check data persists correctly in database

### 3. State-Based Testing
- Identify all possible states
- Test transitions between states
- Test invalid state transitions

### 4. Integration Point Testing
- Test API request/response formats
- Verify external service calls
- Check error handling for external failures

### 5. Database Testing
- Verify CRUD operations
- Check data integrity constraints
- Test query performance

## Testing Priority Matrix

| Change Type | Priority | Focus Areas |
|-------------|----------|-------------|
| Handler/API | Critical | Request validation, response format, auth |
| Service logic | Critical | Calculations, business rules, edge cases |
| Repository | High | Data integrity, query correctness |
| Frontend page | High | User flows, error states |
| Component | Medium | Props handling, events |
| Styling | Low | Visual correctness |
| Config | High | Environment behavior |

## Common Test Scenarios by Area

### API Handler Tests
- Valid request → Success response
- Missing required field → 400 error with message
- Invalid data type → 400 error
- Unauthorized → 401 error
- Resource not found → 404 error
- Internal error → 500 with safe message

### Service Tests
- Calculation produces correct result
- Edge case inputs handled
- Null/undefined inputs handled
- External service failure handled
- Concurrent operations safe

### Frontend Page Tests
- Page loads without console errors
- Data fetches and displays
- User actions trigger correct behavior
- Error states shown appropriately
- Loading states work correctly
- Navigation works

### Checkout Extension Tests
- Extension renders at correct location
- Data displays correctly
- User interactions work
- Doesn't break checkout flow
- Handles missing data gracefully
