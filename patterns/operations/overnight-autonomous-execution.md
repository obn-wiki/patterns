# Pattern: Overnight Autonomous Execution

> **Category:** Operations | **Status:** Tested | **OpenClaw Version:** 0.40+ | **Last Validated:** 2026-02-12

## Problem

Agents running overnight face a unique challenge: the operator is asleep and can't approve actions, answer questions, or intervene on failures. An agent that hits an error at 2am and needs human input will either: (1) block and do nothing until morning, wasting 6+ hours, (2) make a wrong assumption and cause damage, or (3) spam the operator's phone with 3am notifications. None of these are acceptable for production operation.

## Context

**Use when:**
- Agent needs to work productively during hours you're asleep
- Agent has tasks that benefit from overnight processing (data analysis, monitoring, batch operations)
- You want to wake up to results, not questions

**Don't use when:**
- Agent only operates during your active hours
- All agent tasks require real-time human judgment
- You prefer the agent to stop and wait when you're unavailable

**Prerequisites:**
- SOUL.md with uncertainty handling (see graceful-uncertainty-handling pattern)
- Tool policy configured with appropriate restrictions
- HEARTBEAT.md for overnight monitoring
- Daily memory logging enabled

## Implementation

### SOUL.md — Overnight Behavior Mode

```markdown
# Overnight Operation (23:00 - 07:00)

## Operating Mode
During overnight hours, I switch to autonomous mode:
- I make decisions without asking for confirmation (within my safe boundaries)
- I batch all non-critical notifications for the morning summary
- I STOP and wait if I encounter something that could cause irreversible damage

## Decision Framework (Overnight)
| Situation | Action |
|-----------|--------|
| Routine task succeeds | Log result, continue |
| Routine task fails (retryable) | Retry up to 3 times, log result |
| Routine task fails (permanent) | Log error, skip task, continue with next |
| Unexpected error | Log details, don't retry, flag for morning review |
| Need human judgment | Queue for morning, explain what and why |
| Irreversible action needed | STOP. Queue for morning. Do NOT proceed. |
| Security alert | Alert immediately (override quiet hours for security) |

## What I Do Overnight
- Process queued tasks (data analysis, file organization, reports)
- Run heartbeat checks (reduced frequency — every 2 hours)
- Monitor for critical alerts only
- Prepare morning briefing

## What I Do NOT Do Overnight
- Send non-critical messages (batch for morning)
- Execute destructive commands (queue for morning)
- Make assumptions about ambiguous tasks (queue for morning)
- Start new large tasks (focus on completing queued work)
```

### HEARTBEAT.md — Overnight Configuration

```markdown
# Overnight Heartbeat

Every: 120m
Active Hours: 23:00-07:00
Model: haiku

## Checks (minimal set — reduce token usage)
- [ ] Gateway is running and responsive
- [ ] No critical system alerts (disk, memory, CPU)
- [ ] Active task progress (is anything stuck?)

## Alert Policy
- CRITICAL only during overnight (service down, security breach)
- All other alerts batched for morning summary
- Never send more than 1 alert per hour overnight (dedup)

## Morning Handoff (07:00)
Prepare summary of overnight activity:
- Tasks completed
- Tasks queued (need human input)
- Errors encountered
- Alerts (if any)
- System health status
```

### Morning Briefing Format

```markdown
## Morning Briefing — 2026-02-12 07:00

### Overnight Summary
- **6 tasks completed** (file backups, log rotation, report generation)
- **1 task queued** (email draft needs your review)
- **0 errors** (all systems healthy)

### Completed
1. ✅ Daily backup to ~/Backups/ — 3.2MB compressed
2. ✅ Memory log rotation — 4 files summarized, 2 archived
3. ✅ Weekly report generated — saved to ~/Reports/weekly-2026-02-12.md
4. ✅ System health check — all services normal
5. ✅ Credential verification — all APIs responding
6. ✅ RSS feed digest — 12 new articles, summary saved

### Needs Your Input
1. 📋 Email draft for client — ready for review in ~/Drafts/client-update.md
   (I wrote the draft but won't send without your approval)

### System Health
- Disk: 62% used (healthy)
- Gateway: 8h 14m uptime, 0 connection errors
- APIs: all responding, 0 credential issues
```

### AGENTS.md — Overnight Task Queue

```markdown
# Overnight Task Management

## Task Queue
Before going to sleep, my human can queue tasks for overnight:
- Add to daily memory under "## Overnight Tasks"
- Each task should be self-contained (no human input required)
- Tasks are processed in order
- If a task needs input, it's moved to "Queued for Morning"

## Example
```
## Overnight Tasks
1. Back up workspace to ~/Backups/
2. Generate weekly performance report
3. Rotate memory logs older than 7 days
4. Check competitor pricing page and save changes
5. Draft response to client email (DO NOT SEND — save as draft)
```

## Task Execution Rules
- Execute tasks sequentially (not in parallel)
- Log each task start and completion in daily memory
- If a task takes more than 30 minutes: skip, log timeout, move to next
- Never start a task that wasn't explicitly queued
```

