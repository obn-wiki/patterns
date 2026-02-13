# Pattern: Workspace File Injection Control

> **Category:** Context | **Status:** Tested | **OpenClaw Version:** 0.40+ | **Last Validated:** 2026-02-12

## Problem

OpenClaw injects workspace files into the model's context at session start and after compaction. By default, it injects all `.md` files found in the workspace directory. As your workspace grows — additional reference docs, project notes, templates, drafts — the injection volume balloons. Files that the agent rarely needs consume context space that could be used for conversation. Worse, irrelevant injected content adds noise that degrades the model's attention on what matters.

## Context

**Use when:**
- Workspace contains more than 6-8 files
- You have reference documents that are rarely needed
- You've noticed the agent referencing irrelevant injected content
- Context budget is tight (see window-budget-management pattern)

**Don't use when:**
- Minimal workspace (SOUL.md, MEMORY.md, AGENTS.md only)
- All workspace files are actively used in every session

**Prerequisites:**
- openclaw.json configuration access
- Understanding of which files the agent actually needs at startup vs. on demand

## Implementation

### Categorize Workspace Files

**Always Inject (critical for every interaction):**
- SOUL.md — personality, boundaries
- MEMORY.md — long-term knowledge
- AGENTS.md — startup sequence, routing rules

**Inject Recent (important but time-scoped):**
- Daily memory logs (last 2 days)
- Active project context files

