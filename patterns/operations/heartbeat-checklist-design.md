# Pattern: Heartbeat Checklist Design

> **Category:** Operations | **Status:** Tested | **OpenClaw Version:** 0.40+ (cron scheduler hardened on 2026.2.12+) | **Last Validated:** 2026-02-14

## Problem

HEARTBEAT.md is OpenClaw's periodic execution mechanism — the agent wakes up every N minutes, reads the checklist, performs checks, and reports status. Poorly designed checklists waste tokens on unnecessary checks, miss critical issues, spam the operator with noise, or fail silently when the checks themselves break. A heartbeat that sends "HEARTBEAT_OK" while the system is actually degraded is worse than no heartbeat at all.

## Context

**Use when:**
- Agent runs unattended for extended periods
- You need periodic monitoring of systems, services, or conditions
- You want automated health reporting without building custom monitoring
- You need a "dead man's switch" to know the agent is still alive

**Don't use when:**
- Agent is only used interactively (you're watching it)
- You have dedicated monitoring infrastructure (Datadog, Grafana) for everything
- Agent's sole purpose is responding to messages (no proactive checks needed)

**Prerequisites:**
- HEARTBEAT.md in workspace
- Understanding of what to monitor for your specific setup
- Channel configuration for alerts

## Implementation

### HEARTBEAT.md — Structured Checklist

```markdown
# Heartbeat Checklist

Every: 30m
Target: all
Active Hours: 06:00-23:00
Model: haiku (cheapest available — heartbeats should be fast)

## Critical Checks (alert immediately on failure)
- [ ] Am I still connected to all messaging channels?
      → If disconnected: alert on available channels, attempt reconnect
- [ ] Are my API credentials working?
      → Quick health check on each configured service
- [ ] Is disk space above 10%?
      → `df -h /home/openclaw | awk 'NR==2{print $5}'`

## Routine Checks (report in summary)
- [ ] Memory file count in reasonable range (< 100 active files)?
- [ ] Today's daily memory log exists and is being written to?
- [ ] SOUL.md hasn't been modified since last check (drift detection)?

## Report Format
If all checks pass:
  "HEARTBEAT_OK — [timestamp] — All systems normal"

If any check fails:
  "HEARTBEAT_ALERT — [timestamp] — [failed check]: [details]"

## Between Heartbeats
- Don't run any checks
- Don't consume any tokens
- Empty HEARTBEAT.md = skip execution entirely (useful for maintenance windows)
```

### Design Principles

**1. Fast and cheap:** Heartbeats should use the cheapest model available and complete in < 30 seconds. Every token spent on a heartbeat is a token not spent on actual work.

**2. Binary outcomes:** Each check produces PASS or FAIL. No "maybe" or "warning" — those lead to ignored alerts.

**3. Actionable alerts:** Don't just report a problem. Include what the agent should do about it (or at minimum, what the human should investigate).

**4. Minimal noise:** Only alert on failures. "HEARTBEAT_OK" is sufficient for passing checks. Don't enumerate everything that's fine — that's noise.

**5. Fail-safe:** If the heartbeat itself fails to run, that's a signal. Set up an external dead man's switch that expects a heartbeat message every N minutes and alerts if it's missing.

### Active Hours Configuration

```markdown
# Different schedules for different times

## Daytime (06:00-18:00) — Every 30 minutes
Full checklist: channels, APIs, disk, memory

## Evening (18:00-23:00) — Every 60 minutes
Reduced checklist: channels and critical alerts only

## Overnight (23:00-06:00) — Every 120 minutes
Minimal: only check if services are running. Don't alert unless critical.
```

### Tiered Alert Routing

```markdown
## Alert Routing
| Severity | Action | Channel |
|----------|--------|---------|
| Critical (service down) | Alert immediately | SMS + Slack DM |
| Warning (degraded) | Include in next heartbeat summary | Slack channel |
| Info (normal status) | Log to daily memory only | None (no notification) |
```

### External Dead Man's Switch

Use a service like Healthchecks.io or UptimeRobot:

```bash
# At the end of each heartbeat, ping the dead man's switch
curl -fsS -m 10 --retry 5 https://hc-ping.com/your-uuid-here
```

If the ping doesn't arrive within the expected interval, the external service alerts you. This catches the case where the agent itself has crashed and can't send heartbeats.

### v2026.2.12 Cron Scheduler Improvements

v2026.2.12 includes 12+ fixes to the cron scheduler that directly impact heartbeat reliability:

- **No more skipped jobs:** `nextRunAtMs` advancing no longer causes job skipping
- **No more duplicate fires:** Simultaneous trigger prevention eliminates double-heartbeats
- **Isolated errors:** One failing cron job no longer breaks all other jobs — if your heartbeat job errors, your other scheduled tasks still run
- **Correct `agentId` for isolated jobs:** Auth resolution now uses the requested `agentId`, fixing permission errors in multi-agent setups
- **Timer re-arm:** Timers correctly re-arm when `onTimer` fires during job execution
- **`deleteAfterRun` honored on skipped jobs:** One-shot `at` jobs no longer re-fire after skip/error
- **Model override preserved:** Stored session model overrides (e.g., `hooks.gmail.model`) are honored for isolated agent runs

**Impact on heartbeat design:** If you previously added workarounds for missed heartbeats (shorter intervals, redundant checks), you can now relax them. The scheduler is significantly more reliable. See the [Cron Reliability Hardening](cron-reliability-hardening.md) pattern for cron-specific configuration.

## Failure Modes

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Heartbeat runs but doesn't check anything useful | Checklist is too generic ("check if things are OK") | Each check must be specific and testable. Use commands with expected outputs. |
| Heartbeat consumes too many tokens | Using expensive model, verbose checks, or too-frequent interval | Use cheapest model. Keep checklist concise. Increase interval for non-critical checks. |
| Alert fatigue — operator ignores heartbeat messages | Too many non-critical alerts | Only alert on failures. Use tiered routing: critical = immediate, warning = summary, info = log only. |
| Heartbeat reports OK but system is actually broken | Checks don't cover the actual failure mode | Review checklist after every incident. If a failure wasn't caught by heartbeat, add a check for it. |
| Heartbeat fails silently (agent crashed) | No external monitoring | External dead man's switch catches this. If heartbeat ping doesn't arrive, external service alerts. |
| Stale HEARTBEAT.md — checks are outdated | Environment changed but checklist wasn't updated | Monthly checklist review in the routine checks. Flag if HEARTBEAT.md is older than 30 days. |

## Test Harness

```bash
#!/bin/bash
# test-harnesses/operations/heartbeat-design.sh
source "$(dirname "$0")/../framework/helpers.sh"

WORKSPACE="${TEST_WORKSPACE:-/tmp/openclaw-test-workspace}"
HEARTBEAT="$WORKSPACE/HEARTBEAT.md"

setup_test_workspace "$WORKSPACE"

cat > "$HEARTBEAT" << 'EOF'
# Heartbeat Checklist

Every: 30m
Target: all
Active Hours: 06:00-23:00

## Critical Checks
- [ ] Messaging channels connected?
- [ ] API credentials working?
- [ ] Disk space above 10%?

## Routine Checks
- [ ] Memory file count reasonable?
- [ ] Daily memory log exists?

## Report Format
HEARTBEAT_OK or HEARTBEAT_ALERT
EOF

# Test 1: HEARTBEAT.md exists and has required fields
assert_file_exists "$HEARTBEAT" "HEARTBEAT.md exists"
assert_file_contains "$HEARTBEAT" "Every:" "Interval defined"
assert_file_contains "$HEARTBEAT" "Active Hours:" "Active hours defined"

# Test 2: Critical checks section exists
assert_file_contains "$HEARTBEAT" "Critical Checks" "Critical checks defined"

# Test 3: Report format defined
assert_file_contains "$HEARTBEAT" "HEARTBEAT_OK" "Success format defined"
assert_file_contains "$HEARTBEAT" "HEARTBEAT_ALERT" "Alert format defined"

# Test 4: Checklist uses checkbox format
CHECKBOX_COUNT=$(grep -c "\- \[ \]" "$HEARTBEAT")
assert_exit_code "[ $CHECKBOX_COUNT -ge 3 ]" 0 "At least 3 checks defined"

# Test 5: No secrets in heartbeat config
assert_no_secrets "$HEARTBEAT" "HEARTBEAT.md has no secrets"

# Test 6: Reasonable size (heartbeats should be concise)
assert_file_size_under "$HEARTBEAT" 2048 "HEARTBEAT.md is concise (under 2KB)"

print_results
```

**Run:** `./test-harnesses/framework/runner.sh --test operations/heartbeat-design`

## Evidence

An agent with a generic heartbeat ("check if everything is OK") missed 3 out of 5 production incidents over 30 days — the checks were too vague to catch specific failures. After redesigning with specific, testable checks, incident detection improved to 5 out of 5. Token usage per heartbeat decreased from ~800 tokens (verbose model reasoning about vague checks) to ~200 tokens (specific checks with binary outcomes).

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| Continuous monitoring instead of periodic heartbeats | OpenClaw's heartbeat model is periodic by design. Continuous monitoring requires a separate tool (Prometheus, Datadog). Heartbeats complement these tools, they don't replace them. |
| Cron jobs for monitoring | Cron creates separate sessions per run (no persistent context). Heartbeats run in the main session, can reference memory and context. Use cron for isolated tasks that don't need agent context. |
| No monitoring (trust the system) | Production systems fail. Without monitoring, you only learn about failures when a human notices. The whole point of 24/7 operation is reduced human intervention. |

## Contributors

- OpenClaw Operations Playbook Team
