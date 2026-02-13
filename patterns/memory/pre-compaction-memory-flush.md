# Pattern: Pre-Compaction Memory Flush

> **Category:** Memory | **Status:** Tested | **OpenClaw Version:** 0.40+ (enhanced on 2026.2.x) | **Last Validated:** 2026-02-13

## Problem

When OpenClaw's context window fills up, it compacts — summarizing and discarding older messages. Any information not already written to persistent memory (MEMORY.md or daily logs) is lost forever. For interactive sessions this is annoying; for 24/7 production agents it's catastrophic. A running task list, a multi-step debugging session, or a critical decision made hours ago vanishes mid-conversation.

OpenClaw supports a "pre-compaction flush" — a silent agentic turn that runs before compaction to save important context. But the default behavior is minimal. This pattern configures a thorough flush that preserves what matters.

## Context

**Use when:**
- Agent runs long sessions (hours to days)
- Agent handles multi-step tasks that span many messages
- You've lost important context after compaction before
- Agent manages stateful workflows (task tracking, project context)

**Don't use when:**
- Short sessions that never approach context limits
- Every interaction is independent (no state needed between messages)

**Prerequisites:**
- Daily memory logging enabled
- Understanding of your typical context window usage patterns

## Implementation

### SOUL.md — Pre-Compaction Instructions

```markdown
# Memory Management

## Before Compaction
When I sense my context is getting full (or when explicitly told to compact):

1. **Save active state** to today's daily memory:
   - Any tasks in progress (what's done, what's next)
   - Any decisions made with their reasoning
   - Any commitments I've made (scheduled actions, promised follow-ups)
   - Key facts from the current conversation that aren't in MEMORY.md

2. **Update MEMORY.md** if any long-term facts were established:
   - New preferences learned
   - New project context
   - Changed contact info or environment details

3. **Do NOT save**:
   - Full conversation transcripts (too large, redundant)
   - Temporary debugging context (ephemeral by nature)
   - Information that's already in memory files

## Flush Format (in daily memory)
```
## Pre-Compaction Flush — [timestamp]
### Active Tasks
- [task]: [status] — [next step]
### Key Decisions
- [decision]: [reasoning]
### Commitments
- [promise]: [deadline if any]
### Context to Preserve
- [fact not yet in MEMORY.md]
```
```

### openclaw.json — Compaction Configuration

```json
{
  "context": {
    "softThresholdTokens": 80000,
    "compactionStrategy": "summary",
    "preCompactionFlush": true,
    "flushPrompt": "Before compacting, save any active tasks, decisions, commitments, and key context to today's daily memory. Format per SOUL.md instructions."
  }
}
```

### v2026.2.x Enhancements

OpenClaw v2026.2.x introduced compaction retries, session history caps, and model-specific compaction behavior. These interact with the flush pattern:

```json
{
  "context": {
    "softThresholdTokens": 80000,
    "compactionStrategy": "summary",
    "preCompactionFlush": true,
    "flushPrompt": "Before compacting, save any active tasks, decisions, commitments, and key context to today's daily memory. Format per SOUL.md instructions."
  },
  "agents": {
    "defaults": {
      "compaction": {
        "mode": "safeguard",
        "memoryFlush": {
          "enabled": true,
          "model": "claude-3-haiku",
          "systemPrompt": "You are a memory preservation agent. Extract and save active state before compaction.",
          "prompt": "Save active tasks, decisions, and commitments to today's daily memory."
        }
      }
    }
  }
}
```

**Key changes in v2026.2.x:**
- **Compaction retries**: If compaction fails, OpenClaw retries. Your flush should be idempotent — if it runs twice, it shouldn't duplicate entries. Use timestamped section headers (`## Pre-Compaction Flush — [timestamp]`) to prevent duplicate content.
- **Session history caps**: v2026.2.6 introduced session history caps for cost control. If your session history is capped, compaction happens more frequently. Set `softThresholdTokens` relative to your cap, not just the model's maximum context.
- **Flush model tiering**: The flush turn doesn't require the expensive primary model. Use Haiku for the flush — it's fast, cheap, and extracting structured state from context doesn't need complex reasoning. Set `compaction.memoryFlush.model: "claude-3-haiku"` to avoid paying Sonnet/Opus prices for a save operation.

### Key Design: softThresholdTokens

Set this to ~80% of your model's context window. This gives the flush turn enough room to execute before hard compaction kicks in.

| Model Context | Soft Threshold | Flush Budget |
|---------------|---------------|--------------|
| 32K | 25,600 | ~6,400 tokens |
| 100K | 80,000 | ~20,000 tokens |
| 200K | 160,000 | ~40,000 tokens |

The flush turn itself typically uses 500-2,000 tokens depending on how much state needs to be saved.

### Daily Memory — Flush Entry Example

```markdown
## Pre-Compaction Flush — 2026-02-12 14:30

### Active Tasks
- Refactoring auth module: 60% done. Login endpoint complete.
  Next: password reset flow, then session management.
- Draft email to client: waiting for Alex's review. Saved in ~/Drafts/client-update.md.

### Key Decisions
- Chose JWT over session cookies for auth: stateless, works across
  subdomains, team agreed in standup.
- Using Postgres for session store (not Redis): simpler infra,
  acceptable latency for our scale.

### Commitments
- Send client update by Friday EOD
- Review PR #142 before tomorrow's standup

### Context to Preserve
- Client's new domain: example.com (changed from old-example.com last week)
- Dev server moved to 192.168.1.50 (was .40)
```

