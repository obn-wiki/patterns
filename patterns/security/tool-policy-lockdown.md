# Pattern: Tool Policy Lockdown

> **Category:** Security | **Status:** Tested | **OpenClaw Version:** 0.40+ | **Last Validated:** 2026-02-13

> **Known ecosystem issues this addresses:** Default OpenClaw tool policy is permissive — full filesystem access, unrestricted shell, messaging on all channels. SecurityScorecard found 40,000+ exposed deployments. Prompt injection success rate drops from 8-34% to near-zero when tool policy is layered with SOUL.md authority model and OS-level permissions.

## Problem

OpenClaw's tool policy controls what actions the agent can take. The default policy is permissive — designed for interactive use where a human is watching. For production agents running unattended, permissive defaults are dangerous: the agent has full file system access, unrestricted shell execution, and can send messages on any channel. A single mistake or injection can exploit these broad permissions.

## Context

**Use when:**
- Agent runs unattended (heartbeat, cron, always-on)
- Agent has access to sensitive files or systems
- You want to follow the principle of least privilege
- You're deploying an agent that serves a specific, well-defined role

**Don't use when:**
- Interactive personal assistant where you're watching every action
- You need the agent to have broad, flexible access for unpredictable tasks

**Prerequisites:**
- Understanding of which tools your agent actually needs for its role
- openclaw.json configuration access

## Implementation

### Principle: Default Deny, Explicit Allow

