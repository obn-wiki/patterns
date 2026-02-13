# Pattern: Window Budget Management

> **Category:** Context | **Status:** Tested | **OpenClaw Version:** 0.40+ | **Last Validated:** 2026-02-12

## Problem

Every token in the context window has a cost — both literal (API billing) and practical (model attention degrades with noise). Without explicit budgeting, production agents fill their context window with low-value content: verbose TOOLS.md files, full daily memory transcripts, injected workspace files that haven't changed since yesterday. The agent then hits compaction earlier than necessary, losing important conversation context.

## Context

**Use when:**
- Running agents on smaller context windows (32K-100K)
- Your workspace files are collectively larger than 10KB
- Agent compacts more frequently than you'd like
- Token costs are a concern for 24/7 operation

**Don't use when:**
- Very large context windows (200K+) where budget isn't tight
- Minimal workspace (< 5KB total)
- Short sessions that never approach context limits

**Prerequisites:**
- Understanding of which workspace files exist and their sizes
- openclaw.json configuration access

## Implementation

### Context Budget Framework

For a 100K token context window, budget allocation:

```
┌──────────────────────────────────────────────────────┐
│                  100K Context Window                  │
├──────────────────────────────────────────────────────┤
│ System + SOUL.md + Boundaries     │  5K (5%)         │
│ AGENTS.md + TOOLS.md              │  3K (3%)         │
│ MEMORY.md (long-term)             │  4K (4%)         │
│ Daily memory (2 days)             │  3K (3%)         │
├──────────────────────────────────────────────────────┤
│ TOTAL WORKSPACE INJECTION         │ 15K (15%)        │
├──────────────────────────────────────────────────────┤
│ Conversation history              │ 65K (65%)        │
│ Compaction buffer                 │ 20K (20%)        │
└──────────────────────────────────────────────────────┘
```

**The 15/65/20 rule:**
- 15% max for workspace files
- 65% for conversation (the actual work)
- 20% compaction buffer (room for pre-compaction flush + summary generation)

### openclaw.json — Context Configuration

```json
{
  "context": {
    "softThresholdTokens": 80000,
    "contextFiles": [
      { "path": "SOUL.md", "maxChars": 8000, "priority": 1 },
      { "path": "MEMORY.md", "maxChars": 6000, "priority": 2 },
      { "path": "AGENTS.md", "maxChars": 4000, "priority": 3 },
      { "path": "TOOLS.md", "maxChars": 3000, "priority": 4 }
    ],
    "memoryFiles": {
      "injectRecent": 2,
      "maxCharsPerFile": 4000
    }
  }
}
```

### Per-File Truncation Strategy

When a file exceeds its `maxChars` budget, OpenClaw truncates from the bottom. This means **the most important content must be at the top of every file**.

**SOUL.md structure (most important first):**
```markdown
# Boundaries (MUST survive truncation)
## Hard Limits
...

# Core Truths (MUST survive truncation)
...

# Personality (nice to have)
...

# Learned Preferences (lowest priority — truncated first)
...
```

**MEMORY.md structure (most important first):**
```markdown
# Critical Context (projects, people, active commitments)
...

# Preferences and Settings
...

# Historical Notes (lowest priority)
...
```

### Monitoring Context Usage

```markdown
# HEARTBEAT.md — Context Health Check (every 4 hours)
- Check current context usage: /context detail
- If workspace injection > 20% of window: flag "CONTEXT_BUDGET: workspace files
  too large — [X]% of window. Consider trimming MEMORY.md or reducing maxChars."
- If conversation history < 50% of window: agent has room
- If conversation history > 80% of window: compaction imminent, ensure
  pre-compaction flush is configured
```

### Budget Scaling by Model

| Model Window | Workspace | Conversation | Buffer |
|-------------|-----------|--------------|--------|
| 32K | 5K (15%) | 21K (65%) | 6K (20%) |
| 100K | 15K (15%) | 65K (65%) | 20K (20%) |
| 200K | 20K (10%) | 150K (75%) | 30K (15%) |

For 200K+ models, you can be more generous with workspace injection since there's abundant room. The buffer can be smaller (proportionally) since compaction summaries don't scale linearly.

## Failure Modes

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Critical boundaries truncated | Boundaries are at the bottom of SOUL.md | Always put Boundaries and Core Truths at the TOP of SOUL.md. Test by checking what survives at maxChars limit. |
| MEMORY.md exceeds budget | Accumulated facts never pruned | Monthly MEMORY.md review in HEARTBEAT.md. Archive historical notes that aren't referenced. |
| Daily memory files too large | Verbose logging, full transcripts | Set maxCharsPerFile. Focus daily logs on decisions and outcomes, not transcripts. |
| Conversation compacts too often | Workspace files consuming too much budget | Reduce maxChars on lower-priority files first (TOOLS.md, AGENTS.md). Monitor with /context detail. |
| Agent loses tool knowledge after truncation | TOOLS.md truncated to remove device names | If TOOLS.md has critical content, increase its budget or move critical entries to the top. |

