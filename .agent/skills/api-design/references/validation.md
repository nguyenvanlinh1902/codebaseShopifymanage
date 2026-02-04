# Input Validation

## Yup Schemas

```javascript
import * as Yup from 'yup';

export const createCustomerSchema = Yup.object({
  email: Yup.string().email().required(),
  firstName: Yup.string().max(100).optional(),
  points: Yup.number().positive().optional()
});

export const paginationSchema = Yup.object({
  limit: Yup.number().min(1).max(100).default(20),
  cursor: Yup.string().optional()
});
```

## Validation Middleware

```javascript
export function validateInput(schema) {
  return async (ctx, next) => {
    try {
      ctx.request.body = await schema.validate(ctx.request.body, {
        stripUnknown: true
      });
      await next();
    } catch (error) {
      ctx.status = 400;
      ctx.body = errorResponse(error.message, 'VALIDATION_ERROR', 400);
    }
  };
}
```

## Route with Validation

```javascript
router.post('/customers', validateInput(createSchema), createCustomer);
router.get('/customers', validateQuery(paginationSchema), getCustomers);
```

## Common Validation Patterns

```javascript
// Email
Yup.string().email().required()

// Optional string with max length
Yup.string().max(100).optional()

// Positive number
Yup.number().positive().optional()

// Enum
Yup.string().oneOf(['active', 'inactive']).required()

// Array with limit
Yup.array().of(Yup.string()).max(50)

// Date
Yup.date().min(new Date()).optional()

// Nested object
Yup.object({
  firstName: Yup.string().required(),
  lastName: Yup.string().required()
})
```

## Sanitization

```javascript
// In controller, after validation
await customerRepo.update(customerId, {
  firstName: firstName?.trim().slice(0, 50),
  lastName: lastName?.trim().slice(0, 50)
});
```
