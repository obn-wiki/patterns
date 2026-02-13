// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://obn.wiki',
  integrations: [
    starlight({
      title: 'OBN',
      description: 'OpenClaw Builder Network — Vetted patterns for running OpenClaw agents in production',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/obn-wiki/obn-wiki' },
      ],
      sidebar: [
        { label: 'Home', slug: 'index' },
        { label: 'Getting Started', slug: 'getting-started' },
        {
          label: 'Patterns',
          items: [
            { label: 'Soul', autogenerate: { directory: 'patterns/soul' } },
            { label: 'Agents', autogenerate: { directory: 'patterns/agents' } },
            { label: 'Memory', autogenerate: { directory: 'patterns/memory' } },
            { label: 'Context', autogenerate: { directory: 'patterns/context' } },
            { label: 'Tools', autogenerate: { directory: 'patterns/tools' } },
            { label: 'Security', autogenerate: { directory: 'patterns/security' } },
            { label: 'Operations', autogenerate: { directory: 'patterns/operations' } },
            { label: 'Gateway', autogenerate: { directory: 'patterns/gateway' } },
          ],
        },
        {
          label: 'Deployment Stacks',
          autogenerate: { directory: 'stacks' },
        },
        {
          label: 'Reference',
          items: [
            { slug: 'reference/version-matrix' },
            { slug: 'reference/pattern-template' },
            { slug: 'reference/gap-analysis' },
          ],
        },
        { label: 'Contributing', slug: 'contributing' },
      ],
      editLink: {
        baseUrl: 'https://github.com/obn-wiki/obn-wiki/edit/main/',
      },
      components: {
        Footer: './src/components/Footer.astro',
      },
      customCss: ['./src/styles/custom.css'],
    }),
    react(),
  ],
});
