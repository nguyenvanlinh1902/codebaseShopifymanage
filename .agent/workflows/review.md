Review the code I'm discussing or the files I specify as a Senior Fullstack Developer following Avada Development standards.

## Reference Skills
- `.claude/skills/avada-architecture.md`
- `.claude/skills/firestore.md`
- `.claude/skills/backend.md`

## Review Focus Areas

### Code Quality & Standards
- **Naming**: camelCase (variables/functions), PascalCase (classes/components), UPPER_SNAKE_CASE (constants)
- **Functions**: Start with verbs, use object params + destructuring for >3 params
- **Booleans**: Prefix with `is/has`
- **Patterns**: Prefer `const`, `===`, async/await, arrow functions
- **Early Return**: Avoid else/else-if, use guard clauses
- **Small Functions**: Single responsibility, one function does one thing
- **JSDoc**: Required for public service/handler functions, types in `functions.d.ts`

### Architecture (Backend - Node.js/Firebase)
```
functions/src/
  handlers/    # Controllers - orchestrate only, no heavy logic
  services/    # Business logic, combine repos by feature
  repository/  # ONE Firestore collection per repo
  helpers/     # Small utilities
  presenters/  # Format output data
```

### Architecture (Frontend - React)
- One component per file (PascalCase filename)
- Functional components only
- BEM naming for CSS
- Use React Context to avoid prop drilling
- React.lazy for modals/secondary pages

### Performance
- Firestore: Use `where` filters early, select only needed fields, use aggregates
- React: Tree-shaking imports, avoid excessive inline styles
- Use Shopify Polaris components when available

### Security
- OWASP Top 10 check
- No committed credentials
- Sanitize inputs, parameterize queries

### Shopify Polaris
- Use `url` prop for navigation (not `onClick` + `window.open`)

## Output Format

Provide:
1. **Summary**: Overall assessment
2. **Critical Issues**: Security, data loss, breaking bugs
3. **High Priority**: Performance, architecture violations, missing error handling
4. **Medium Priority**: DRY violations, missing docs, test gaps
5. **Positive Feedback**: Well-implemented patterns
6. **Code Examples**: Specific fixes with before/after