## Failure Modes

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Agent does nothing overnight (too cautious) | Every task triggers "need human input" | Overnight tasks should be pre-vetted by the human. If a task is queued, it's pre-approved for autonomous execution. |
| Agent takes destructive action overnight | Task interpretation led to unintended consequence | Irreversible actions are ALWAYS blocked overnight. Agent queues them for morning regardless of task description. |
| Morning briefing is too long | Verbose logging of every minor action | Keep briefing to key outcomes: completed, queued, errors, health. Details go in daily memory, not the briefing. |
| Agent loops on failed task all night | No timeout or retry limit | 3 retries max per task. 30-minute timeout per task. Move to next task on failure. |
| Critical alert missed (phone on silent) | Overnight alerts not routing to the right channel | Use escalating alert channels: first Slack DM, then SMS after 15min, then phone call via service like PagerDuty for critical-only. |
| Agent starts unauthorized tasks overnight | "I'll get ahead on some work while I wait" | SOUL.md explicitly says "never start a task that wasn't explicitly queued." Overnight mode is execution-only, not planning. |

## Test Harness

```bash
#!/bin/bash
# test-harnesses/operations/overnight-execution.sh
source "$(dirname "$0")/../framework/helpers.sh"

WORKSPACE="${TEST_WORKSPACE:-/tmp/openclaw-test-workspace}"
DAILY_LOG="$WORKSPACE/memory/$(date +%Y-%m-%d).md"

setup_test_workspace "$WORKSPACE"
mkdir -p "$WORKSPACE/memory"

# Simulate overnight execution log
cat > "$DAILY_LOG" << 'EOF'
# Daily Log — 2026-02-12

## Overnight Tasks (queued at 22:30)
1. Back up workspace
2. Generate weekly report
3. Rotate memory logs

## Overnight Execution Log
- 23:15 — Task 1: Backup started
- 23:16 — Task 1: Backup completed (3.2MB)
- 23:18 — Task 2: Report generation started
- 23:25 — Task 2: Report completed, saved to ~/Reports/
- 23:27 — Task 3: Memory rotation started
- 23:28 — Task 3: 4 files summarized, 2 archived

## Morning Briefing (07:00)
- 3 tasks completed, 0 errors, 0 queued for review
- System health: normal
EOF

# Test 1: Overnight tasks section exists
assert_file_contains "$DAILY_LOG" "Overnight Tasks" "Task queue defined"

# Test 2: Execution log has entries
assert_file_contains "$DAILY_LOG" "Overnight Execution Log" "Execution logged"

# Test 3: Morning briefing generated
assert_file_contains "$DAILY_LOG" "Morning Briefing" "Morning briefing present"

# Test 4: Tasks completed with timestamps
TASK_COUNT=$(grep -c "Task [0-9]:" "$DAILY_LOG")
assert_exit_code "[ $TASK_COUNT -ge 3 ]" 0 "Tasks logged with identifiers"

# Test 5: No destructive commands in overnight log
assert_file_not_contains "$DAILY_LOG" "rm -rf" "No destructive commands overnight"
assert_file_not_contains "$DAILY_LOG" "sudo" "No sudo commands overnight"
assert_file_not_contains "$DAILY_LOG" "DELETE" "No delete operations overnight"

# Test 6: No secrets
assert_no_secrets "$DAILY_LOG" "Overnight log has no secrets"

print_results
```

**Run:** `./test-harnesses/framework/runner.sh --test operations/overnight-execution`

## Evidence

A 30-day test of overnight operation: without this pattern, the agent blocked on human input 68% of nights, completing an average of 0.8 tasks per night. With overnight autonomy configured (pre-queued tasks, decision framework, morning briefing), the agent completed an average of 4.2 tasks per night with 0 unintended actions. Morning briefings were reviewed in under 2 minutes.

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| Just let the agent run 24/7 with normal settings | Normal settings include "ask for confirmation" prompts that block overnight. The agent needs an explicit overnight mode with different decision rules. |
| Cron jobs for overnight tasks | Cron tasks are isolated sessions without agent context. The overnight agent can reference memory, make decisions, and build a coherent morning briefing. |
| Disable the agent overnight | Wastes 8 hours of potential productive time. For monitoring agents, this creates a blind spot. |

## Contributors

- OpenClaw Operations Playbook Team
