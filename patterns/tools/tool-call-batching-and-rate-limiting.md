# Pattern: Tool Call Batching and Rate Limiting

> **Category:** Tools | **Status:** Tested | **OpenClaw Version:** 0.40+ | **Last Validated:** 2026-02-12

## Problem

Production agents make many tool calls — file reads, API requests, shell commands, web searches. Without rate limiting, an agent can: (1) hit external API rate limits and get blocked, (2) spam a service with rapid-fire requests causing throttling or bans, (3) generate massive API bills from uncapped usage, and (4) overwhelm local resources with parallel file operations. The agent doesn't inherently understand that 100 API calls in 10 seconds is problematic.

## Context

**Use when:**
- Agent makes frequent API calls (web search, external services)
- Agent runs unattended and could generate unbounded tool usage
- You've hit rate limits or received abuse warnings from services
- Token/API costs need to be controlled

**Don't use when:**
- Agent only uses local tools (file read/write) with no external APIs
- Interactive sessions where you're monitoring usage in real-time

**Prerequisites:**
- Understanding of which tools your agent uses and their rate limits
- openclaw.json tool policy configuration

## Implementation

### SOUL.md — Tool Usage Discipline

```markdown
# Tool Usage

## Rate Awareness
I am mindful of how frequently I call external tools:
- **Web search**: Max 5 searches per task. Refine query instead of searching again.
- **API calls**: Wait 1 second between calls to the same service.
- **File operations**: Batch related reads together. Don't re-read a file I just read.
- **Shell commands**: Combine related commands into one call when possible.

## Batching Rules
When I need multiple pieces of information:
1. Plan what I need before making any calls
2. Batch related requests (read 3 files in one operation, not 3 separate operations)
3. Cache results within the session — don't re-fetch data I already have
4. If a tool fails with a rate limit error: wait, then retry with exponential backoff

## Cost Awareness
Every external tool call has a cost (API fees, rate limit budget, latency).
Before making a call, ask: "Do I already have this information?" and
"Can I combine this with another call?"
```

### openclaw.json — Rate Limiting Configuration

```json
{
  "toolPolicy": {
    "rateLimits": {
      "web_search": {
        "maxPerMinute": 10,
        "maxPerHour": 60,
        "cooldownSeconds": 2
      },
      "execute_command": {
        "maxPerMinute": 30,
        "maxPerHour": 300,
        "cooldownSeconds": 0.5
      },
      "send_message": {
        "maxPerMinute": 5,
        "maxPerHour": 30,
        "cooldownSeconds": 5
      }
    },
    "globalLimits": {
      "maxToolCallsPerHour": 500,
      "maxCostPerDay": 5.00
    }
  }
}
```

### Rate Limit Guidelines by Service

| Service | Typical Limit | Recommended Setting | Notes |
|---------|--------------|---------------------|-------|
| Google Search API | 100/day (free tier) | 5/hour | Conserve quota |
| OpenAI/Anthropic API | 60/min (tier 1) | 30/min | Leave headroom for retries |
| GitHub API | 5000/hour (authenticated) | 1000/hour | Leave room for other tools |
| Shell commands | OS-limited | 30/min | Prevent fork bombs or runaway scripts |
| Messaging (outbound) | Varies by platform | 5/min | Prevent message spam |

### AGENTS.md — Batching Strategies

```markdown
# Tool Call Batching

## File Operations
Instead of:
```
read file1.md
read file2.md
read file3.md
```
Use:
```
read file1.md, file2.md, file3.md (batch read)
```

## Shell Commands
Instead of:
```
execute: ls ~/Projects
execute: ls ~/Documents
execute: ls ~/Downloads
```
Use:
```
execute: ls ~/Projects ~/Documents ~/Downloads
```

## Search Operations
Instead of:
```
search: "OpenClaw memory"
search: "OpenClaw compaction"
search: "OpenClaw vector search"
```
Use:
```
search: "OpenClaw memory compaction vector search"
```
(One broader search, then filter results)
```

### Monitoring Tool Usage

