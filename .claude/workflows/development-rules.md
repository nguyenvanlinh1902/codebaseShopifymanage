# Avada Development Rules

## Principles
**YAGNI** - You Aren't Gonna Need It
**KISS** - Keep It Simple, Stupid
**DRY** - Don't Repeat Yourself

## Code Standards

### Naming Conventions
- `camelCase` - variables, functions, properties
- `PascalCase` - classes, React components
- `UPPER_SNAKE_CASE` - constants
- Functions start with verbs: `getUserData`, `calculatePoints`
- Booleans prefix with `is/has`: `isActive`, `hasPermission`

### Code Patterns
- Prefer `const` over `let`; avoid mutation
- Use `===` instead of `==`
- Prefer async/await over promises
- Functions with >3 params use object destructuring
- Use early return pattern; minimize `else`
- Single responsibility: one function does one thing

### Backend Structure (Node.js/Firebase)
```
packages/functions/src/
├── handlers/      # Controllers - orchestrate ONLY, no business logic
├── services/      # Business logic, combine multiple repos
├── repositories/  # ONE Firestore collection per repo - NEVER mix
├── helpers/       # Small single-purpose utilities
├── presenters/    # Format output data
├── const/         # Constants grouped by domain
└── config/        # Configuration
```

### Frontend Structure (React)
- One component per file (PascalCase filename)
- Functional components only
- BEM naming for CSS classes
- Use React Context to avoid prop drilling
- Custom hooks for reusable logic

## Firestore Rules
- Repository handles ONE collection only
- Use batch operations (max 500 per batch)
- Check emptiness with `docs.empty` (not size/length)
- Use Firestore aggregates for count/sum/avg
- Filter early with `where`, select only needed fields

## Shopify/Polaris Rules
- Use GraphQL Admin API (preferred over REST)
- Button `url` prop for navigation (NOT `onClick` + `window.open`)
- Use Polaris components when available
- Verify webhook HMAC signatures
- Handle rate limits with exponential backoff

## Security
- NEVER commit credentials or API keys
- Validate `.gitignore` includes secrets
- Sanitize all user inputs
- Parameterize database queries
- Verify authentication on all endpoints

## Pre-commit
- Run `npm run lint` before commit
- Run `npm test` before push
- NEVER ignore failing tests
- Use conventional commit messages
- Keep commits focused and atomic

## File Size
- Keep files under 200 lines when possible
- Split large files into focused modules
- Extract utilities into separate files