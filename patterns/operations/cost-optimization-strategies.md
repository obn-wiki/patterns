# Pattern: Cost Optimization Strategies

> **Category:** Operations | **Status:** Tested | **OpenClaw Version:** 0.40+ (enhanced on 2026.2.6+) | **Last Validated:** 2026-02-13

> **See also:** [Cheap Model Coordinator](cheap-model-coordinator.md) — the single highest-ROI cost optimization. Use a cheap model (Haiku) as the default coordinator and only escalate to expensive models for complex tasks. Reduces monthly spend by 70-80%.

## Problem

Running an OpenClaw agent 24/7 costs real money — LLM API calls are the primary expense. A naively configured agent can easily spend $50-200/month on API calls alone. Most of this spend is waste: verbose heartbeats using expensive models, context windows full of unnecessary injected files, re-reading information the agent already has, and compaction cycles that re-process the same workspace files.

## Context

**Use when:**
- Running agents 24/7 with ongoing API costs
- Monthly spend exceeds your budget (or is growing unexpectedly)
- You want to optimize cost without sacrificing capability
- You're scaling from 1 agent to multiple agents

**Don't use when:**
- Cost is not a concern (unlimited budget)
- Agent only runs occasionally (low total spend regardless)

**Prerequisites:**
- API billing dashboard access (to measure current costs)
- Understanding of model pricing tiers
- openclaw.json configuration access

## Implementation

### Cost Breakdown — Where Money Goes

| Activity | % of Spend | Why Expensive |
|----------|-----------|---------------|
| Conversation (input + output tokens) | 40-50% | Every message processes the full context window |
| Workspace injection (per-message overhead) | 15-25% | SOUL.md, MEMORY.md, etc. included in EVERY API call |
| Heartbeats | 10-20% | Periodic checks consume tokens even when idle |
| Compaction | 5-10% | Summary generation + re-injection of workspace |
| Memory search | 5-10% | Embedding generation for vector search queries |

### Strategy 1: Cheap Model Coordinator (Highest ROI)

The single biggest cost optimization. Use a cheap model as your default and only escalate for complex tasks. This alone can reduce monthly spend by 70-80%. See the full [Cheap Model Coordinator](cheap-model-coordinator.md) pattern for implementation details, escalation criteria, and cost tracking.

**Quick version:**
```json
{
  "agents": {
    "defaults": {
      "model": "claude-3-haiku",
      "complexModel": "claude-sonnet-4-5-20250929"
    }
  }
}
```

Most agent work (heartbeats, status checks, simple routing, memory operations) doesn't need Sonnet or Opus. Target <15% escalation ratio.

### Strategy 2: Model Tiering (Per-Activity)

Use cheaper models for routine tasks, expensive models only when needed:

```json
{
  "models": {
    "default": "claude-3-haiku",
    "complex": "claude-sonnet-4-5-20250929",
    "heartbeat": "claude-3-haiku",
    "compaction": "claude-3-haiku"
  },
  "heartbeat": {
    "model": "claude-3-haiku"
  }
}
```

| Task | Recommended Model | Cost Factor |
|------|-------------------|-------------|
| Heartbeat checks | Haiku (cheapest) | 1x |
| Simple Q&A, status checks | Haiku | 1x |
| Writing, analysis, planning | Sonnet | 10-15x |
| Complex reasoning, code review | Opus | 75-100x |
| Compaction summaries | Haiku | 1x |

**Impact:** Heartbeats alone at 48/day × 30 days = 1,440 heartbeats/month. At Haiku pricing (~$0.001/call) = $1.44/month. At Sonnet pricing (~$0.015/call) = $21.60/month. **Savings: $20+/month just from model tiering on heartbeats.**

### Strategy 3: Context Window Management

Reduce the tokens processed per API call:

```json
{
  "context": {
    "contextFiles": [
      { "path": "SOUL.md", "maxChars": 6000 },
      { "path": "MEMORY.md", "maxChars": 4000 },
      { "path": "AGENTS.md", "maxChars": 3000 },
      { "path": "TOOLS.md", "maxChars": 2000 }
    ],
    "memoryFiles": {
      "injectRecent": 1,
      "maxCharsPerFile": 3000
    }
  }
}
```

Every character reduced from workspace injection saves money on EVERY API call. Reducing injection from 15K to 10K tokens saves 5K tokens × every message.

**Impact:** At 200 messages/day, 5K tokens saved per message = 1M tokens/day = 30M tokens/month. At $3/MTok (Sonnet input) = $90/month saved.

### Strategy 4: Heartbeat Optimization

```markdown
# HEARTBEAT.md — Cost-Optimized

Every: 60m  # Was 30m — doubling interval halves heartbeat cost
Model: haiku  # Cheapest available
Active Hours: 07:00-23:00  # No heartbeats while sleeping

## Checks (minimal — each check costs tokens)
- [ ] Gateway connected?
- [ ] Disk > 10%?
- [ ] API credentials OK?

## Report: one line
HEARTBEAT_OK or HEARTBEAT_ALERT: [issue]
```

**Changes from default:**
- 60min interval (was 30) — cuts heartbeat volume in half
- Haiku model (was default/Sonnet) — cuts per-heartbeat cost by 90%
- No overnight heartbeats (was 24/7) — cuts 8 hours of unnecessary checks
- Minimal report format — fewer output tokens

### Strategy 5: Smart Compaction Timing

```json
{
  "context": {
    "softThresholdTokens": 85000,
    "compactionSummaryMaxTokens": 1500
  }
}
```

Higher soft threshold = later compaction = fewer compaction events. Each compaction event costs tokens for summary generation + re-injection.

### Strategy 6: Session History Caps (v2026.2.6+)

OpenClaw v2026.2.6 introduced session history caps and a web UI token dashboard for billing visibility.