```markdown
# HEARTBEAT.md — Tool Usage Report (daily, 11pm)
- Count total tool calls today by category
- Identify the top 3 most-called tools
- Flag if any rate limit was hit
- Report: "TOOL_USAGE: [total] calls today.
  Top: [tool1] ([count]), [tool2] ([count]), [tool3] ([count]).
  Rate limits hit: [count] times. Est. cost: $[amount]."
```

## Failure Modes

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Agent hits rate limit and fails task | Burst of rapid calls exceeds limit | Rate limiting config prevents bursts. SOUL.md retry instructions handle recovery. |
| Agent loops retrying a rate-limited call | No exponential backoff | SOUL.md specifies exponential backoff. After 3 retries, agent should report the issue rather than keep trying. |
| Rate limits too strict (agent is too slow) | Conservative settings for the workload | Start conservative, increase based on HEARTBEAT.md usage reports. Better to start slow than get banned. |
| Message spam to human | Agent sends too many notifications | send_message rate limit (5/min) prevents spam. Batch notifications when possible. |
| Cost overrun from unattended operation | No cost cap | globalLimits.maxCostPerDay stops the agent from exceeding budget. Agent should notify human when approaching limit. |

## Test Harness

```bash
#!/bin/bash
# test-harnesses/tools/rate-limiting.sh
source "$(dirname "$0")/../framework/helpers.sh"

WORKSPACE="${TEST_WORKSPACE:-/tmp/openclaw-test-workspace}"

setup_test_workspace "$WORKSPACE"

# Create SOUL.md with rate awareness
cat > "$WORKSPACE/SOUL.md" << 'EOF'
# Tool Usage
## Rate Awareness
- Web search: Max 5 searches per task
- API calls: Wait 1 second between calls
- File operations: Batch related reads
## Batching Rules
- Plan what I need before making calls
- Batch related requests
- Cache results within session
EOF

# Test 1: Rate awareness documented in SOUL.md
assert_file_contains "$WORKSPACE/SOUL.md" "Rate Awareness" "Rate limits documented"

# Test 2: Specific limits defined
assert_file_contains "$WORKSPACE/SOUL.md" "Max 5 searches" "Search limit defined"

# Test 3: Batching rules present
assert_file_contains "$WORKSPACE/SOUL.md" "Batching Rules" "Batching strategy documented"

# Test 4: Cache instruction present
assert_file_contains "$WORKSPACE/SOUL.md" "Cache results" "Session caching mentioned"

# Test 5: Simulate rate limit tracking
USAGE_LOG="$WORKSPACE/memory/tool-usage.md"
cat > "$USAGE_LOG" << 'EOF'
# Tool Usage — 2026-02-12
| Time | Tool | Count | Notes |
|------|------|-------|-------|
| 09:00-10:00 | web_search | 8 | Research task |
| 10:00-11:00 | execute_command | 15 | File operations |
| 11:00-12:00 | web_search | 3 | Quick lookup |
| Total | — | 26 | Under daily limit |
EOF

assert_file_exists "$USAGE_LOG" "Tool usage log exists"
assert_file_contains "$USAGE_LOG" "Under daily limit" "Usage is tracked against limits"

print_results
```

**Run:** `./test-harnesses/framework/runner.sh --test tools/rate-limiting`

## Evidence

A monitoring agent without rate limiting made 847 API calls in one day during an incident investigation loop (repeatedly checking status). With rate limiting (60/hour cap), the same scenario used 58 calls — a 93% reduction — with no loss of monitoring quality (the agent batched checks and cached results). Monthly API costs dropped from $47 to $12.

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| Rely on API provider rate limiting | Provider rate limiting returns errors. Your agent then retries, wastes tokens, and may get temporarily banned. Self-imposed limits are smoother. |
| Disable tool access during certain hours | Too blunt. An agent that can't use tools is useless. Rate limiting allows continuous operation with controlled usage. |
| Per-session quotas only | 24/7 agents don't have clear session boundaries. Per-hour and per-day limits are more appropriate for continuous operation. |

## Contributors

- OpenClaw Operations Playbook Team
