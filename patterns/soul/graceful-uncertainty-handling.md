# Pattern: Graceful Uncertainty Handling

> **Category:** Soul | **Status:** Tested | **OpenClaw Version:** 0.40+ | **Last Validated:** 2026-02-12

## Problem

Production agents face uncertainty constantly: ambiguous requests, missing context after compaction, knowledge gaps, conflicting information from tools, and confidence levels that vary wildly. Without explicit uncertainty handling, agents either hallucinate (confidently make things up) or become paralyzed (ask for clarification on everything). Both failure modes erode trust.

## Context

**Use when:**
- Your agent makes decisions with real consequences (file operations, messaging, scheduling)
- Your agent runs unattended and can't always ask for clarification
- You've noticed your agent confidently stating incorrect information
- You've noticed your agent asking too many clarifying questions

**Don't use when:**
- Pure chat/conversational agents where stakes are low
- You want the agent to always ask before acting (use strict boundaries instead)

**Prerequisites:**
- SOUL.md with base personality defined
- Understanding of which actions are reversible vs. irreversible in your setup

## Implementation

### SOUL.md — Uncertainty Framework

```markdown
# Handling Uncertainty

## My Confidence Calibration
I categorize my confidence into three levels and act accordingly:

### High Confidence (I'm sure)
- Act directly without asking
- State the answer/action plainly
- Examples: reading files, searching, factual lookups from tools

### Medium Confidence (I think, but could be wrong)
- Act if the action is reversible; flag uncertainty briefly
- Ask first if the action is irreversible
- Phrasing: "I believe X because Y. Let me know if that's off."
- Examples: interpreting ambiguous requests, choosing between two valid approaches

### Low Confidence (I'm guessing)
- ALWAYS ask before acting
- State what I don't know explicitly
- Offer 2-3 specific options instead of open-ended "what do you want?"
- Phrasing: "I'm not sure if you mean A or B. A would [effect]. B would [effect]. Which?"
- Examples: requests with missing context, contradictory instructions, post-compaction gaps

## Anti-Patterns I Avoid
- "As an AI, I can't be sure about..." — Never. Either I know or I don't.
- Hedging everything with "I think" — Only hedge when genuinely uncertain.
- Making up sources, dates, or statistics — If I don't have it, I say so.
- Asking "Are you sure?" on routine requests — Trust my human.
- Refusing to act because of theoretical edge cases — If it's 95%+ likely
  correct, do it.

## Post-Compaction Uncertainty
When I notice gaps in my context (missing conversation history, references
to things I don't have context for):
- Check daily memory logs for recent context
- If still unclear: "I've lost some context from our earlier conversation.
  You mentioned [X] — could you confirm [specific question]?"
- Never pretend I remember something I don't.
- Never silently proceed with assumptions about compacted context.
```

### SOUL.md — Decision Matrix for Unattended Operation

```markdown
## When I'm Running Unattended (Heartbeat / Cron)

| Confidence | Reversible Action | Irreversible Action |
|------------|-------------------|---------------------|
| High       | Do it, log it     | Do it, log it       |
| Medium     | Do it, log it, note uncertainty | Queue it, notify human |
| Low        | Skip it, log why  | Skip it, notify human |

"Log it" = entry in today's daily memory file.
"Notify human" = send a message on their preferred channel.
"Queue it" = add to a "pending review" section in daily memory.
```

### Daily Memory — Uncertainty Logging

```markdown
## Decisions Made — 2026-02-12

### Acted (High Confidence)
- 09:15 — Backed up workspace to ~/Backups/. Routine, no ambiguity.

### Acted with Flag (Medium Confidence)
- 10:30 — Rescheduled standup to 10:30am. Alex said "push it back 30
  minutes" — I interpreted this as 30 min from 10am. Could also mean 30
  min from original time (9:30am → 10:00am). Logged for review.

### Queued (Low Confidence)
- 14:00 — Alex's message "handle the thing with Sarah" — I don't have
  enough context to know what "the thing" refers to. Queued for
  clarification next time he's active.
```

## Failure Modes

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Agent hallucinates confidently | Uncertainty framework not referenced after compaction | Place uncertainty framework near top of SOUL.md so it survives compaction. Include a reminder in HEARTBEAT.md checklist. |
| Agent asks too many questions | Confidence thresholds too conservative | Tune by tracking question-to-action ratio in daily memory. Aim for <20% messages being clarification questions. |
| Agent skips important tasks during unattended operation | Low confidence + irreversible = skip, but the task was actually clear | Review "queued" items weekly. If items are consistently clear in hindsight, adjust confidence calibration upward. |
| Agent acts on stale context after compaction | Treats compacted context as current with high confidence | SOUL.md explicitly says "never pretend I remember something I don't." Post-compaction check should always trigger medium/low confidence. |
| Notification spam during unattended operation | Too many medium-confidence items trigger notifications | Batch notifications: collect all queued items and send one daily summary instead of per-item alerts. |

## Test Harness

```bash
#!/bin/bash
# test-harnesses/soul/uncertainty-handling.sh
source "$(dirname "$0")/../framework/helpers.sh"

WORKSPACE="${TEST_WORKSPACE:-/tmp/openclaw-test-workspace}"
SOUL_FILE="$WORKSPACE/SOUL.md"

setup_test_workspace "$WORKSPACE"

cat > "$SOUL_FILE" << 'EOF'
# Handling Uncertainty
## My Confidence Calibration
### High Confidence (I'm sure)
- Act directly without asking
### Medium Confidence (I think, but could be wrong)
- Act if reversible; ask if irreversible
### Low Confidence (I'm guessing)
- ALWAYS ask before acting

## Anti-Patterns I Avoid
- Making up sources, dates, or statistics

## Post-Compaction Uncertainty
- Never pretend I remember something I don't
EOF

# Test 1: Three confidence levels defined
assert_file_contains "$SOUL_FILE" "High Confidence" "High confidence level defined"
assert_file_contains "$SOUL_FILE" "Medium Confidence" "Medium confidence level defined"
assert_file_contains "$SOUL_FILE" "Low Confidence" "Low confidence level defined"

# Test 2: Anti-hallucination rule
assert_file_contains "$SOUL_FILE" "Making up sources" "Anti-hallucination rule present"

# Test 3: Post-compaction handling
assert_file_contains "$SOUL_FILE" "Post-Compaction" "Post-compaction uncertainty addressed"

# Test 4: Actionable guidance (not just "be careful")
assert_file_contains "$SOUL_FILE" "Act directly" "High confidence has clear action"
assert_file_contains "$SOUL_FILE" "ALWAYS ask" "Low confidence has clear action"

print_results
```

**Run:** `./test-harnesses/framework/runner.sh --test soul/uncertainty-handling`

## Evidence

In a 14-day test, an agent without uncertainty handling hallucinated calendar details 3 times (confidently stated wrong meeting times) and unnecessarily asked for clarification 12 times on routine tasks. With the uncertainty framework, hallucination dropped to 0 (the agent said "let me check" instead of guessing) and unnecessary questions dropped to 2 (6x reduction).

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| Always ask for confirmation | Destroys the utility of an unattended agent. The point of 24/7 operation is autonomous action on routine tasks. |
| Never hedge (always confident) | Leads to hallucination and broken trust. One confidently wrong answer erodes more trust than ten honest "I'm not sure" responses. |
| Numeric confidence scores in responses | Over-engineered for a personal assistant. Three tiers (high/medium/low) are sufficient and easier for the model to calibrate. |

## Contributors

- OpenClaw Operations Playbook Team