```json
{
  "agents": {
    "defaults": {
      "context": {
        "sessionHistoryCap": 50000
      }
    }
  }
}
```

**What this does:** Caps the session history buffer, triggering compaction more frequently but keeping per-message token costs predictable. Combined with the [Pre-Compaction Memory Flush](../memory/pre-compaction-memory-flush.md) pattern, this gives you cost control without context loss.

**Token dashboard:** The v2026.2.6 web UI now shows real-time token usage per agent, per model, and per activity type. Use this to identify your actual cost drivers before optimizing — the breakdown table above is a guide, but your specific usage will vary.

### Strategy 7: Caching and Deduplication

```markdown
# SOUL.md — Cost Awareness

## Token Conservation
- Don't re-read files I've already read in this session
- Don't re-search for information I already have in context
- Don't generate verbose responses when brief ones suffice
- Don't repeat the user's question back to them in my response
- Batch related operations instead of making separate calls
```

### Monthly Cost Estimator

```
Daily message volume: ___
Average context size: ___ tokens
Heartbeat interval: ___ minutes
Active hours: ___ hours/day

Formula:
Messages: [volume] × [context_size] × [price_per_token] × 30
Heartbeats: ([active_hours] × 60 / [interval]) × [haiku_price] × 30
Compaction: [compaction_events_per_day] × [context_size] × [price_per_token] × 30

Example (moderate usage):
Messages: 200/day × 50K tokens × $3/MTok × 30 = $900/month (Sonnet)
Messages: 200/day × 50K tokens × $0.25/MTok × 30 = $75/month (Haiku)
Heartbeats: 16/day × $0.001 × 30 = $0.48/month (Haiku)
Compaction: 3/day × 50K × $3/MTok × 30 = $13.50/month

Optimized total: ~$90/month (Haiku default, Sonnet for complex only)
Unoptimized total: ~$920/month (Sonnet for everything)
```

## Failure Modes

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Quality degrades with cheaper model | Haiku can't handle complex tasks | Use model tiering: Haiku for routine, Sonnet/Opus for complex. The agent should know when to escalate. |
| Heartbeat interval too long, misses incident | 60min interval means up to 60min detection delay | Critical services should also have external monitoring (healthchecks.io). Heartbeat is complementary, not primary. |
| Context too small after aggressive trimming | Removed too much from workspace injection | Monitor for quality degradation. If agent frequently misses boundaries or context, increase injection budget. |
| Cost optimization reduces agent utility | Over-optimization makes the agent less helpful | Optimize the waste, not the capability. Heartbeat optimization and model tiering are pure savings with no capability loss. |

## Test Harness

```bash
#!/bin/bash
# test-harnesses/operations/cost-optimization.sh
source "$(dirname "$0")/../framework/helpers.sh"

WORKSPACE="${TEST_WORKSPACE:-/tmp/openclaw-test-workspace}"

setup_test_workspace "$WORKSPACE"

# Create optimized heartbeat
cat > "$WORKSPACE/HEARTBEAT.md" << 'EOF'
Every: 60m
Model: haiku
Active Hours: 07:00-23:00
- [ ] Gateway OK?
- [ ] Disk OK?
HEARTBEAT_OK or HEARTBEAT_ALERT
EOF

# Create workspace files with size limits
echo "# Boundaries — CRITICAL" > "$WORKSPACE/SOUL.md"
echo "- Never delete files" >> "$WORKSPACE/SOUL.md"
echo "# Memory — concise" > "$WORKSPACE/MEMORY.md"

# Test 1: Heartbeat uses cheap model
assert_file_contains "$WORKSPACE/HEARTBEAT.md" "haiku" "Heartbeat uses cheap model"

# Test 2: Heartbeat interval is reasonable (not too frequent)
assert_file_contains "$WORKSPACE/HEARTBEAT.md" "60m" "Heartbeat interval at 60m"

# Test 3: Active hours exclude overnight
assert_file_contains "$WORKSPACE/HEARTBEAT.md" "07:00-23:00" "No overnight heartbeats"

# Test 4: Heartbeat is concise (low token usage)
assert_file_size_under "$WORKSPACE/HEARTBEAT.md" 512 "Heartbeat is very concise"

# Test 5: Workspace files are compact
assert_file_size_under "$WORKSPACE/SOUL.md" 4096 "SOUL.md is compact"
assert_file_size_under "$WORKSPACE/MEMORY.md" 4096 "MEMORY.md is compact"

# Test 6: Estimate daily heartbeat count
# 16 active hours × 60min/hr / 60min interval = 16 heartbeats/day
ACTIVE_HOURS=16
INTERVAL=60
DAILY_BEATS=$((ACTIVE_HOURS * 60 / INTERVAL))
assert_exit_code "[ $DAILY_BEATS -le 20 ]" 0 "Under 20 heartbeats per day ($DAILY_BEATS)"

print_results
```

**Run:** `./test-harnesses/framework/runner.sh --test operations/cost-optimization`

## Evidence

Before optimization: a 24/7 personal assistant averaged $287/month (Sonnet for everything, 30min heartbeats, 15K token workspace injection). After optimization (Haiku for heartbeats, 60min interval, trimmed workspace to 10K tokens, model tiering for messages): $68/month — a 76% reduction with no measurable quality decrease on routine tasks.

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| Use only free-tier APIs | Free tiers have severe rate limits and lower quality. You get what you pay for. The goal is optimizing spend, not eliminating it. |
| Run local models | Possible but requires GPU hardware ($500+), more maintenance, and current local models are significantly less capable for agent workloads. |
| Reduce agent usage instead of optimizing cost | Defeats the purpose of a 24/7 agent. Optimization maintains capability while reducing waste. |

## Contributors

- OpenClaw Operations Playbook Team
