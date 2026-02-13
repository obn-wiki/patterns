/**
 * prepare-content.ts
 *
 * Build-time script that transforms pattern markdown files from patterns/
 * into Starlight-compatible content with YAML frontmatter.
 *
 * Also generates public/pattern-index.json for the AI chat sidebar.
 *
 * Run: npx tsx scripts/prepare-content.ts
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, cpSync, rmSync } from 'fs';
import { join, basename, dirname, relative, resolve } from 'path';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '../..');
const PATTERNS_DIR = join(ROOT, 'patterns');
const DOCS_DIR = join(ROOT, 'site/src/content/docs');
const PUBLIC_DIR = join(ROOT, 'site/public');

const CATEGORIES = ['soul', 'agents', 'memory', 'context', 'tools', 'security', 'operations', 'gateway'];

const CATEGORY_LABELS: Record<string, string> = {
  soul: 'Soul',
  agents: 'Agents',
  memory: 'Memory',
  context: 'Context',
  tools: 'Tools',
  security: 'Security',
  operations: 'Operations',
  gateway: 'Gateway',
};

const STATUS_BADGES: Record<string, { text: string; variant: string }> = {
  tested: { text: 'Tested', variant: 'success' },
  stable: { text: 'Stable', variant: 'note' },
  draft: { text: 'Draft', variant: 'caution' },
  deprecated: { text: 'Deprecated', variant: 'danger' },
};

interface PatternMeta {
  title: string;
  description: string;
  category: string;
  status: string;
  openclawVersion: string;
  lastValidated: string;
  slug: string;
  filePath: string;
  problemStatement: string;
  layerOnTopOf?: string;
  knownIssues?: string;
  seeAlso?: string;
}

function parsePatternFile(filePath: string, category: string): PatternMeta | null {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Extract title from "# Pattern: <title>"
  const titleLine = lines.find(l => l.startsWith('# Pattern:'));
  if (!titleLine) {
    console.warn(`  Skipping ${filePath}: no "# Pattern:" title found`);
    return null;
  }
  const title = titleLine.replace('# Pattern:', '').trim();

  // Parse metadata blockquotes
  let status = 'tested';
  let openclawVersion = '0.40+';
  let lastValidated = '2026-02-13';
  let layerOnTopOf: string | undefined;
  let knownIssues: string | undefined;
  let seeAlso: string | undefined;

  for (const line of lines) {
    if (!line.startsWith('>')) continue;

    // Main metadata line: > **Category:** X | **Status:** Y | ...
    const categoryMatch = line.match(/\*\*Category:\*\*\s*(\w+)/);
    const statusMatch = line.match(/\*\*Status:\*\*\s*(\w+)/);
    const versionMatch = line.match(/\*\*OpenClaw Version:\*\*\s*(.+?)(?:\s*\||$)/);
    const dateMatch = line.match(/\*\*Last Validated:\*\*\s*([\d-]+)/);

    if (statusMatch) status = statusMatch[1].toLowerCase();
    if (versionMatch) openclawVersion = versionMatch[1].trim();
    if (dateMatch) lastValidated = dateMatch[1].trim();

    // Optional metadata lines
    const layerMatch = line.match(/\*\*Layer on top of:\*\*\s*(.+)/);
    if (layerMatch) layerOnTopOf = layerMatch[1].trim();

    const issuesMatch = line.match(/\*\*Known ecosystem issues this addresses:\*\*\s*(.+)/);
    if (issuesMatch) knownIssues = issuesMatch[1].trim();

    const seeAlsoMatch = line.match(/\*\*See also:\*\*\s*(.+)/);
    if (seeAlsoMatch) seeAlso = seeAlsoMatch[1].trim();
  }

  // Extract problem statement (first paragraph after ## Problem)
  let problemStatement = '';
  let inProblem = false;
  for (const line of lines) {
    if (line.startsWith('## Problem')) {
      inProblem = true;
      continue;
    }
    if (inProblem) {
      if (line.startsWith('##') || (problemStatement && line.trim() === '')) break;
      if (line.trim()) {
        problemStatement += (problemStatement ? ' ' : '') + line.trim();
      }
    }
  }

  // Generate description from first sentence of problem
  const firstSentence = problemStatement.split(/\.\s/)[0];
  const description = firstSentence ? firstSentence + '.' : title;

  const slug = basename(filePath, '.md');

  return {
    title,
    description: description.slice(0, 200),
    category,
    status,
    openclawVersion,
    lastValidated,
    slug,
    filePath,
    problemStatement,
    layerOnTopOf,
    knownIssues,
    seeAlso,
  };
}

function transformCrossLinks(content: string, sourceCategory: string): string {
  // Track if we're inside a fenced code block
  let inCodeBlock = false;
  const lines = content.split('\n');
  const transformedLines = lines.map(line => {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      return line;
    }
    if (inCodeBlock) return line;

    // Transform markdown links: [Text](file.md) or [Text](../category/file.md)
    return line.replace(/\[([^\]]+)\]\(([^)]+\.md)\)/g, (match, text, href) => {
      // Skip external links
      if (href.startsWith('http://') || href.startsWith('https://')) return match;

      let targetCategory: string;
      let targetSlug: string;

      if (href.startsWith('../')) {
        // Cross-directory: ../memory/pre-compaction-memory-flush.md
        const parts = href.replace('../', '').split('/');
        targetCategory = parts[0];
        targetSlug = parts[1].replace('.md', '');
      } else if (href.includes('/')) {
        // Full path: patterns/security/foo.md
        const parts = href.split('/');
        targetCategory = parts[parts.length - 2];
        targetSlug = parts[parts.length - 1].replace('.md', '');
      } else {
        // Same directory: foo.md
        targetCategory = sourceCategory;
        targetSlug = href.replace('.md', '');
      }

      // Only transform if it's a known category
      if (CATEGORIES.includes(targetCategory)) {
        return `[${text}](/patterns/${targetCategory}/${targetSlug}/)`;
      }

      return match;
    });
  });

  return transformedLines.join('\n');
}

function generateFrontmatter(meta: PatternMeta): string {
  const badge = STATUS_BADGES[meta.status] || STATUS_BADGES['tested'];

  let fm = '---\n';
  fm += `title: "${meta.title}"\n`;
  fm += `description: "${meta.description.replace(/"/g, '\\"')}"\n`;
  fm += `category: ${meta.category}\n`;
  fm += `status: ${meta.status}\n`;
  fm += `openclawVersion: "${meta.openclawVersion}"\n`;
  fm += `lastValidated: "${meta.lastValidated}"\n`;
  fm += `sidebar:\n`;
  fm += `  badge:\n`;
  fm += `    text: "${badge.text}"\n`;
  fm += `    variant: "${badge.variant}"\n`;
  fm += '---\n\n';

  return fm;
}

function processPattern(filePath: string, category: string): PatternMeta | null {
  const meta = parsePatternFile(filePath, category);
  if (!meta) return null;

  let content = readFileSync(filePath, 'utf-8');

  // Remove the "# Pattern:" title line (Starlight generates h1 from frontmatter title)
  content = content.replace(/^# Pattern:.*\n/, '');

  // Transform cross-links
  content = transformCrossLinks(content, category);

  // Prepend frontmatter
  const output = generateFrontmatter(meta) + content;

  // Write to docs directory
  const outDir = join(DOCS_DIR, 'patterns', category);
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${meta.slug}.md`);
  writeFileSync(outPath, output);

  console.log(`  ${category}/${meta.slug} -> ${meta.title}`);
  return meta;
}

function processTopLevelDoc(
  srcPath: string,
  destPath: string,
  title: string,
  description: string,
) {
  if (!existsSync(srcPath)) {
    console.warn(`  Skipping ${srcPath}: not found`);
    return;
  }

  let content = readFileSync(srcPath, 'utf-8');

  // Remove first H1 if it exists (Starlight uses frontmatter title)
  content = content.replace(/^# .+\n/, '');

  // Transform pattern links for docs that reference patterns/
  content = content.replace(
    /\[([^\]]+)\]\(patterns\/(\w+)\/([^)]+\.md)\)/g,
    (_, text, cat, file) => `[${text}](/patterns/${cat}/${file.replace('.md', '')}/)`,
  );

  const fm = `---\ntitle: "${title}"\ndescription: "${description}"\n---\n\n`;
  const outDir = dirname(destPath);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(destPath, fm + content);
  console.log(`  ${basename(destPath)}`);
}

function processStack(stackName: string) {
  const srcPath = join(ROOT, 'stacks', stackName, 'README.md');
  if (!existsSync(srcPath)) return;

  const labels: Record<string, string> = {
    daemon: 'systemd / launchd',
    docker: 'Docker',
    cloud: 'Cloud VM',
    n8n: 'n8n Workflows',
  };

  processTopLevelDoc(
    srcPath,
    join(DOCS_DIR, 'stacks', `${stackName}.md`),
    `Stack: ${labels[stackName] || stackName}`,
    `Deployment configuration for ${labels[stackName] || stackName}`,
  );
}

function extractVersionMatrix(): void {
  const readmePath = join(ROOT, 'README.md');
  if (!existsSync(readmePath)) return;

  const content = readFileSync(readmePath, 'utf-8');

  // Extract the Version Matrix section
  const vmStart = content.indexOf('## Version Matrix');
  const vmEnd = content.indexOf('## Pattern Categories');

  if (vmStart === -1 || vmEnd === -1) {
    console.warn('  Could not extract Version Matrix from README.md');
    return;
  }

  let vmContent = content.slice(vmStart, vmEnd).trim();

  // Transform pattern links
  vmContent = vmContent.replace(
    /\[([^\]]+)\]\(patterns\/(\w+)\/([^)]+\.md)\)/g,
    (_, text, cat, file) => `[${text}](/patterns/${cat}/${file.replace('.md', '')}/)`,
  );

  const fm = `---\ntitle: "Version Matrix"\ndescription: "Which patterns work with which OpenClaw version"\n---\n\n`;
  const outDir = join(DOCS_DIR, 'reference');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'version-matrix.md'), fm + vmContent);
  console.log('  reference/version-matrix.md');
}

function generatePatternIndex(allMeta: PatternMeta[]): void {
  const index = allMeta.map(m => ({
    title: m.title,
    category: m.category,
    categoryLabel: CATEGORY_LABELS[m.category],
    slug: m.slug,
    status: m.status,
    openclawVersion: m.openclawVersion,
    description: m.description,
    problemStatement: m.problemStatement.slice(0, 500),
    url: `/patterns/${m.category}/${m.slug}/`,
  }));

  mkdirSync(PUBLIC_DIR, { recursive: true });
  writeFileSync(join(PUBLIC_DIR, 'pattern-index.json'), JSON.stringify(index, null, 2));
  console.log(`\nGenerated pattern-index.json (${index.length} patterns)`);
}

// ============================================================
// Main
// ============================================================

console.log('Preparing OBN content...\n');

// Clean generated directories
const generatedDirs = [
  join(DOCS_DIR, 'patterns'),
  join(DOCS_DIR, 'stacks'),
  join(DOCS_DIR, 'reference'),
];
for (const dir of generatedDirs) {
  if (existsSync(dir)) rmSync(dir, { recursive: true });
}

// Process all patterns
console.log('Processing patterns:');
const allMeta: PatternMeta[] = [];

for (const category of CATEGORIES) {
  const catDir = join(PATTERNS_DIR, category);
  if (!existsSync(catDir)) continue;

  const files = readdirSync(catDir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const meta = processPattern(join(catDir, file), category);
    if (meta) allMeta.push(meta);
  }
}

console.log(`\nProcessed ${allMeta.length} patterns across ${CATEGORIES.length} categories`);

// Process top-level docs
console.log('\nProcessing docs:');

processTopLevelDoc(
  join(ROOT, 'CONTRIBUTING.md'),
  join(DOCS_DIR, 'contributing.md'),
  'Contributing',
  'How to submit patterns to OBN',
);

processTopLevelDoc(
  join(ROOT, 'PATTERN_TEMPLATE.md'),
  join(DOCS_DIR, 'reference', 'pattern-template.md'),
  'Pattern Template',
  'Standard template for new pattern submissions',
);

processTopLevelDoc(
  join(ROOT, 'GAP_ANALYSIS.md'),
  join(DOCS_DIR, 'reference', 'gap-analysis.md'),
  'Gap Analysis',
  'Community research vs current pattern coverage',
);

// Process stacks
console.log('\nProcessing stacks:');
for (const stack of ['daemon', 'docker', 'cloud', 'n8n']) {
  processStack(stack);
}

// Extract version matrix
console.log('\nExtracting version matrix:');
extractVersionMatrix();

// Generate pattern index for AI chat
generatePatternIndex(allMeta);

console.log('\nDone!');
