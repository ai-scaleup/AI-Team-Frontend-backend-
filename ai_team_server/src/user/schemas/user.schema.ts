import { z } from 'zod';

// Schema for creating a user, matching the Prisma model.
export const createUserSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'Email is required.' })
    .email({ message: 'A valid email address is required.' })
    .trim(),
  oauthId: z.string().min(1, { message: 'OAuth ID is required.' }),
  username: z
    .string()
    .min(3, { message: 'Username must be at least 3 characters.' })
    .optional(), // Matches the optional 'username' in Prisma
});

// Schema for updating a user. Only the username is updatable in this model.
// All fields should be optional for partial updates.
export const updateUserSchema = z.object({
  username: z
    .string()
    .min(3, { message: 'Username must be at least 3 characters.' })
    .optional(),
});

const optionalQueryDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? new Date(value) : undefined))
  .refine((value) => value === undefined || !Number.isNaN(value.getTime()), {
    message: 'Invalid date.',
  });

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  usageFrom: optionalQueryDate,
  usageTo: optionalQueryDate,
  // Membership template name, or "none" for users without an active membership.
  membership: z.string().trim().min(1).optional(),
  status: z.enum(['active', 'expiring', 'expired']).optional(),
  sortBy: z
    .enum(['createdAt', 'duration', 'monthly', 'weekly', 'daily'])
    .default('createdAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

// We infer our TypeScript types directly from the schemas for type safety.
export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type ListUsersQueryDto = z.infer<typeof listUsersQuerySchema>;
