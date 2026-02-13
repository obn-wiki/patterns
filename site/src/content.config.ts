import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        category: z
          .enum(['soul', 'agents', 'memory', 'context', 'tools', 'security', 'operations', 'gateway'])
          .optional(),
        status: z.enum(['draft', 'tested', 'stable', 'deprecated']).optional(),
        openclawVersion: z.string().optional(),
        lastValidated: z.string().optional(),
      }),
    }),
  }),
};
