/**
 * Generic Zod validation middleware factory for Koa.
 *
 * @example
 * import {z} from 'zod';
 * import {validate} from './validate';
 *
 * const createSchema = z.object({ name: z.string().min(2).max(100) });
 * export const validateCreate = validate(createSchema);
 *
 * // routes/api.js
 * router.post('/items', validateCreate, controller.create);
 */

/**
 * Format Zod errors into a readable string
 * @param {z.ZodError} error
 * @returns {string}
 */
function formatZodError(error) {
  return error.issues.map(issue => issue.message).join(', ');
}

/**
 * Create Koa validation middleware from a Zod schema
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Koa middleware
 */
export function validate(schema) {
  return async function validateBody(ctx, next) {
    const body = ctx.req?.body ?? ctx.request?.body ?? {};
    const result = schema.safeParse(body);

    if (!result.success) {
      ctx.status = 400;
      ctx.body = {success: false, error: formatZodError(result.error)};
      return;
    }

    // Replace body with parsed/transformed data (trimmed, stripped unknown fields)
    ctx.req.body = result.data;
    ctx.request.body = result.data;

    return next();
  };
}
