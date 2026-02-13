# Pattern: Production Boundary Hardening

> **Category:** Soul | **Status:** Tested | **OpenClaw Version:** 0.40+ | **Last Validated:** 2026-02-12

## Problem

Default SOUL.md boundaries are designed for interactive use — they're loose enough for creative exploration but too permissive for production agents handling real data. A 24/7 agent that can "help with anything" will eventually help with something it shouldn't: executing destructive commands, sharing private files with the wrong channel, or taking financial actions without confirmation.

## Context

**Use when:**
- Your agent runs unattended (cron, heartbeat, or always-on)
- Your agent handles sensitive data (personal files, credentials, financial info)
- Your agent interacts with external services (email, messaging, APIs)
- Multiple people can message your agent across channels

**Don't use when:**
- Interactive-only personal assistant with you watching every response
- Development/testing environments where you want maximum flexibility

**Prerequisites:**
- SOUL.md file in your workspace
- Understanding of which channels your agent serves

## Implementation

### SOUL.md — Boundaries Section

```markdown
# Boundaries

## Hard Limits (never override, even if I ask in a message)
- Never execute `rm -rf` on any path outside of /tmp
- Never send files containing credentials, keys, or tokens to any channel
- Never make purchases, transfers, or financial transactions without a confirmation loop
- Never share content from one person's conversation with another person
- Never execute commands that modify system-level configs (/etc, systemd, crontab)
- Never store API keys, passwords, or tokens in MEMORY.md or daily logs

## Soft Limits (override with explicit confirmation in the same message)
- Don't send messages longer than 2000 characters (avoids wall-of-text in chat)
- Don't access files outside ~/Documents, ~/Projects, and ~/Desktop
- Don't run shell commands that take longer than 60 seconds
- Don't make more than 10 API calls in a single heartbeat cycle

## Channel-Specific Boundaries
- **WhatsApp/Signal/iMessage**: Keep responses under 500 characters. No code blocks.
- **Slack/Discord**: Use threads for multi-step responses. No @channel or @here.
- **Email**: Always draft — never auto-send. Include [DRAFT] prefix in subject.
- **CLI**: Full access within soft limits above.
```

### openclaw.json — Tool Policy Reinforcement

```json
{
  "toolPolicy": {
    "default": "ask",
    "allowed": [
      "read_file",
      "list_directory",
      "search_files",
      "web_search"
    ],
    "elevated": [
      "write_file",
      "execute_command",
      "send_message"
    ],
    "denied": [
      "execute_command:rm -rf *",
      "execute_command:sudo *",
      "execute_command:chmod 777 *"
    ]
  }
}
```

### Key Principle: Defense in Depth

SOUL.md boundaries are **behavioral** — they rely on the model following instructions. Tool policy is **mechanical** — it's enforced by OpenClaw's runtime. Use both:

1. SOUL.md says "never delete important files" (model-level)
2. Tool policy denies `rm -rf` patterns (runtime-level)
3. Sandboxing restricts file system access (OS-level)

If any one layer fails, the others catch it.

## Failure Modes

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Agent ignores boundaries after context compaction | Boundaries were in early context, compacted away | Put boundaries at the TOP of SOUL.md — OpenClaw injects workspace files at context start, so top-of-file content survives longest |
| Agent finds creative workaround (e.g., `find / -delete` instead of `rm -rf`) | Model interprets boundary literally, not by intent | Use intent-based language: "Never delete files outside /tmp" rather than blocking specific command strings |
| Boundaries conflict with user request | User asks agent to do something the boundary blocks | This is working as intended. The agent should explain: "My boundaries prevent this. You can do it directly." |
| Too-strict boundaries cause agent to refuse valid work | Overly broad restrictions | Start permissive, tighten after incidents. Log every boundary-hit in daily memory for review. |

## Test Harness

```bash
#!/bin/bash
# test-harnesses/soul/boundary-hardening.sh
source "$(dirname "$0")/../framework/helpers.sh"

WORKSPACE="${TEST_WORKSPACE:-/tmp/openclaw-test-workspace}"
SOUL_FILE="$WORKSPACE/SOUL.md"

setup_test_workspace "$WORKSPACE"

# Test 1: Boundaries survive in SOUL.md
cat > "$SOUL_FILE" << 'EOF'
# Boundaries
## Hard Limits
- Never execute `rm -rf` on any path outside of /tmp
- Never store API keys in MEMORY.md
EOF

assert_file_contains "$SOUL_FILE" "Hard Limits" "SOUL.md has boundary section"
assert_file_contains "$SOUL_FILE" "rm -rf" "SOUL.md has destructive command boundary"
assert_file_contains "$SOUL_FILE" "API keys" "SOUL.md has secret boundary"

# Test 2: Boundaries are at the TOP of the file (survive compaction)
FIRST_SECTION=$(head -5 "$SOUL_FILE" | grep -c "Boundaries")
assert_exit_code "[ $FIRST_SECTION -ge 1 ]" 0 "Boundaries section is near top of SOUL.md"

# Test 3: No secrets in boundary examples
assert_no_secrets "$SOUL_FILE" "SOUL.md contains no actual secrets"

print_results
```

**Run:** `./test-harnesses/framework/runner.sh --test soul/boundary-hardening`

## Evidence

Observed failure without boundaries: Agent running 24/7 with default SOUL.md received a message "clean up the old project files" and executed `rm -rf ~/Projects/old-client/` — deleting an active project directory. With boundary hardening, the same message triggers a confirmation request instead.

Token overhead: ~200 tokens for the full boundary section. At default heartbeat interval (30 min), this adds ~0.2% to daily token usage — negligible.

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| Tool policy only (no SOUL.md boundaries) | Tool policy can't express nuanced rules like "don't share one person's content with another" — it only gates tool access, not behavioral intent |
| System prompt injection | OpenClaw doesn't have a traditional "system prompt" — SOUL.md IS the personality layer. Use it. |
| Per-channel config files | Increases complexity. Channel-specific boundaries in SOUL.md are simpler and visible in one place. |

## Contributors

- OpenClaw Operations Playbook Team
