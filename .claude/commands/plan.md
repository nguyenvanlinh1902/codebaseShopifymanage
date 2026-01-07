---
description: Create implementation plan for a feature or task
argument-hint: [task description]
---

## Task
$ARGUMENTS

## Instructions

Use the `planner` agent to:
1. Research the codebase and Shopify APIs
2. Analyze architecture requirements
3. Create a comprehensive implementation plan

## Output Requirements

**MANDATORY:** Save the plan to `docs/features/{feature-name}.md`

### Plan Document Structure

```markdown
# {Feature Name} Implementation Plan

## Overview
Brief description of the feature and its purpose.

## Requirements
- List of functional requirements
- List of non-functional requirements

## Architecture
- Components affected
- Data flow
- Dependencies

## Implementation Steps
1. Step 1 with details
2. Step 2 with details
...

## API Changes (if applicable)
- New endpoints
- Modified endpoints
- Request/response formats

## Database Changes (if applicable)
- New collections/fields
- Firestore indexes (add to `firestore-indexes/{collection}.json`)
- Migrations needed

## Testing Strategy
- Unit tests
- Integration tests
- Manual testing

## Rollout Plan
- Feature flags
- Staged rollout
- Rollback strategy

## Timeline Considerations
- Dependencies between steps
- Critical path items

---
*Generated: {date}*
```

**DO NOT** start implementing - only create the plan and save to docs.