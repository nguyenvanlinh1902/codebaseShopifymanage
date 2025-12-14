# Avada Architecture & Coding Standards

## Principles

- **YAGNI** - You Aren't Gonna Need It
- **KISS** - Keep It Simple, Stupid
- **DRY** - Don't Repeat Yourself
- **Core logic first, UI last** - Backend/API first, minimal UI, polish later

---

## Project Structure

```
packages/
├── functions/src/        # Backend (Firebase Functions)
│   ├── config/           # Configuration and environment
│   ├── const/            # Constants grouped by domain
│   ├── handlers/         # Controllers - orchestrate ONLY
│   ├── services/         # Business logic, combine repos
│   ├── repositories/     # ONE collection per repo - NEVER mix
│   ├── helpers/          # Small single-purpose utilities
│   ├── presenters/       # Map/format output data
│   └── routes/           # API route definitions
├── assets/src/           # Frontend (React)
│   ├── components/       # Reusable components (PascalCase)
│   ├── pages/            # Page components
│   ├── hooks/            # Custom hooks
│   ├── contexts/         # React contexts
│   └── helpers/          # Utilities
extensions/               # Shopify extensions
```

---

## Backend Patterns

### Layer Responsibilities

| Layer | Responsibility | DON'T |
|-------|---------------|-------|
| **Handler** | Orchestrate, validate input, call services | Business logic, DB access |
| **Service** | Business logic, combine repos | Direct DB queries, HTTP responses |
| **Repository** | CRUD for ONE collection | Multiple collections, business logic |
| **Helper** | Small utilities | State, side effects |
| **Presenter** | Format output data | Business logic |

### Repository Pattern

```javascript
// ✅ GOOD: One repo = One collection
// customerRepository.js
const customersRef = firestore.collection('customers');

export const getByShop = (shopId) =>
  customersRef.where('shopId', '==', shopId).get();

export const getById = (id) =>
  customersRef.doc(id).get();

export const create = (data) =>
  customersRef.add({ ...data, createdAt: new Date() });

// ❌ BAD: Mixing collections
export const getCustomerWithOrders = async (id) => {
  const customer = await customersRef.doc(id).get();
  const orders = await ordersRef.where('customerId', '==', id).get(); // WRONG!
};
```

### Service Pattern

```javascript
// ✅ GOOD: Service combines repos
// customerService.js
import * as customerRepo from '../repositories/customerRepository';
import * as orderRepo from '../repositories/orderRepository';

export const getCustomerWithOrders = async (customerId) => {
  const [customer, orders] = await Promise.all([
    customerRepo.getById(customerId),
    orderRepo.getByCustomer(customerId)
  ]);
  return { customer: customer.data(), orders: orders.docs.map(d => d.data()) };
};
```

### Handler Pattern

```javascript
// ✅ GOOD: Handler orchestrates only
export const getCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { shopId } = req;

    // Validate
    if (!customerId) {
      return res.status(400).json({ success: false, error: 'Missing customerId' });
    }

    // Call service
    const customer = await customerService.getWithOrders(customerId, shopId);

    // Respond
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
```

### Response Format

```javascript
// All API responses follow this format
{ success: true, data: {...} }           // Success
{ success: false, error: "message" }     // Error
```

---

## Frontend Patterns

### Component Structure

```javascript
// ✅ One component per file, PascalCase
// CustomerCard.js
import React from 'react';
import { Card, Text } from '@shopify/polaris';

export function CustomerCard({ customer }) {
  return (
    <Card>
      <Text variant="headingMd">{customer.name}</Text>
      <Text>{customer.email}</Text>
    </Card>
  );
}
```

### CSS Naming (BEM)

```css
/* Block__Element--Modifier */
.customer-card { }
.customer-card__header { }
.customer-card__header--highlighted { }
.customer-card__body { }
```

### Polaris Navigation

```javascript
// ✅ GOOD: Use url prop
<Button url="/settings">Settings</Button>

// ❌ BAD: onClick with window.open
<Button onClick={() => window.open('/settings')}>Settings</Button>
```

### API Hooks

```javascript
// Use existing hooks
import { useFetchApi, useCreateApi } from '@/hooks/api';

function CustomerPage() {
  const { data, loading, error, refetch } = useFetchApi('/api/customers');
  const { create, loading: creating } = useCreateApi('/api/customers');
}
```

---

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Variables, functions | camelCase | `customerName`, `getCustomer` |
| Classes, components | PascalCase | `CustomerService`, `CustomerCard` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Files (components) | PascalCase | `CustomerCard.js` |
| Files (others) | camelCase | `customerService.js` |
| Booleans | is/has prefix | `isActive`, `hasOrders` |
| Functions | verb prefix | `getCustomer`, `createOrder` |

---

## Multi-tenant Rules

**CRITICAL: Every query must be scoped by shopId**

```javascript
// ✅ GOOD: Scoped by shop
const customers = await customersRef
  .where('shopId', '==', shopId)
  .get();

// ❌ BAD: No shop scope (data leak risk!)
const customers = await customersRef.get();
```

