import {z} from 'zod';
import {validate} from './validate';

const createSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be 2-100 chars')
    .max(100),
  amount: z.number({message: 'Amount is required'}).min(0, 'Amount must be >= 0'),
  status: z.enum(['active', 'inactive', 'cancelled']).optional()
});

const updateSchema = z.object({
  id: z.string({message: 'ID is required'}).min(1),
  name: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .optional(),
  amount: z
    .number()
    .min(0)
    .optional(),
  status: z.enum(['active', 'inactive', 'cancelled']).optional()
});

export const validateCreateSubscription = validate(createSchema);
export const validateUpdateSubscription = validate(updateSchema);
