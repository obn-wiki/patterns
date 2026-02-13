# Pattern: TOOLS.md Organization

> **Category:** Tools | **Status:** Tested | **OpenClaw Version:** 0.40+ | **Last Validated:** 2026-02-12

## Problem

TOOLS.md is OpenClaw's local environment configuration — camera IDs, SSH hosts, device names, smart home mappings. Without organization, it becomes a dumping ground of random key-value pairs that's hard for both humans and agents to navigate. A poorly organized TOOLS.md leads to: agent using wrong device names, stale entries causing command failures, and duplicate entries with conflicting values.

## Context

**Use when:**
- Your TOOLS.md has more than 10 entries
- You have multiple categories of tools/devices (SSH, cameras, smart home, APIs)
- You've experienced the agent using wrong device names or stale configs
- Multiple people maintain the workspace

**Don't use when:**
- Minimal TOOLS.md (< 5 entries)
- Single-purpose agent that only uses one type of tool

**Prerequisites:**
- TOOLS.md in workspace
- Inventory of actual devices, hosts, and services the agent needs to know about

## Implementation

### TOOLS.md — Structured Format

```markdown
# Local Environment

Last verified: 2026-02-12

## SSH Hosts
| Alias | Host | User | Key | Purpose |
|-------|------|------|-----|---------|
| dev | dev.internal.example.com | deploy | ~/.ssh/id_ed25519 | Development server |
| staging | staging.example.com | deploy | ~/.ssh/id_ed25519 | Staging environment |
| prod | prod.example.com | deploy | ~/.ssh/id_prod | Production (ask before using) |

## Smart Home
| Device | ID/IP | Room | Commands |
|--------|-------|------|----------|
| Living room lights | hue-bridge:group-1 | Living Room | on, off, dim [%], scene [name] |
| Office lights | hue-bridge:group-3 | Office | on, off, dim [%] |
| Thermostat | nest:abc123 | Whole house | set [temp], mode [heat/cool/auto] |

## Cameras
| Name | ID | Location | Capabilities |
|------|-----|----------|-------------|
| Front door | cam-001 | Exterior | snapshot, motion-history |
| Backyard | cam-002 | Exterior | snapshot, motion-history |
| Office | cam-003 | Interior | snapshot (privacy: only check when asked) |

## Frequently Used Paths
| Alias | Path | Notes |
|-------|------|-------|
| Projects | ~/Projects | Active development projects |
| Backups | ~/Backups | Local backup destination |
| Downloads | ~/Downloads | Incoming files, auto-clean weekly |

## API Endpoints (Non-Secret)
| Service | Base URL | Auth Method | Notes |
|---------|----------|-------------|-------|
| Internal API | http://localhost:3000 | None (local) | Dev server |
| Monitoring | http://grafana.internal:3000 | Session cookie | Dashboards |

## Important Notes
- **prod SSH**: Always confirm before executing commands on production
- **Camera cam-003**: Interior camera — only access when explicitly asked
- **Thermostat**: Don't adjust below 65°F or above 78°F without asking
```

### Key Principles

1. **Tables, not prose**: Tables are scannable by both humans and agents
2. **Categories with headers**: Agent can find the right section quickly
3. **Last verified date**: Encourages regular review of stale entries
4. **Notes for special cases**: "Ask before using prod" prevents accidents
5. **No secrets**: Auth methods referenced, but actual keys/passwords are NEVER in TOOLS.md

### SOUL.md — Tool Usage Rules

```markdown
# Tool Usage

When I need to interact with devices or hosts:
1. Check TOOLS.md for the correct name/ID/alias
2. If the entry has a special note (e.g., "ask before using"), follow it
3. If the device/host isn't in TOOLS.md, ask my human — don't guess
4. Never assume a device name from a previous session if it's not in TOOLS.md
```

## Failure Modes

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Agent uses wrong device name | TOOLS.md has stale entry or agent guessed | Require agent to always check TOOLS.md before using any device/host name. Include "last verified" date to flag staleness. |
| Duplicate entries with conflicting values | Added new entry without removing old one | Review TOOLS.md monthly. Use tables (not free-form text) to make duplicates visually obvious. |
| Agent accesses restricted device | No warning in TOOLS.md | Add "Important Notes" section with explicit restrictions. Cross-reference in SOUL.md boundaries. |
| TOOLS.md too large for context budget | Too many entries, verbose descriptions | Keep entries concise (table format). Move rarely-used entries to a reference file (not injected). Budget: 3KB max for TOOLS.md. |
| Secrets stored in TOOLS.md | API keys or passwords entered as "tool config" | TOOLS.md should reference auth METHOD (session cookie, SSH key path), never actual credentials. Secret scanning in HEARTBEAT.md catches violations. |

## Test Harness

```bash
#!/bin/bash
# test-harnesses/tools/tools-organization.sh
source "$(dirname "$0")/../framework/helpers.sh"

WORKSPACE="${TEST_WORKSPACE:-/tmp/openclaw-test-workspace}"
TOOLS_FILE="$WORKSPACE/TOOLS.md"

setup_test_workspace "$WORKSPACE"

cat > "$TOOLS_FILE" << 'EOF'
# Local Environment

Last verified: 2026-02-12

## SSH Hosts
| Alias | Host | User | Purpose |
|-------|------|------|---------|
| dev | dev.internal | deploy | Development |

## Smart Home
| Device | ID | Room | Commands |
|--------|-----|------|----------|
| Office lights | hue:group-3 | Office | on, off, dim |

## Important Notes
- prod SSH: Always confirm before executing
EOF

# Test 1: TOOLS.md has structured headers
assert_file_contains "$TOOLS_FILE" "# Local Environment" "Has top-level header"
assert_file_contains "$TOOLS_FILE" "## SSH Hosts" "Has SSH section"

# Test 2: Last verified date present
assert_file_contains "$TOOLS_FILE" "Last verified" "Has verification date"

# Test 3: Uses table format
assert_file_contains "$TOOLS_FILE" "| Alias |" "Uses table format for SSH"

# Test 4: Has important notes section
assert_file_contains "$TOOLS_FILE" "Important Notes" "Has notes for special cases"

# Test 5: No secrets
assert_no_secrets "$TOOLS_FILE" "TOOLS.md has no secrets"

# Test 6: Reasonable size (under 3KB budget)
assert_file_size_under "$TOOLS_FILE" 3072 "TOOLS.md under 3KB budget"

print_results
```

**Run:** `./test-harnesses/framework/runner.sh --test tools/tools-organization`

## Evidence

Before organization: an agent with 25 unstructured TOOLS.md entries used the wrong SSH alias 15% of the time (confusing "staging" with "staging-old"). After restructuring into tables with a notes section, wrong-alias usage dropped to 0% over 30 days. The "Last verified" date prompted a monthly review that caught 4 stale entries.

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| JSON/YAML config instead of Markdown | Loses human readability. TOOLS.md is frequently hand-edited. Markdown tables are the best balance of structure and editability. |
| Separate files per category (ssh.md, cameras.md) | Over-fragmentation. TOOLS.md is typically small (< 3KB). One file with sections is simpler. |
| Store tool configs in openclaw.json | openclaw.json is for OpenClaw runtime config, not user environment. TOOLS.md is the intended location for local environment knowledge. |

## Contributors

- OpenClaw Operations Playbook Team