**Checklist:**
- [ ] All Firestore queries include `shopId` filter
- [ ] All documents include `shopId` field
- [ ] No cross-shop data access
- [ ] Shop ownership verified on mutations

---

## Cost-Conscious Development

### Evaluate Every Feature

| Trigger Type | Cost Level | Action |
|--------------|------------|--------|
| Every page load | 🔴 Very High | Batch client-side, aggregate |
| High-traffic webhook | 🔴 Very High | Question if needed |
| Every order | 🟡 Medium | Usually justified |
| User action | 🟢 Low | Fine |
| Cron job | 🟡 Varies | Check query scope |

### Red Flags

```javascript
// ❌ Page load trigger - very expensive
onPageLoad → Firebase function → Firestore write

// ❌ Unbounded cron query
const ALL = await customersRef.get(); // Reads everything!

// ❌ High-traffic webhook for small feature
products/update webhook just to log changes

// ✅ Use App Bridge direct API when possible (no Firebase cost)
```

---

## Quick Reference

### File Size Limits
- Keep files under 200 lines
- Split large files into focused modules

### Import Style
```javascript
// ✅ Named exports preferred
export const getCustomer = () => {};
import { getCustomer } from './customerService';

// ✅ Destructure imports
import { Card, Button, Text } from '@shopify/polaris';
```

### Error Handling
```javascript
// ✅ Always try-catch in handlers
try {
  const result = await service.doSomething();
  res.json({ success: true, data: result });
} catch (error) {
  console.error('Operation failed:', error);
  res.status(500).json({ success: false, error: error.message });
}
```

---

## Code Style

### Early Return (Avoid else/else-if)

```javascript
// ❌ BAD: Nested else-if
function getDiscount(customer) {
  if (customer.tier === 'gold') {
    return 0.2;
  } else if (customer.tier === 'silver') {
    return 0.1;
  } else if (customer.tier === 'bronze') {
    return 0.05;
  } else {
    return 0;
  }
}

// ✅ GOOD: Early return
function getDiscount(customer) {
  if (customer.tier === 'gold') return 0.2;
  if (customer.tier === 'silver') return 0.1;
  if (customer.tier === 'bronze') return 0.05;
  return 0;
}
```

```javascript
// ❌ BAD: Deep nesting with else
async function processOrder(order) {
  if (order) {
    if (order.items.length > 0) {
      if (order.customer) {
        // actual logic buried here
        await calculatePoints(order);
      } else {
        throw new Error('No customer');
      }
    } else {
      throw new Error('No items');
    }
  } else {
    throw new Error('No order');
  }
}

// ✅ GOOD: Guard clauses with early return
async function processOrder(order) {
  if (!order) throw new Error('No order');
  if (!order.items.length) throw new Error('No items');
  if (!order.customer) throw new Error('No customer');

  // actual logic at top level
  await calculatePoints(order);
}
```

### Small Focused Functions

```javascript
// ❌ BAD: Large function doing too much
async function syncCustomer(shopId, customerId) {
  // 50+ lines of mixed logic
  const customer = await getCustomer(customerId);
  const points = customer.orders.reduce((sum, o) => sum + o.total, 0) * 0.1;
  const tier = points > 1000 ? 'gold' : points > 500 ? 'silver' : 'bronze';
  await updateCustomer(customerId, { points, tier });
  await sendEmail(customer.email, `You are now ${tier}!`);
  await logActivity(shopId, 'tier_update', { customerId, tier });
  // ... more logic
}

// ✅ GOOD: Small focused functions
async function syncCustomer(shopId, customerId) {
  const customer = await getCustomer(customerId);
  const points = calculatePoints(customer.orders);
  const tier = determineTier(points);

  await updateCustomerTier(customerId, points, tier);
  await notifyTierChange(customer, tier);
  await logTierUpdate(shopId, customerId, tier);
}

function calculatePoints(orders) {
  return orders.reduce((sum, o) => sum + o.total, 0) * 0.1;
}

function determineTier(points) {
  if (points > 1000) return 'gold';
  if (points > 500) return 'silver';
  return 'bronze';
}
```

### JSDoc & TypeDefs

```javascript
// Define types in packages/functions/types/functions.d.ts
/**
 * @typedef {Object} Customer
 * @property {string} id
 * @property {string} shopId
 * @property {string} email
 * @property {'bronze'|'silver'|'gold'} tier
 * @property {number} points
 */

// Use JSDoc for public functions
/**
 * Get customer by ID with shop validation
 * @param {string} customerId
 * @param {string} shopId
 * @returns {Promise<Customer>}
 */
export async function getCustomer(customerId, shopId) {
  // ...
}
```

### When to Add JSDoc

| Scenario | JSDoc Required? |
|----------|-----------------|
| Public service functions | ✅ Yes |
| Handler functions | ✅ Yes |
| Complex helper functions | ✅ Yes |
| Simple private helpers | ❌ No |
| Self-explanatory one-liners | ❌ No |