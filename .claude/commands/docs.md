 ---
description: Document feature changes and updates
argument-hint: [feature name or description]
---

## Feature to Document
$ARGUMENTS

## Instructions

Generate documentation for the specified feature or recent changes.

### Step 1: Analyze Changes

Identify what needs to be documented:

| Source | Command |
|--------|---------|
| Recent commits | `git log --oneline -10` |
| Uncommitted changes | `git diff --name-only` |
| Staged changes | `git diff --cached --name-only` |
| Specific feature | Search for related files |

### Step 2: Determine Documentation Type

| Change Type | Documentation Needed |
|-------------|---------------------|
| New API endpoint | API docs, examples, response format |
| New feature | Feature description, usage, configuration |
| Breaking change | Migration guide, changelog |
| Bug fix | Changelog entry |
| Configuration change | Settings documentation |
| New integration | Integration guide |

### Step 3: Generate Documentation

Based on the changes, create or update:

1. **Changelog Entry** (if applicable)
   ```markdown
   ## [Version] - YYYY-MM-DD
   ### Added/Changed/Fixed
   - Description of change
   ```

2. **API Documentation** (for endpoint changes)
   - Endpoint URL and method
   - Request/response format
   - Authentication requirements
   - Example requests

3. **Feature Documentation** (for new features)
   - Purpose and use case
   - Configuration options
   - Usage examples
   - Related features

### Step 4: Output Location

Save documentation to appropriate location:
- API changes → Update relevant API docs
- Features → Create/update feature docs
- Changelogs → Append to CHANGELOG.md

### Output Format

Provide documentation in clear markdown format ready for use.