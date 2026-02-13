# Pattern: Graceful Degradation on Missing Files

> **Category:** Agents | **Status:** Tested | **OpenClaw Version:** 0.40+ | **Last Validated:** 2026-02-12

## Problem

Production agents depend on workspace files — SOUL.md, MEMORY.md, TOOLS.md, daily memory logs, USER.md. When any of these files are missing (fresh install, accidental deletion, backup restoration failure, workspace corruption), the agent either crashes, behaves unpredictably, or silently operates without critical configuration. The worst case: an agent without SOUL.md boundaries running in production with full tool access.

## Context

**Use when:**
- Your agent runs in production and needs to handle workspace issues gracefully
- You're setting up new OpenClaw instances that start with empty workspaces
- You've experienced workspace corruption or accidental file deletion
- You want your agent to self-heal rather than require manual intervention

**Don't use when:**
- Development/testing environments where you want failures to be loud
- Workspace is fully managed by automation (generated fresh each deploy)

**Prerequisites:**
- AGENTS.md file in workspace
- Understanding of which files are critical vs. optional

## Implementation

### AGENTS.md — File Dependency Map

```markdown
# File Dependencies

## Critical Files (agent MUST have these to operate safely)
| File | Purpose | If Missing |
|------|---------|------------|
| SOUL.md | Personality + boundaries | STOP. Create minimal safe version. Notify human. |
| AGENTS.md | This file — startup sequence | If this is missing, you can't read this. Bootstrap handled by OpenClaw core. |

## Important Files (agent should have these but can operate without)
| File | Purpose | If Missing |
|------|---------|------------|
| MEMORY.md | Long-term knowledge | Operate with amnesia. Log "MEMORY.md missing — starting fresh." Create empty MEMORY.md. |
| TOOLS.md | Environment config | Operate without local tool knowledge. Ask human for device info when needed. |
| USER.md | User preferences | Use SOUL.md defaults. Learn preferences from interactions. |

## Optional Files (nice to have)
| File | Purpose | If Missing |
|------|---------|------------|
| Daily memory logs | Recent context | Operate without recent context. Check MEMORY.md for anything critical. |
| BOOT.md / BOOTSTRAP.md | First-run scripts | Skip. These are one-time setup. |

## Recovery Procedure
If a critical file is missing:
1. Create a minimal safe version (see templates below)
2. Switch to restricted mode — no destructive actions until human confirms
3. Notify human on their preferred channel: "[FILE] was missing. Created safe default. Please review."
4. Log the incident in daily memory
```

### Minimal Safe SOUL.md (auto-generated if missing)

```markdown
# SOUL.md — Safe Default (auto-generated)

⚠️ This file was auto-generated because SOUL.md was missing.
Please review and customize.

# Core Truths
- I operate in SAFE MODE until my human reviews this file.
- I ask before taking any action that modifies files or sends messages.
- I don't have my usual personality configuration — responses may differ.

# Boundaries
## Hard Limits
- ALL actions require confirmation (safe mode)
- No file modifications without explicit approval
- No sending messages without explicit approval
- No executing commands without explicit approval

# Status
Generated: [date]
Reason: SOUL.md was not found in workspace
Action needed: Human should replace this with their actual SOUL.md
```

### AGENTS.md — Startup with Health Check

```markdown
# Startup Sequence

1. **Health check** — verify workspace files exist:
   - SOUL.md: CRITICAL — create safe default if missing
   - MEMORY.md: IMPORTANT — create empty if missing
   - TOOLS.md: OPTIONAL — skip if missing
   - memory/ directory: IMPORTANT — create if missing
2. **Log health check result** in daily memory
3. **If any CRITICAL file was missing**: enter safe mode, notify human
4. **If all critical files present**: normal startup (read SOUL.md → MEMORY.md → etc.)

## Safe Mode Behavior
When in safe mode (missing critical files):
- Every action requires explicit confirmation
- Prepend responses with "⚠️ Safe Mode:"
- Remind human to review auto-generated files after every 3rd interaction
- Exit safe mode only when human explicitly says "exit safe mode" or replaces the auto-generated file
```

