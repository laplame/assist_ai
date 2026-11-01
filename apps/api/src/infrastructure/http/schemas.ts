import { z } from 'zod';

export const listQuerySchema = z.object({
  kind: z.enum(['note', 'task', 'contact']).optional(),
  search: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => value || undefined),
  includeDeleted: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const syncBodySchema = z.object({
  deviceLabel: z.string().trim().max(80).nullable().optional(),
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        kind: z.enum(['note', 'task', 'contact']),
        title: z.string().trim().min(1).max(200),
        body: z.string().max(20_000).default(''),
        metadata: z.record(z.string()).default({}),
        clientUpdatedAt: z.string().datetime(),
        deleted: z.boolean().optional().default(false),
      }),
    )
    .min(1)
    .max(100),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