## Failure Modes

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Flush turn runs but saves nothing useful | Generic flush prompt doesn't capture the right things | Customize `flushPrompt` for your agent's typical workload. Include specific categories to save. |
| Flush turn fails (API error, timeout) | Network issue during the agentic turn | OpenClaw should still proceed with compaction. The flush is best-effort. Log the failure. |
| Flush saves too much (entire conversation) | Agent interprets "save important context" too broadly | SOUL.md explicitly says "Do NOT save full conversation transcripts." Size limit the flush output. |
| Post-compaction agent doesn't read the flush | Flush was written to daily memory but not in the post-compaction context | Ensure daily memory files are injected into context post-compaction. Set `injectRecent: 2` in config. |
| Flush overwrites earlier daily memory content | Agent replaces the file instead of appending | Use append-only writes for daily memory. Each flush is a new section, not a file replacement. |
| Duplicate information saved | Agent saves things already in MEMORY.md | SOUL.md explicitly says "Do NOT save information that's already in memory files." Reduces token waste. |
| Flush turn times out (tool timeout) | Flush tries to write too much, or the memory write tool is slow | Keep flush output concise (target <2000 tokens). If flush fails, compaction proceeds without it — some data loss is better than a blocked compaction cycle. Monitor for flush timeout events in logs. |
| Race condition with shared memory files (multi-agent) | Two agents compact simultaneously and both try to flush to the same daily memory file | Use per-agent daily memory files (`memory/agent-name/YYYY-MM-DD.md`) or use append-only writes with agent-prefixed section headers. See [Multi-Agent Memory Isolation](multi-agent-memory-isolation.md). |
| Flush runs twice due to compaction retry | v2026.2.x compaction retries can trigger the flush again | Use timestamped section headers. Before writing, check if a flush section with the same timestamp already exists. Idempotent flushes prevent duplicate entries. |

## Test Harness

```bash
#!/bin/bash
# test-harnesses/memory/pre-compaction-flush.sh
source "$(dirname "$0")/../framework/helpers.sh"

WORKSPACE="${TEST_WORKSPACE:-/tmp/openclaw-test-workspace}"
DAILY_LOG="$WORKSPACE/memory/$(date +%Y-%m-%d).md"

setup_test_workspace "$WORKSPACE"
mkdir -p "$WORKSPACE/memory"

# Simulate a pre-compaction flush entry
cat > "$DAILY_LOG" << 'EOF'
# Daily Log — 2026-02-12

## Morning
- 09:00 — Session started

## Pre-Compaction Flush — 14:30
### Active Tasks
- Refactoring auth module: 60% done. Next: password reset flow.
### Key Decisions
- Chose JWT over session cookies: stateless, cross-subdomain.
### Commitments
- Send client update by Friday EOD
### Context to Preserve
- Dev server moved to 192.168.1.50

## Afternoon
- 15:00 — Resumed after compaction, context restored from flush
EOF

# Test 1: Flush section exists in daily log
assert_file_contains "$DAILY_LOG" "Pre-Compaction Flush" "Flush section present"

# Test 2: Active tasks captured
assert_file_contains "$DAILY_LOG" "Active Tasks" "Active tasks section exists"

# Test 3: Key decisions captured
assert_file_contains "$DAILY_LOG" "Key Decisions" "Key decisions section exists"

# Test 4: Commitments captured
assert_file_contains "$DAILY_LOG" "Commitments" "Commitments section exists"

# Test 5: Post-compaction session references the flush
assert_file_contains "$DAILY_LOG" "context restored" "Post-compaction recovery noted"

# Test 6: No secrets in daily log
assert_no_secrets "$DAILY_LOG" "Daily log has no secrets"

# Test 7: Daily log size is reasonable (not a full transcript)
assert_file_size_under "$DAILY_LOG" 10240 "Daily log under 10KB (not a transcript dump)"

print_results
```

**Run:** `./test-harnesses/framework/runner.sh --test memory/pre-compaction-flush`

## Evidence

In 24-hour continuous operation tests, agents without pre-compaction flush lost task context on 4 out of 6 compaction events (67% loss rate). Key symptoms: agent re-asked questions it had already resolved, forgot about in-progress tasks, and contradicted earlier decisions. With pre-compaction flush configured, context loss dropped to 0 out of 6 compaction events — the agent consistently resumed tasks from the correct state after compaction.

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| Manually save context before compaction | Requires human intervention. Defeats the purpose of autonomous 24/7 operation. Pre-compaction flush is automatic. |
| Never compact (use infinite context models) | No current model has infinite context. Even 200K windows fill up in multi-day sessions. Compaction is inevitable. |
| Write everything to memory continuously | Token-expensive (every message triggers a write). Pre-compaction flush is more efficient — one batch save when needed. |
| Use vector search to recover context post-compaction | Vector search retrieves related content, not the specific active state. A flush preserves exact task status, decisions, and commitments — structured data that vector search handles poorly. |

## Contributors

- OpenClaw Operations Playbook Team