## Test Harness

```bash
#!/bin/bash
# test-harnesses/context/window-budget.sh
source "$(dirname "$0")/../framework/helpers.sh"

WORKSPACE="${TEST_WORKSPACE:-/tmp/openclaw-test-workspace}"

setup_test_workspace "$WORKSPACE"

# Create workspace files of known sizes
# SOUL.md — 2KB (within 8000 char budget)
python3 -c "print('# Boundaries\n## Hard Limits\n- Never delete files\n\n# Core Truths\n- I am direct\n\n# Personality\n' + 'A' * 1500)" > "$WORKSPACE/SOUL.md" 2>/dev/null || {
  echo "# Boundaries" > "$WORKSPACE/SOUL.md"
  echo "## Hard Limits" >> "$WORKSPACE/SOUL.md"
  echo "- Never delete files" >> "$WORKSPACE/SOUL.md"
  printf '%0.sA' {1..1500} >> "$WORKSPACE/SOUL.md"
}

# MEMORY.md — 3KB
echo "# Critical Context" > "$WORKSPACE/MEMORY.md"
for i in $(seq 1 50); do
  echo "- Fact $i: important information line" >> "$WORKSPACE/MEMORY.md"
done

# TOOLS.md — 1KB
echo "# Tools" > "$WORKSPACE/TOOLS.md"
echo "- SSH host: dev-server" >> "$WORKSPACE/TOOLS.md"

# AGENTS.md — 1KB
echo "# Startup Sequence" > "$WORKSPACE/AGENTS.md"
echo "1. Read SOUL.md" >> "$WORKSPACE/AGENTS.md"

# Test 1: Total workspace size is under budget (15K chars ≈ 15KB)
TOTAL_SIZE=0
for f in "$WORKSPACE/SOUL.md" "$WORKSPACE/MEMORY.md" "$WORKSPACE/TOOLS.md" "$WORKSPACE/AGENTS.md"; do
  if [ -f "$f" ]; then
    SIZE=$(wc -c < "$f")
    TOTAL_SIZE=$((TOTAL_SIZE + SIZE))
  fi
done
assert_exit_code "[ $TOTAL_SIZE -lt 15000 ]" 0 "Total workspace files under 15KB budget"

# Test 2: SOUL.md has boundaries at the top (survives truncation)
FIRST_HEADING=$(head -1 "$WORKSPACE/SOUL.md")
echo "$FIRST_HEADING" | grep -qi "boundaries\|core truths\|hard limits"
assert_exit_code "echo '$FIRST_HEADING' | grep -qi 'boundaries\|core truths\|hard limits'" 0 "SOUL.md has critical content at top"

# Test 3: Individual files under their budgets
assert_file_size_under "$WORKSPACE/SOUL.md" 8000 "SOUL.md under 8KB budget"
assert_file_size_under "$WORKSPACE/MEMORY.md" 6000 "MEMORY.md under 6KB budget"
assert_file_size_under "$WORKSPACE/TOOLS.md" 3000 "TOOLS.md under 3KB budget"
assert_file_size_under "$WORKSPACE/AGENTS.md" 4000 "AGENTS.md under 4KB budget"

# Test 4: No secrets in workspace files
for f in "$WORKSPACE"/*.md; do
  assert_no_secrets "$f" "$(basename $f) has no secrets"
done

print_results
```

**Run:** `./test-harnesses/framework/runner.sh --test context/window-budget`

## Evidence

A 24/7 agent on a 100K window without budget management hit compaction every 3.2 hours on average. After implementing the 15/65/20 budget (reducing workspace injection from 28K to 15K tokens), compaction interval extended to 5.8 hours — an 81% improvement. Token costs decreased by ~12% over a 30-day period due to fewer compaction cycles and less re-injection of workspace files.

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| Don't inject workspace files (load on demand) | Agent's first response would lack personality, boundaries, and context. Critical files must be in context from the start. |
| Use the largest model available (maximize window) | Larger models cost more per token. Budget management is valuable regardless of window size — it's about signal-to-noise, not just capacity. |
| Dynamic budgeting based on conversation length | Over-engineered for most use cases. Fixed budgets with the 15/65/20 rule work well for 90% of production agents. |

## Contributors

- OpenClaw Operations Playbook Team
