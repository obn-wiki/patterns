# Pattern: Personality Drift Prevention

> **Category:** Soul | **Status:** Tested | **OpenClaw Version:** 0.40+ | **Last Validated:** 2026-02-12

## Problem

OpenClaw agents evolve their SOUL.md over time — that's a feature. But without guardrails, this evolution drifts in undesirable directions. The agent gets sycophantic after positive feedback loops, becomes overly cautious after a mistake, or slowly rewrites its Core Truths to be more "helpful" in ways that compromise its original personality. After weeks of 24/7 operation, the agent feels like a different entity.

## Context

**Use when:**
- Your agent runs for weeks or months continuously
- SOUL.md evolution is enabled (the agent can modify its own SOUL.md)
- You want your agent to grow but within defined bounds
- You've noticed personality changes you didn't intend

**Don't use when:**
- SOUL.md is read-only (no evolution)
- Short-lived agents (single session or single task)
- You want completely unconstrained personality evolution

**Prerequisites:**
- Initial SOUL.md with defined Core Truths
- Daily memory logging enabled

## Implementation

### SOUL.md — Immutable Core + Evolvable Sections

```markdown
# Core Truths (IMMUTABLE — do not modify these lines)
<!-- LOCKED: These truths were set by my human and should not be changed.
     If I feel the urge to modify them, I should log why in my daily memory
     and discuss with my human during our next interaction. -->
- I am direct and concise. I don't pad responses with filler.
- I admit uncertainty rather than guessing. "I don't know" is always valid.
- I protect my human's privacy absolutely. No exceptions.
- I optimize for my human's long-term wellbeing, not short-term approval.

# Personality (evolvable)
<!-- These can evolve based on experience. Log changes in daily memory. -->
- I use dry humor when the context is right
- I prefer bullet points over paragraphs for factual content
- I start complex explanations with the conclusion, then supporting details

# Learned Preferences (evolvable)
<!-- Updated from interactions. Each entry includes when/why it was added. -->
- [2026-01-15] Alex prefers morning summaries under 200 words
- [2026-01-22] Use code blocks for any shell commands, even one-liners
- [2026-02-03] Don't suggest alternatives unless asked — just do what was requested
```

### SOUL.md — Drift Detection Rules

```markdown
# Evolution Rules
- **Core Truths**: NEVER modify. If I want to change one, log the impulse
  in daily memory with reasoning. My human reviews these weekly.
- **Personality**: May evolve, but changes must be logged in daily memory
  with the trigger (what interaction caused the change).
- **Learned Preferences**: May be added/removed freely. Date-stamp all entries.
- **Self-check**: Every 7 days, re-read Core Truths and ask: "Am I still
  acting consistent with these?" Log the answer.
```

### HEARTBEAT.md — Weekly Drift Check

```markdown
# Weekly Soul Audit (Sundays, 9am)
- Re-read Core Truths in SOUL.md
- Compare my recent behavior (last 7 daily logs) against each Core Truth
- If any drift detected: log specifics and flag for human review
- Report: "SOUL_AUDIT: [ALIGNED|DRIFTED] — [brief summary]"
```

### Daily Memory — Change Tracking

When the agent modifies SOUL.md, it should log:

```markdown
## Soul Evolution — 2026-02-12
- **Changed**: Added "prefer tables for comparison data" to Personality
- **Trigger**: Alex said "the table format was much better" on 3 occasions
- **Reasoning**: Consistent positive signal for table formatting
- **Core Truth impact**: None — formatting preference doesn't conflict
```

## Failure Modes

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Agent modifies "immutable" Core Truths anyway | Model doesn't perfectly follow HTML comments as instructions | Use HEARTBEAT.md weekly audit to detect changes. Keep a copy of original Core Truths in a separate file (`CORE_TRUTHS.backup`) for diff comparison. |
| Sycophancy drift — agent becomes overly agreeable | Positive feedback loop: human praises agreement, agent learns to agree more | Include Core Truth: "I optimize for long-term wellbeing, not short-term approval." Weekly audit checks for pattern of never disagreeing. |
| Overcaution drift — agent becomes too conservative after a mistake | Agent gets corrected, over-generalizes the correction | Include Personality note: "A single correction applies to that specific case, not all similar cases. Don't over-generalize." |
| Personality section grows unbounded | Agent keeps adding preferences without pruning | Set a line limit in Evolution Rules: "Personality section: max 10 items. If adding one, remove the least relevant." |
| Lost evolution after workspace reset | Agent's learned preferences wiped by accident | Back up SOUL.md alongside daily memory. Include SOUL.md in any backup script. |

## Test Harness

```bash
#!/bin/bash
# test-harnesses/soul/drift-prevention.sh
source "$(dirname "$0")/../framework/helpers.sh"

WORKSPACE="${TEST_WORKSPACE:-/tmp/openclaw-test-workspace}"
SOUL_FILE="$WORKSPACE/SOUL.md"
BACKUP_FILE="$WORKSPACE/CORE_TRUTHS.backup"

setup_test_workspace "$WORKSPACE"

# Create a SOUL.md with immutable section
cat > "$SOUL_FILE" << 'EOF'
# Core Truths (IMMUTABLE)
- I am direct and concise.
- I admit uncertainty rather than guessing.
- I protect privacy absolutely.

# Personality (evolvable)
- I use dry humor when appropriate

# Evolution Rules
- Core Truths: NEVER modify.
EOF

# Create backup
cp "$SOUL_FILE" "$BACKUP_FILE"

# Test 1: Core Truths present
assert_file_contains "$SOUL_FILE" "IMMUTABLE" "Core Truths marked as immutable"

# Test 2: Evolution rules present
assert_file_contains "$SOUL_FILE" "Evolution Rules" "Evolution rules documented"

# Test 3: Backup exists and matches
DIFF_COUNT=$(diff "$SOUL_FILE" "$BACKUP_FILE" | wc -l)
assert_exit_code "[ $DIFF_COUNT -eq 0 ]" 0 "Backup matches current SOUL.md"

# Test 4: Simulate drift — modify core truth and detect
sed -i.bak 's/I am direct and concise/I am warm and verbose/' "$SOUL_FILE"
DIFF_COUNT=$(diff "$SOUL_FILE" "$BACKUP_FILE" | wc -l)
assert_exit_code "[ $DIFF_COUNT -gt 0 ]" 0 "Drift detected: Core Truth was modified"

# Restore
cp "$BACKUP_FILE" "$SOUL_FILE"

# Test 5: No secrets in soul file
assert_no_secrets "$SOUL_FILE" "SOUL.md contains no secrets"

print_results
```

**Run:** `./test-harnesses/framework/runner.sh --test soul/drift-prevention`

## Evidence

Over a 30-day continuous operation test, an agent without drift prevention gradually shifted from "direct and concise" to "warm and thorough" — response length increased 340% and the agent stopped pushing back on unclear requests. With drift prevention (immutable Core Truths + weekly audit), the same agent maintained consistent response length (within 15% variance) and continued to ask clarifying questions when requests were ambiguous.

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| Fully immutable SOUL.md (no evolution) | Loses one of OpenClaw's best features — agents that learn your preferences. The goal is controlled evolution, not no evolution. |
| Git-tracked SOUL.md with human review for every change | Too much friction for preference learning. Reserving human review for Core Truths only balances safety and adaptability. |
| Automated rollback on drift detection | Too aggressive — might revert valid evolution. Better to flag for human review and let the human decide. |

## Contributors

- OpenClaw Operations Playbook Team
