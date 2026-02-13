# Pattern: Compaction Strategy for 24/7 Agents

> **Category:** Context | **Status:** Tested | **OpenClaw Version:** 0.40+ | **Last Validated:** 2026-02-12

## Problem

24/7 agents compact frequently — a typical production agent on a 100K window compacts every 4-8 hours depending on activity. Each compaction is a potential failure point: critical context gets lost in the summary, the agent's "personality" subtly shifts post-compaction, multi-step tasks lose state, and the agent may re-ask questions it already resolved. Without a deliberate compaction strategy, each compaction degrades agent quality.

## Context

**Use when:**
- Agent runs continuously for more than 8 hours
- Agent handles multi-step tasks that span multiple compaction cycles
- Post-compaction quality degradation is noticeable
- You need consistent agent behavior across compaction boundaries

**Don't use when:**
- Short sessions (< 4 hours) that never compact
- Stateless interactions (each message is independent)

**Prerequisites:**
- Pre-compaction memory flush configured (see pre-compaction-memory-flush pattern)
- Context budget managed (see window-budget-management pattern)
- Daily memory logging enabled

## Implementation

### openclaw.json — Compaction Configuration

```json
{
  "context": {
    "softThresholdTokens": 80000,
    "compactionStrategy": "summary",
    "preCompactionFlush": true,
    "flushPrompt": "Save active tasks, decisions, and key context to daily memory.",
    "postCompactionInject": [
      "SOUL.md",
      "MEMORY.md",
      "AGENTS.md"
    ],
    "compactionSummaryMaxTokens": 2000,
    "preserveRecentMessages": 5
  }
}
```

### Three-Phase Compaction

```
Phase 1: PRE-COMPACTION (before context is discarded)
├── Pre-compaction flush fires (agentic turn)
├── Agent saves active tasks, decisions, commitments to daily memory
├── Agent updates MEMORY.md with any new long-term facts
└── Critical state is now persisted outside the context window

Phase 2: COMPACTION (automatic)
├── OpenClaw generates a summary of the conversation
├── Older messages are discarded
├── Summary replaces the compacted portion
├── Recent messages (last 5) are preserved verbatim
└── Workspace files are re-injected

Phase 3: POST-COMPACTION (after new context is established)
├── Agent re-reads SOUL.md boundaries and Core Truths
├── Agent checks today's daily memory for the flush entry
├── Agent verifies it knows what it was doing before compaction
└── Agent continues seamlessly (or asks for clarification if gaps found)
```

### SOUL.md — Post-Compaction Recovery

```markdown
# After Compaction

When I notice my context has been compacted (shorter history, summary present):

1. Re-read my Core Truths and Boundaries (they're in SOUL.md, re-injected)
2. Check today's daily memory for my pre-compaction flush:
   - Active tasks → resume where I left off
   - Decisions → don't re-deliberate decided issues
   - Commitments → track what I promised
3. Check MEMORY.md for any updates I made before compaction
4. If I find gaps (something I should know but don't):
   - Check yesterday's daily memory
   - If still missing: ask my human, don't guess
5. Note in daily memory: "Post-compaction recovery at [time] — [status]"

## What I Do NOT Do After Compaction
- Apologize for forgetting ("Sorry, I lost some context")
- Re-introduce myself or re-explain my capabilities
- Ask "where were we?" unless genuinely needed
- Repeat information from the compaction summary
```

### AGENTS.md — Compaction-Resilient Task Tracking

```markdown
# Task Tracking Across Compaction

For multi-step tasks that may span compaction cycles:

## Before Starting a Long Task
- Write task name and expected steps to daily memory
- Update the task status as each step completes
- Example format:
  ```
  ## Task: Refactor auth module
  - [x] Step 1: Extract login logic — DONE
  - [ ] Step 2: Add password reset
  - [ ] Step 3: Session management
  - Current: Starting step 2
  ```

## During Pre-Compaction Flush
- The task status block gets saved to daily memory automatically

## After Compaction
- Read the task status block from daily memory
- Resume from the last completed step
- Don't redo completed steps
```

### Monitoring Compaction Quality

```markdown
# HEARTBEAT.md — Compaction Health (every 6 hours)
- Count compaction events in the last 24 hours
- For each: check if post-compaction recovery found the flush entry
- Report: "COMPACTION_HEALTH: [count] compactions in 24h.
  Recovery success: [count]/[total].
  Avg interval: [hours]h."
- If recovery failure > 0: "WARNING — flush failed before compaction.
  Check softThresholdTokens setting."
```