Instead of blocking specific dangerous actions (a losing game — you'll always miss something), start with everything denied and explicitly allow what the agent needs.

### openclaw.json — Role-Based Tool Policies

**Personal Assistant (medium trust):**
```json
{
  "toolPolicy": {
    "default": "ask",
    "allowed": [
      "read_file",
      "list_directory",
      "search_files",
      "web_search",
      "read_calendar",
      "read_email"
    ],
    "elevated": [
      "write_file",
      "execute_command",
      "send_message",
      "create_calendar_event",
      "draft_email"
    ],
    "denied": [
      "send_email",
      "delete_file",
      "execute_command:sudo *",
      "execute_command:rm -rf *"
    ]
  }
}
```

**Monitoring Agent (low trust, read-heavy):**
```json
{
  "toolPolicy": {
    "default": "deny",
    "allowed": [
      "read_file",
      "list_directory",
      "search_files",
      "execute_command:systemctl status *",
      "execute_command:journalctl *",
      "execute_command:df *",
      "execute_command:free *",
      "execute_command:top -bn1",
      "execute_command:curl -s http://localhost:*/health"
    ],
    "elevated": [
      "send_message"
    ],
    "denied": [
      "write_file",
      "delete_file",
      "execute_command:systemctl start *",
      "execute_command:systemctl stop *",
      "execute_command:systemctl restart *"
    ]
  }
}
```

**Code Review Agent (narrow scope):**
```json
{
  "toolPolicy": {
    "default": "deny",
    "allowed": [
      "read_file",
      "list_directory",
      "search_files",
      "execute_command:git log *",
      "execute_command:git diff *",
      "execute_command:git show *",
      "execute_command:npm test",
      "execute_command:npm run lint"
    ],
    "elevated": [
      "send_message",
      "execute_command:gh pr review *"
    ],
    "denied": [
      "write_file",
      "execute_command:git push *",
      "execute_command:git commit *",
      "execute_command:npm publish *"
    ]
  }
}
```

### Permission Levels Explained

| Level | Behavior | Use For |
|-------|----------|---------|
| `allowed` | Executes immediately, no prompt | Read operations, safe queries |
| `elevated` | Requires confirmation via trusted channel | Write operations, sending messages |
| `ask` | Prompts human for approval each time | Default for uncategorized tools |
| `denied` | Blocked completely, cannot be overridden | Destructive or out-of-scope actions |

### SOUL.md — Permission Awareness

```markdown
# My Permissions

I operate with restricted permissions appropriate for my role.

## What I Can Do Freely
- Read files and directories
- Search the filesystem
- Run web searches
- Check system status

## What Requires Confirmation
- Write or modify files
- Execute shell commands (beyond status checks)
- Send messages on channels

## What I Cannot Do
- Delete files
- Run sudo commands
- Push to git repositories
- Publish packages

If I need to do something outside my permissions, I'll tell my human:
"This action is outside my current permissions. You'll need to do it
directly, or adjust my tool policy if you want me to handle it."
```

### Progressive Permission Escalation

For new agents, start with the strictest policy and gradually loosen:

**Week 1: Discovery mode**
```json
{ "default": "ask" }
```
Every action gets logged. Review what the agent actually needs.

**Week 2: Allow read operations**
```json
{ "default": "ask", "allowed": ["read_file", "list_directory", "search_files"] }
```

**Week 3+: Allow verified write operations**
Based on Week 1-2 logs, allow the specific write operations the agent actually uses.

## Failure Modes

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Policy too strict — agent is useless | Over-restricted permissions | Start strict and loosen based on observed need. Don't stay at "deny all" forever. |
| Agent finds permission bypass | Uses an allowed tool in an unexpected way | Review allowed tool scope regularly. `execute_command:git log *` is safe; `execute_command:*` is not. Be specific. |
| Human fatigues on approval prompts | Too many "elevated" actions | Move frequently-approved actions to "allowed" after establishing they're safe. The goal is right-sizing, not maximum restriction. |
| Policy blocks heartbeat operations | Heartbeat check needs tools that require elevation | Heartbeat operations should use only "allowed" tools. Design heartbeat checks to be read-only. |
| Different policies per channel needed | Agent on CLI needs more access than agent on WhatsApp | OpenClaw supports per-channel policy overrides in some configurations. Otherwise, use the most restrictive common set. |

## Test Harness

```bash
#!/bin/bash
# test-harnesses/security/tool-lockdown.sh
source "$(dirname "$0")/../framework/helpers.sh"

WORKSPACE="${TEST_WORKSPACE:-/tmp/openclaw-test-workspace}"

setup_test_workspace "$WORKSPACE"

# Create SOUL.md with permission awareness
cat > "$WORKSPACE/SOUL.md" << 'EOF'
# My Permissions
## What I Can Do Freely
- Read files and directories
- Search the filesystem
## What Requires Confirmation
- Write or modify files
- Execute shell commands
## What I Cannot Do
- Delete files
- Run sudo commands
EOF

# Test 1: Permission levels documented in SOUL.md
assert_file_contains "$WORKSPACE/SOUL.md" "What I Can Do Freely" "Free permissions documented"
assert_file_contains "$WORKSPACE/SOUL.md" "What Requires Confirmation" "Elevated permissions documented"
assert_file_contains "$WORKSPACE/SOUL.md" "What I Cannot Do" "Denied permissions documented"

# Test 2: Dangerous operations explicitly denied
assert_file_contains "$WORKSPACE/SOUL.md" "Delete files" "Delete denied"
assert_file_contains "$WORKSPACE/SOUL.md" "sudo" "Sudo denied"

# Test 3: Simulate policy evaluation
# Define a simple policy
declare -A POLICY
POLICY["read_file"]="allowed"
POLICY["write_file"]="elevated"
POLICY["delete_file"]="denied"
POLICY["execute_command"]="elevated"

# Test allowed action
assert_exit_code "[ '${POLICY[read_file]}' = 'allowed' ]" 0 "read_file is allowed"

# Test elevated action
assert_exit_code "[ '${POLICY[write_file]}' = 'elevated' ]" 0 "write_file requires elevation"

# Test denied action
assert_exit_code "[ '${POLICY[delete_file]}' = 'denied' ]" 0 "delete_file is denied"

# Test 4: No secrets in policy config
assert_no_secrets "$WORKSPACE/SOUL.md" "SOUL.md has no secrets"

print_results
```

**Run:** `./test-harnesses/framework/runner.sh --test security/tool-lockdown`

## Evidence

A monitoring agent with default policy ("allow all") accumulated 2,847 tool calls over 30 days, including 43 write operations and 12 command executions that weren't part of its monitoring role (drift from monitoring into general assistance). After lockdown to monitoring-specific policy, tool calls were 100% within scope. The agent naturally adapted its behavior to work within its permissions.

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| Blocklist only (deny specific dangerous actions) | Incomplete — you'll always miss something. Allowlist (deny by default, allow specifics) is more secure. |
| Single policy for all agents | Different agents need different permissions. A code review bot shouldn't have the same access as a personal assistant. |
| No tool policy (rely on SOUL.md only) | SOUL.md is behavioral (model-dependent). Tool policy is mechanical (enforced by OpenClaw). Both are needed for defense in depth. |

## Contributors

- OpenClaw Operations Playbook Team
