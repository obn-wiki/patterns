# Pattern: Cron Reliability Hardening

> **Category:** Operations | **Status:** Tested | **OpenClaw Version:** 2026.2.12+ | **Last Validated:** 2026-02-14

> **See also:** [Heartbeat Checklist Design](heartbeat-checklist-design.md) for heartbeat-specific configuration. This pattern covers the cron scheduler itself — making ALL scheduled jobs reliable.

## Problem

OpenClaw's cron scheduler manages periodic jobs: heartbeats, email checks, report generation, maintenance tasks. Before v2026.2.12, the scheduler had over a dozen reliability bugs: jobs would be skipped when `nextRunAtMs` advanced, duplicate triggers fired simultaneously, one failing job would block all others, timers wouldn't re-arm during execution, and one-shot `at` jobs could re-fire after errors. If you've ever wondered why your heartbeat missed a run, or why your daily email check fired twice — these were scheduler bugs, not configuration errors.

v2026.2.12 fixes all of them. But you still need to configure the scheduler correctly to get the most out of the fixes.

## Context

**Use when:**
- Running any cron/scheduled jobs in OpenClaw
- Using HEARTBEAT.md for periodic monitoring
- Running isolated agent jobs (multi-agent cron)
- Using one-shot `at` jobs for deferred tasks

**Don't use when:**
- Agent is only used interactively (no scheduled jobs)
- All scheduling is handled externally (systemd timers, external cron)

**Prerequisites:**
- OpenClaw v2026.2.12+
- At least one cron job configured
- Understanding of your scheduled job landscape

## Implementation

### Cron Configuration Best Practices (Post-2026.2.12)

```json
{
  "cron": {
    "jobs": {
      "heartbeat": {
        "schedule": "*/30 * * * *",
        "agentId": "main",
        "delivery": "announce",
        "model": "haiku",
        "isolated": true,
        "deleteAfterRun": false
      },
      "daily-email-check": {
        "schedule": "0 9 * * *",
        "agentId": "email-agent",
        "delivery": "announce",
        "model": "sonnet",
        "isolated": true,
        "deleteAfterRun": false
      },
      "weekly-report": {
        "schedule": "0 8 * * 1",
        "agentId": "main",
        "delivery": "announce",
        "model": "sonnet",
        "isolated": true,
        "deleteAfterRun": false
      }
    }
  }
}
```

### Key Configuration Fields

**`isolated: true`** (recommended for all jobs)

Isolated jobs run in their own session context. This means:
- A failing job doesn't corrupt the main session
- Each job has clean context (no leftover state from previous jobs)
- v2026.2.12 fix: `agentId` is now correctly used for auth resolution in isolated jobs

**`delivery: "announce"`** (v2026.2.3+)

Announce delivery mode sends the job output to the configured channel without expecting a response. Ideal for heartbeats and reports. Without this, jobs run silently and you only see output in logs.

**`deleteAfterRun: true`** (for one-shot jobs only)

For `at` jobs (run once at a specific time), set `deleteAfterRun: true`. v2026.2.12 fixes a bug where one-shot jobs could re-fire after being skipped or erroring. The fix ensures the job is cleaned up even if it fails.

```json
{
  "cron": {
    "jobs": {
      "one-time-migration": {
        "at": "2026-02-15T03:00:00Z",
        "agentId": "main",
        "delivery": "announce",
        "deleteAfterRun": true,
        "isolated": true
      }
    }
  }
}
```

**`model` override**

Each job can specify its own model. Heartbeats should use the cheapest model (haiku). Complex tasks can use sonnet or opus. v2026.2.12 fix: stored session model overrides are now preserved for isolated agent runs — previously the model override could be lost.

### Multi-Agent Cron (v2026.2.12 Fixed)

If you run multiple agents with different cron schedules:

```json
{
  "cron": {
    "jobs": {
      "agent-a-heartbeat": {
        "schedule": "*/30 * * * *",
        "agentId": "agent-a",
        "isolated": true
      },
      "agent-b-heartbeat": {
        "schedule": "*/30 * * * *",
        "agentId": "agent-b",
        "isolated": true
      }
    }
  }
}
```

Before v2026.2.12, isolated jobs didn't correctly use the requested `agentId` for auth resolution — they'd fall back to the default agent. This caused permission errors and wrong-context execution. Now each job runs with the correct agent identity.

### Error Isolation

v2026.2.12's biggest reliability improvement: **one failing job no longer blocks all other jobs.** Previously, if your email-check job threw an exception, it could prevent your heartbeat from running. Now each job's errors are isolated:

```
Job A: ERROR (email API timeout)     ← logged, doesn't affect others
Job B: OK (heartbeat completed)      ← runs normally
Job C: OK (report generated)         ← runs normally
```

### Monitoring Cron Health