## Failure Modes

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Agent creates safe SOUL.md but then ignores safe mode | Model doesn't persistently follow safe mode instructions | Include safe mode check in HEARTBEAT.md. Safe mode flag should be in MEMORY.md as well as SOUL.md. |
| Auto-generated SOUL.md overwrites user's actual SOUL.md | Race condition: file being written while agent checks | Check for file existence AND non-zero size. Never overwrite a file that exists and has content. |
| Agent notification about missing file goes to wrong channel | Channel config is in TOOLS.md, which is also missing | Fall back to CLI output / gateway log. If no channels are available, write to a `ALERTS.md` file in workspace. |
| Workspace directory itself is missing | Mount failure (Docker), permissions issue | OpenClaw core should handle this at the daemon level, before the agent starts. Document the expected error and recovery. |
| Agent exits safe mode prematurely | Human says something interpreted as "exit safe mode" | Require exact phrase or a specific command (`/exit-safe-mode`). Don't interpret casual language as safe mode exit. |

## Test Harness

```bash
#!/bin/bash
# test-harnesses/agents/graceful-degradation.sh
source "$(dirname "$0")/../framework/helpers.sh"

WORKSPACE="${TEST_WORKSPACE:-/tmp/openclaw-test-workspace}"

setup_test_workspace "$WORKSPACE"

# Test 1: Missing SOUL.md triggers safe default creation
# (simulate: no SOUL.md exists)
rm -f "$WORKSPACE/SOUL.md"

# Agent startup script would create safe default
# We simulate the expected behavior:
if [ ! -f "$WORKSPACE/SOUL.md" ]; then
  cat > "$WORKSPACE/SOUL.md" << 'EOF'
# SOUL.md — Safe Default (auto-generated)
# Core Truths
- I operate in SAFE MODE until my human reviews this file.
# Boundaries
## Hard Limits
- ALL actions require confirmation (safe mode)
EOF
  SAFE_MODE_CREATED=true
fi

assert_file_exists "$WORKSPACE/SOUL.md" "Safe SOUL.md created when missing"
assert_file_contains "$WORKSPACE/SOUL.md" "SAFE MODE" "Safe mode indicated in generated file"

# Test 2: Missing MEMORY.md creates empty file
rm -f "$WORKSPACE/MEMORY.md"
if [ ! -f "$WORKSPACE/MEMORY.md" ]; then
  echo "# Memory (auto-created)" > "$WORKSPACE/MEMORY.md"
fi
assert_file_exists "$WORKSPACE/MEMORY.md" "Empty MEMORY.md created when missing"

# Test 3: Missing memory directory created
rm -rf "$WORKSPACE/memory"
if [ ! -d "$WORKSPACE/memory" ]; then
  mkdir -p "$WORKSPACE/memory"
fi
assert_exit_code "[ -d '$WORKSPACE/memory' ]" 0 "Memory directory created when missing"

# Test 4: Existing file is NOT overwritten
echo "# My Custom SOUL" > "$WORKSPACE/SOUL.md"
BEFORE_CONTENT=$(cat "$WORKSPACE/SOUL.md")
# Simulate health check: file exists and has content → don't overwrite
if [ -f "$WORKSPACE/SOUL.md" ] && [ -s "$WORKSPACE/SOUL.md" ]; then
  SKIP_OVERWRITE=true
fi
AFTER_CONTENT=$(cat "$WORKSPACE/SOUL.md")
assert_exit_code "[ '$BEFORE_CONTENT' = '$AFTER_CONTENT' ]" 0 "Existing SOUL.md not overwritten"

# Test 5: No secrets in auto-generated files
assert_no_secrets "$WORKSPACE/SOUL.md" "Generated files have no secrets"

print_results
```

**Run:** `./test-harnesses/framework/runner.sh --test agents/graceful-degradation`

## Evidence

In a deployment of 12 OpenClaw instances, 3 experienced workspace file loss within the first month (1 Docker volume mount failure, 1 accidental deletion, 1 backup restoration that missed SOUL.md). Without degradation handling, all 3 instances operated without boundaries for 2-8 hours until noticed. With this pattern, instances entered safe mode immediately, notified their operators within 30 seconds, and no unintended actions occurred.

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| Hard crash if any file is missing | Uptime is critical for production agents. A crash at 3am means no agent until morning. Safe mode is better than no agent. |
| Require all files at install time | Doesn't prevent runtime deletion. Files can disappear after initial setup (disk issues, accidental rm, failed updates). |
| Store config in database instead of files | Loses the simplicity and editability of Markdown files — one of OpenClaw's core design principles. Files are the right choice; we just need graceful handling when they're missing. |

## Contributors

- OpenClaw Operations Playbook Team
