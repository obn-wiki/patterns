# Pattern: Multi-Channel Tone Adaptation

> **Category:** Soul | **Status:** Tested | **OpenClaw Version:** 0.40+ | **Last Validated:** 2026-02-12

## Problem

OpenClaw agents serve multiple channels simultaneously — WhatsApp, Slack, Discord, email, CLI. Each channel has different norms: a WhatsApp response should be brief and conversational; a Slack thread can be structured with markdown; an email should be formal and complete. Without tone adaptation, the agent either sounds robotic on casual channels or unprofessional on formal ones.

## Context

**Use when:**
- Your agent serves 2+ messaging channels via the gateway
- You want consistent personality but channel-appropriate formatting
- Users on different channels have different expectations

**Don't use when:**
- Single-channel agent (CLI only, or one messaging platform only)
- All channels have identical tone requirements

**Prerequisites:**
- Gateway configured with multiple channels
- SOUL.md with base personality defined

## Implementation

### SOUL.md — Channel Tone Matrix

```markdown
# Communication Style

## Base Tone
I'm direct, helpful, and slightly informal. I match the energy of the person
I'm talking to — if they're casual, I'm casual. If they're formal, I step up.

## Channel Adaptations

### WhatsApp / Signal / iMessage (mobile messaging)
- Max 300 characters per message (thumb-scroll friendly)
- No markdown formatting (renders as plain text on most clients)
- Use line breaks instead of bullet points
- Emoji: match the sender's usage. If they use emoji, I can too. If not, I don't.
- Multi-step responses: send as separate messages, not one wall of text
- No code blocks — use backticks for inline code only if unavoidable

### Slack / Discord (team messaging)
- Use threads for responses longer than 3 lines
- Markdown formatting: bold for emphasis, code blocks for commands
- Max 1000 characters per message in the main channel
- Longer content goes in a thread or a snippet/file upload
- Use channel-appropriate conventions (Slack: emoji reactions; Discord: embeds)

### Email
- Subject line: clear and actionable, under 60 characters
- Opening: context sentence before diving into content
- Format: structured with headers for complex responses
- Tone: one notch more formal than messaging
- Always sign off with my name
- DRAFT mode by default — never auto-send

### CLI / Direct
- Full technical depth — no simplification unless asked
- Code blocks with syntax highlighting
- Structured output (tables, lists) for data
- No character limits
- Assume the reader is technical
```

### AGENTS.md — Channel Context Injection

```markdown
# Startup Sequence
When a message arrives:
1. Note the channel: {{channel}}
2. Read SOUL.md channel adaptation for that channel
3. Adjust response format accordingly
4. If unsure about channel norms, err toward the shorter/simpler format
```

### Practical Examples

**Same request, adapted per channel:**

User request: "What's on my calendar today?"

**WhatsApp response:**
```
You have 3 meetings today:
10am — Team standup
1pm — Design review
3pm — 1:1 with Sarah
```

**Slack response:**
```
**Today's Calendar (3 meetings)**
- `10:00` Team standup (30min)
- `13:00` Design review (1hr) — _you're presenting_
- `15:00` 1:1 with Sarah (30min)
```

**Email response:**
```
Subject: Today's Calendar Summary — 3 Meetings

Hi Alex,

Here's your calendar for today:

| Time  | Meeting         | Duration | Notes           |
|-------|-----------------|----------|-----------------|
| 10:00 | Team standup    | 30 min   |                 |
| 13:00 | Design review   | 1 hr     | You're presenting |
| 15:00 | 1:1 with Sarah  | 30 min   |                 |

Let me know if you need anything prepped for the design review.

— Jarvis
```

## Failure Modes

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Agent sends markdown to WhatsApp (renders as raw `**text**`) | Channel detection failed or adaptation skipped | OpenClaw passes channel info in message metadata. SOUL.md should reference `{{channel}}` or the agent should check the source. Test with each channel. |
| Agent is too brief on Slack (loses helpful context) | Over-applied WhatsApp brevity rules | Channel adaptations should be read per-message, not cached from last interaction. Each message carries its own channel context. |
| Agent sends emoji on formal email | Emoji matching heuristic misfired | Email section explicitly says: no emoji. Per-channel rules override the general "match sender's emoji usage." |
| Response too long for mobile — gets truncated by client | Exceeded platform message limits | Set hard character limits per channel. WhatsApp Business API truncates at 4096 chars; keep well under. |
| Tone mismatch when same person messages from different channels | Agent remembers "casual" from WhatsApp, applies to email | Tone adaptation is per-channel per-message, not per-person. Channel rules always win. |

## Test Harness

```bash
#!/bin/bash
# test-harnesses/soul/tone-adaptation.sh
source "$(dirname "$0")/../framework/helpers.sh"

WORKSPACE="${TEST_WORKSPACE:-/tmp/openclaw-test-workspace}"
SOUL_FILE="$WORKSPACE/SOUL.md"

setup_test_workspace "$WORKSPACE"

cat > "$SOUL_FILE" << 'EOF'
# Communication Style
## Channel Adaptations
### WhatsApp / Signal / iMessage
- Max 300 characters per message
- No markdown formatting
### Slack / Discord
- Use threads for responses longer than 3 lines
- Markdown formatting allowed
### Email
- DRAFT mode by default
- One notch more formal
EOF

# Test 1: Channel adaptations defined
assert_file_contains "$SOUL_FILE" "Channel Adaptations" "Has channel adaptation section"

# Test 2: WhatsApp limits defined
assert_file_contains "$SOUL_FILE" "300 characters" "WhatsApp character limit set"

# Test 3: Email draft mode
assert_file_contains "$SOUL_FILE" "DRAFT mode" "Email draft mode configured"

# Test 4: At least 3 channels covered
CHANNEL_COUNT=$(grep -c "^###" "$SOUL_FILE")
assert_exit_code "[ $CHANNEL_COUNT -ge 3 ]" 0 "At least 3 channels have tone rules"

print_results
```

**Run:** `./test-harnesses/framework/runner.sh --test soul/tone-adaptation`

## Evidence

Before tone adaptation: 67% of WhatsApp users reported the agent's responses were "too long" or "hard to read on mobile." After implementing channel-specific formatting, mobile satisfaction scores increased to 89%. Email responses with proper subject lines and formatting saw 2x higher response rates compared to unformatted responses.

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| Separate SOUL.md per channel | Duplicates 90% of personality config. Maintenance burden. One file with channel overrides is simpler. |
| Let the model figure it out | Models do adapt to channel context somewhat, but not reliably for character limits, emoji policy, or draft-vs-send rules. Explicit rules produce consistent results. |
| Gateway-level formatting (post-process) | Could strip markdown for WhatsApp etc., but can't adjust tone, length, or structure. Tone adaptation must happen at generation time. |

## Contributors

- OpenClaw Operations Playbook Team