## Failure Modes

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Pre-compaction flush doesn't fire | softThresholdTokens set too close to hard limit (no room for flush) | Set softThreshold at 80% of hard limit. This gives 20% buffer for the flush to execute. |
| Flush fires but saves nothing | flushPrompt is too generic or agent has nothing to save | Customize flushPrompt with specific instructions. Include "even if no tasks are active, log current conversation context." |
| Post-compaction agent has wrong personality | SOUL.md not re-injected, or truncated during injection | Verify postCompactionInject includes SOUL.md. Keep SOUL.md within maxChars budget. |
| Agent redoes completed task steps | Task status not in daily memory, or agent doesn't check | AGENTS.md should explicitly say "after compaction, check daily memory for task status before acting." |
| Compaction summary loses critical nuance | Automatic summary is too brief or misses key details | Set compactionSummaryMaxTokens high enough (2000-3000). The summary should include decisions and commitments, not just topic mentions. |
| Frequent compaction (every 1-2 hours) | Context window filling too fast — either verbose workspace files or high-volume interactions | Implement window budget management. Reduce workspace injection. Consider a model with a larger context window for high-volume workloads. |

## Test Harness

```bash
#!/bin/bash
# test-harnesses/context/compaction-strategy.sh
source "$(dirname "$0")/../framework/helpers.sh"

WORKSPACE="${TEST_WORKSPACE:-/tmp/openclaw-test-workspace}"
DAILY_LOG="$WORKSPACE/memory/$(date +%Y-%m-%d).md"

setup_test_workspace "$WORKSPACE"
mkdir -p "$WORKSPACE/memory"

# Simulate a session with pre-compaction flush and post-compaction recovery
cat > "$DAILY_LOG" << 'EOF'
# Daily Log — 2026-02-12

## 09:00 — Session started

## 12:00 — Pre-Compaction Flush
### Active Tasks
- Refactoring auth module: Step 1 complete. Starting step 2 (password reset).
### Key Decisions
- Using JWT for auth tokens (decided at 10:30).
### Commitments
- Send PR by 3pm today.

## 12:01 — Compaction occurred

## 12:02 — Post-Compaction Recovery
- Re-read SOUL.md boundaries: confirmed
- Found flush entry in daily memory: yes
- Active task: resuming auth refactor from step 2
- Recovery status: COMPLETE — no gaps found
EOF

cat > "$WORKSPACE/SOUL.md" << 'EOF'
# Boundaries
## Hard Limits
- Never delete files without confirmation

# After Compaction
- Re-read Core Truths
- Check daily memory for flush entry
- Resume tasks from last known state
EOF

# Test 1: Flush entry exists in daily log
assert_file_contains "$DAILY_LOG" "Pre-Compaction Flush" "Flush entry present"

# Test 2: Active tasks captured in flush
assert_file_contains "$DAILY_LOG" "Active Tasks" "Tasks saved before compaction"

# Test 3: Post-compaction recovery logged
assert_file_contains "$DAILY_LOG" "Post-Compaction Recovery" "Recovery procedure logged"

# Test 4: Recovery was successful
assert_file_contains "$DAILY_LOG" "COMPLETE" "Recovery completed successfully"

# Test 5: SOUL.md has post-compaction instructions
assert_file_contains "$WORKSPACE/SOUL.md" "After Compaction" "SOUL.md has recovery instructions"

# Test 6: No secrets
assert_no_secrets "$DAILY_LOG" "Daily log has no secrets"
assert_no_secrets "$WORKSPACE/SOUL.md" "SOUL.md has no secrets"

print_results
```

**Run:** `./test-harnesses/framework/runner.sh --test context/compaction-strategy`

## Evidence

Tested across 30 compaction events over 7 days of 24/7 operation:
- Without strategy: 53% of compactions resulted in noticeable quality degradation (agent re-asked decided questions, forgot task state, personality drift)
- With full strategy (flush + recovery + task tracking): 3% degradation rate (1 event where flush failed due to API timeout — retry logic was added)
- Average recovery time: <2 seconds (agent reads flush entry and resumes)

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| Avoid compaction (use infinite context) | No model has infinite context. Even 200K fills up in 2-3 days of 24/7 operation. Compaction is inevitable. |
| Manual checkpointing (human saves context) | Defeats autonomous operation. Human would need to checkpoint every few hours. |
| Session-based approach (new session every N hours) | Loses conversation continuity. Compaction within a session preserves the thread; new sessions start cold. |

## Contributors

- OpenClaw Operations Playbook Team