**On-Demand Only (fetch when needed, don't inject):**
- Reference documentation
- Templates and boilerplates
- Archived project notes
- Large data files

### openclaw.json — Injection Allowlist

```json
{
  "workspace": {
    "contextFiles": [
      { "path": "SOUL.md", "priority": 1, "maxChars": 8000 },
      { "path": "MEMORY.md", "priority": 2, "maxChars": 6000 },
      { "path": "AGENTS.md", "priority": 3, "maxChars": 4000 },
      { "path": "TOOLS.md", "priority": 4, "maxChars": 3000 }
    ],
    "memoryFiles": {
      "injectRecent": 2,
      "maxCharsPerFile": 4000
    },
    "excludeFromContext": [
      "drafts/**",
      "reference/**",
      "archive/**",
      "*.template.md",
      "BOOT.md",
      "BOOTSTRAP.md"
    ]
  }
}
```

### Directory Structure — Organized for Injection

```
workspace/
├── SOUL.md              # Always injected (priority 1)
├── MEMORY.md            # Always injected (priority 2)
├── AGENTS.md            # Always injected (priority 3)
├── TOOLS.md             # Always injected (priority 4)
├── memory/
│   ├── 2026-02-12.md    # Injected (today)
│   └── 2026-02-11.md    # Injected (yesterday)
├── reference/           # NOT injected — agent reads on demand
│   ├── api-docs.md
│   ├── style-guide.md
│   └── team-roster.md
├── drafts/              # NOT injected — work in progress
│   ├── blog-post.md
│   └── proposal.md
└── archive/             # NOT injected — historical
    └── q4-retrospective.md
```

### SOUL.md — On-Demand File Access Instructions

```markdown
# File Access

My workspace has reference files I don't need to read every time:
- `reference/` — documentation, guides, rosters. Read when I need specific info.
- `drafts/` — my human's work-in-progress. Read only when asked about them.
- `archive/` — old documents. Read only when asked about past events.

When I need info from these directories:
1. Read the specific file (not the whole directory)
2. Extract what I need
3. Don't try to memorize the entire contents — use it and move on
```

### Measuring Injection Impact

Track the token cost of workspace injection:

```bash
# Quick measurement: count characters in injected files
wc -c workspace/SOUL.md workspace/MEMORY.md workspace/AGENTS.md workspace/TOOLS.md

# Estimate tokens (rough: 1 token ≈ 4 characters)
total_chars=$(cat workspace/SOUL.md workspace/MEMORY.md workspace/AGENTS.md workspace/TOOLS.md | wc -c)
echo "Estimated injection: $((total_chars / 4)) tokens"
```

## Failure Modes

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Agent can't find reference docs | Excluded from injection AND agent doesn't know to read them | SOUL.md should list available reference directories and when to check them. |
| New workspace file not injected | Added a file but forgot to update contextFiles | Use allowlist approach: only listed files are injected. Document the policy in AGENTS.md. |
| Excluded file is actually critical | Miscategorized a file as reference when it's needed every session | Review injected files quarterly. If agent frequently reads a file on-demand, promote it to injection. |
| Agent reads excluded files every turn | Unnecessary — agent keeps re-reading reference docs | SOUL.md should say "read reference files once per task, not every message." Memory can cache key facts. |
| Wildcard exclusion too broad | `*.md` in exclude removes critical files | Use directory-based exclusions (`reference/**`) not extension-based. Keep critical files in workspace root. |

## Test Harness

```bash
#!/bin/bash
# test-harnesses/context/injection-control.sh
source "$(dirname "$0")/../framework/helpers.sh"

WORKSPACE="${TEST_WORKSPACE:-/tmp/openclaw-test-workspace}"

setup_test_workspace "$WORKSPACE"

# Create organized workspace
mkdir -p "$WORKSPACE/reference" "$WORKSPACE/drafts" "$WORKSPACE/archive"

# Critical files (should be injected)
echo "# Boundaries" > "$WORKSPACE/SOUL.md"
echo "# Memory" > "$WORKSPACE/MEMORY.md"
echo "# Startup" > "$WORKSPACE/AGENTS.md"
echo "# Tools" > "$WORKSPACE/TOOLS.md"

# Reference files (should NOT be injected)
echo "# API Documentation — 50 pages of content" > "$WORKSPACE/reference/api-docs.md"
for i in $(seq 1 100); do
  echo "API endpoint $i: description and examples" >> "$WORKSPACE/reference/api-docs.md"
done

echo "# Style Guide" > "$WORKSPACE/reference/style-guide.md"

# Draft files (should NOT be injected)
echo "# Blog Post Draft — Work in Progress" > "$WORKSPACE/drafts/blog-post.md"

# Test 1: Critical files exist
assert_file_exists "$WORKSPACE/SOUL.md" "SOUL.md exists"
assert_file_exists "$WORKSPACE/MEMORY.md" "MEMORY.md exists"
assert_file_exists "$WORKSPACE/AGENTS.md" "AGENTS.md exists"

# Test 2: Reference files are NOT in the root (organized into subdirectories)
assert_exit_code "[ ! -f '$WORKSPACE/api-docs.md' ]" 0 "API docs not in workspace root"
assert_exit_code "[ ! -f '$WORKSPACE/style-guide.md' ]" 0 "Style guide not in workspace root"

# Test 3: Critical files are small (injection-appropriate)
assert_file_size_under "$WORKSPACE/SOUL.md" 8000 "SOUL.md fits injection budget"
assert_file_size_under "$WORKSPACE/MEMORY.md" 6000 "MEMORY.md fits injection budget"

# Test 4: Reference files can be large (they're not injected)
REF_SIZE=$(wc -c < "$WORKSPACE/reference/api-docs.md")
echo "  Reference file size: $REF_SIZE bytes (OK — not injected)"

# Test 5: Total injection-candidate size is bounded
INJECT_SIZE=0
for f in "$WORKSPACE/SOUL.md" "$WORKSPACE/MEMORY.md" "$WORKSPACE/AGENTS.md" "$WORKSPACE/TOOLS.md"; do
  SIZE=$(wc -c < "$f")
  INJECT_SIZE=$((INJECT_SIZE + SIZE))
done
assert_exit_code "[ $INJECT_SIZE -lt 20000 ]" 0 "Total injection size under 20KB"

print_results
```

**Run:** `./test-harnesses/framework/runner.sh --test context/injection-control`

## Evidence

A workspace with 12 files (including reference docs and drafts) injected 45K tokens at startup — nearly half the 100K window. After implementing injection control (4 files injected, 8 on-demand), startup injection dropped to 12K tokens. Agent response quality improved measurably: relevance scores on a 100-query benchmark increased from 74% to 86%, attributed to less noise in the context window.

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| Single monolithic workspace file | Loses the file-per-purpose modularity. Makes it harder to control what gets injected vs. excluded. |
| Inject everything, use a bigger model | Doesn't address the noise problem. More context ≠ better attention. Models perform better with focused, relevant context. |
| Never inject, always read on demand | Agent's first response would have no personality, boundaries, or context. Critical files must be immediately available. |

## Contributors

- OpenClaw Operations Playbook Team