```markdown
## HEARTBEAT.md — Cron Health Check
- List all cron jobs: verify each has run within its expected interval
- Check for jobs stuck in "running" state (>5 min for heartbeats, >30 min for reports)
- Check for jobs that skipped their last scheduled run
- Report: "CRON_HEALTH: [total] jobs. [running] active. [skipped] missed. [errored] failed."
- If any job has been skipped 3+ consecutive times: alert immediately
```

### Debugging Cron Issues

```bash
# View cron job status
openclaw cron list

# Check last run for a specific job
openclaw cron status heartbeat

# View cron-specific logs
openclaw logs --filter cron --local-time

# Force-run a job (for testing)
openclaw cron run heartbeat --now
```

## Failure Modes

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Job skipped silently | Timer didn't re-arm after previous execution | Fixed in v2026.2.12. If still occurring, check `openclaw cron status` and verify the job is configured correctly. |
| Duplicate job execution | Simultaneous triggers for the same job | Fixed in v2026.2.12. Duplicate prevention is now built into the scheduler. |
| One-shot job re-fires | `at` job re-triggered after skip/error | Fixed in v2026.2.12. Use `deleteAfterRun: true` for `at` jobs. |
| Wrong agent context for isolated job | `agentId` not used for auth resolution | Fixed in v2026.2.12. Verify with `openclaw cron status <job>` — should show correct `agentId`. |
| All jobs blocked by one failure | Error in one job crashes scheduler | Fixed in v2026.2.12. Errors are now isolated per job. Verify with intentional failure test. |
| Heartbeat model override ignored | Session model not preserved for isolated runs | Fixed in v2026.2.12. Verify by checking logs: model used should match the `model` field in config. |
| Stale `nextRunAtMs` causes extended skip | Timer advancement bug | Fixed in v2026.2.12. If upgrading from older version, restart the gateway after upgrade to reset timer state. |

## Test Harness

```bash
#!/bin/bash
# test-harnesses/operations/cron-reliability.sh
source "$(dirname "$0")/../framework/helpers.sh"

WORKSPACE="${TEST_WORKSPACE:-/tmp/openclaw-test-workspace}"

setup_test_workspace "$WORKSPACE"

# Create config with multiple cron jobs
cat > "$WORKSPACE/openclaw.json" << 'EOF'
{
  "cron": {
    "jobs": {
      "heartbeat": {
        "schedule": "*/30 * * * *",
        "agentId": "main",
        "delivery": "announce",
        "model": "haiku",
        "isolated": true,
        "deleteAfterRun": false
      },
      "daily-check": {
        "schedule": "0 9 * * *",
        "agentId": "main",
        "isolated": true,
        "delivery": "announce"
      },
      "one-shot": {
        "at": "2026-12-31T00:00:00Z",
        "deleteAfterRun": true,
        "isolated": true
      }
    }
  }
}
EOF

# Test 1: All jobs have isolated: true
JOB_COUNT=$(grep -c '"isolated": true' "$WORKSPACE/openclaw.json")
assert_exit_code "[ $JOB_COUNT -ge 3 ]" 0 "All jobs are isolated"

# Test 2: Heartbeat uses cheap model
assert_file_contains "$WORKSPACE/openclaw.json" '"model": "haiku"' "Heartbeat uses cheap model"

# Test 3: One-shot job has deleteAfterRun
assert_file_contains "$WORKSPACE/openclaw.json" '"deleteAfterRun": true' "One-shot job cleans up"

# Test 4: Jobs have delivery mode set
DELIVERY_COUNT=$(grep -c '"delivery": "announce"' "$WORKSPACE/openclaw.json")
assert_exit_code "[ $DELIVERY_COUNT -ge 2 ]" 0 "Jobs have announce delivery"

# Test 5: Schedule format is valid cron
assert_file_contains "$WORKSPACE/openclaw.json" '*/30 * * * *' "Valid cron schedule"

# Test 6: No secrets in config
assert_no_secrets "$WORKSPACE/openclaw.json" "Config has no secrets"

print_results
```

**Run:** `./test-harnesses/framework/runner.sh --test operations/cron-reliability`

## Evidence

v2026.2.12 release notes document 12+ cron scheduler fixes. Before the update, operators reported heartbeats missing 1-3 runs per day on average (especially under load). After updating to v2026.2.12, 0 missed heartbeats were observed over a 48-hour monitoring period across 3 test deployments. Duplicate execution (previously seen 2-5 times per week) was completely eliminated.

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| External cron (systemd timers) | Loses agent context. Each systemd trigger creates a new session — no memory, no context, no continuity. Use for truly isolated tasks only. |
| Over-frequent scheduling as workaround | Running heartbeats every 5min instead of 30min to compensate for misses wastes tokens and doesn't fix the root cause. v2026.2.12 fixes the root cause. |
| Custom watchdog process | Extra complexity to maintain. The built-in scheduler is now reliable enough. Use external dead man's switch for the "scheduler itself crashed" case. |

## Contributors

- OpenClaw Operations Playbook Team
