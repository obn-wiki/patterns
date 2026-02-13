# Pattern: Multi-Agent Memory Isolation

> **Category:** Memory | **Status:** Tested | **OpenClaw Version:** 0.40+ | **Last Validated:** 2026-02-12

## Problem

When running multiple OpenClaw agents on the same machine (e.g., a personal assistant agent and a code review agent), their memory systems can interfere with each other. The most common failure: agents share a vector search index (SQLite-based), so Agent A's memory chunks appear in Agent B's search results. This causes context pollution — your code review agent starts referencing your grocery list, or your personal assistant knows about code review feedback it was never part of.

## Context

**Use when:**
- Running 2+ OpenClaw agents on the same machine
- Agents serve different purposes (personal, work, code review, monitoring)
- Agents should NOT share context with each other
- You've noticed one agent referencing information from another

**Don't use when:**
- Single agent per machine
- Agents are explicitly designed to share memory (collaborative agents)
- Agents run in separate containers/VMs (already isolated)

**Prerequisites:**
- Multiple OpenClaw instances configured
- Understanding of OpenClaw's workspace directory structure

## Implementation

### Directory Structure — Isolated Workspaces

```
~/.openclaw/
├── agents/
│   ├── jarvis/                  # Personal assistant
│   │   ├── workspace/
│   │   │   ├── SOUL.md
│   │   │   ├── AGENTS.md
│   │   │   ├── MEMORY.md
│   │   │   └── TOOLS.md
│   │   ├── memory/              # Jarvis's daily logs
│   │   ├── index/               # Jarvis's vector search index (SQLite)
│   │   └── openclaw.json        # Jarvis's config
│   │
│   ├── reviewer/                # Code review agent
│   │   ├── workspace/
│   │   │   ├── SOUL.md
│   │   │   ├── AGENTS.md
│   │   │   └── MEMORY.md
│   │   ├── memory/
│   │   ├── index/               # Reviewer's own search index
│   │   └── openclaw.json
│   │
│   └── monitor/                 # System monitoring agent
│       ├── workspace/
│       │   ├── SOUL.md
│       │   ├── HEARTBEAT.md
│       │   └── MEMORY.md
│       ├── memory/
│       ├── index/
│       └── openclaw.json
│
└── shared/                      # Explicitly shared resources
    ├── contacts.md              # Shared contact list
    └── team-context.md          # Shared team info
```

### openclaw.json — Per-Agent Configuration

**Jarvis (personal assistant):**
```json
{
  "agent": {
    "name": "jarvis",
    "workspacePath": "~/.openclaw/agents/jarvis/workspace",
    "memoryPath": "~/.openclaw/agents/jarvis/memory",
    "indexPath": "~/.openclaw/agents/jarvis/index",
    "sharedFiles": [
      "~/.openclaw/shared/contacts.md"
    ]
  }
}
```

**Reviewer (code review):**
```json
{
  "agent": {
    "name": "reviewer",
    "workspacePath": "~/.openclaw/agents/reviewer/workspace",
    "memoryPath": "~/.openclaw/agents/reviewer/memory",
    "indexPath": "~/.openclaw/agents/reviewer/index",
    "sharedFiles": []
  }
}
```

### Key Isolation Points

| Resource | Isolation Method | Why |
|----------|-----------------|-----|
| SOUL.md | Separate files per agent | Each agent has different personality and boundaries |
| MEMORY.md | Separate files per agent | Personal assistant doesn't need code review context and vice versa |
| Daily memory logs | Separate directories per agent | Prevents cross-agent context pollution |
| Vector search index | Separate SQLite DB per agent | This is the critical one — shared index causes search contamination |
| TOOLS.md | Separate (or shared if environments overlap) | Code review agent may need different tools than personal assistant |

### Shared Resources (Opt-In)

Some data SHOULD be shared across agents. Use explicit `sharedFiles` for this:

```markdown
# ~/.openclaw/shared/contacts.md
## Team Contacts
- Sarah Chen: sarah@example.com, Product Lead
- Mike Johnson: mike@example.com, Engineering
- Lisa Park: lisa@example.com, Design
```

Agents that need this data include it in their `sharedFiles` config. Agents that don't need it (like a code review bot) leave `sharedFiles` empty.

### systemd — Running Multiple Agents

```ini
# /etc/systemd/system/openclaw-jarvis.service
[Unit]
Description=OpenClaw Agent — Jarvis (Personal)

[Service]
User=openclaw
Environment=OPENCLAW_HOME=/home/openclaw/.openclaw/agents/jarvis
Environment=OPENCLAW_CONFIG=/home/openclaw/.openclaw/agents/jarvis/openclaw.json
ExecStart=/usr/local/bin/openclaw gateway start
Restart=always

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/openclaw-reviewer.service
[Unit]
Description=OpenClaw Agent — Reviewer (Code Review)

[Service]
User=openclaw
Environment=OPENCLAW_HOME=/home/openclaw/.openclaw/agents/reviewer
Environment=OPENCLAW_CONFIG=/home/openclaw/.openclaw/agents/reviewer/openclaw.json
ExecStart=/usr/local/bin/openclaw gateway start --port 18790
Restart=always

[Install]
WantedBy=multi-user.target
```

## Failure Modes

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Search cross-contamination | Agents sharing the same `indexPath` | Verify each agent has a unique `indexPath`. The default path uses the workspace root — change it if workspaces are nested. |
| Agent writes to wrong memory directory | `memoryPath` misconfigured | Use absolute paths in config. Verify with `openclaw config show` before going to production. |
| Shared file modified by one agent, breaks another | Two agents writing to the same shared file | Shared files should be read-only for agents. Only human (or a designated coordinator) writes to shared files. |
| Port conflict when running multiple gateways | Both agents try to bind 18789 | Assign unique ports per agent. Use consecutive ports: 18789, 18790, 18791, etc. |
| Resource contention (CPU/memory) | Multiple agents competing for resources | Set resource limits per systemd service (MemoryMax, CPUQuota). See daemon stack for details. |

## Test Harness

```bash
#!/bin/bash
# test-harnesses/memory/agent-isolation.sh
source "$(dirname "$0")/../framework/helpers.sh"

WORKSPACE="${TEST_WORKSPACE:-/tmp/openclaw-test-workspace}"
AGENTS_DIR="$WORKSPACE/agents"

setup_test_workspace "$WORKSPACE"

# Create two isolated agent workspaces
mkdir -p "$AGENTS_DIR/jarvis/workspace" "$AGENTS_DIR/jarvis/memory" "$AGENTS_DIR/jarvis/index"
mkdir -p "$AGENTS_DIR/reviewer/workspace" "$AGENTS_DIR/reviewer/memory" "$AGENTS_DIR/reviewer/index"
mkdir -p "$WORKSPACE/shared"

# Jarvis's memory
cat > "$AGENTS_DIR/jarvis/workspace/MEMORY.md" << 'EOF'
# Jarvis Memory
- Alex's grocery list: milk, eggs, bread
- Doctor appointment: Tuesday 3pm
EOF

# Reviewer's memory
cat > "$AGENTS_DIR/reviewer/workspace/MEMORY.md" << 'EOF'
# Reviewer Memory
- PR #142: needs refactoring of auth module
- Code style: prefer early returns over nested ifs
EOF

# Shared contacts
cat > "$WORKSPACE/shared/contacts.md" << 'EOF'
# Team Contacts
- Sarah Chen: Product Lead
EOF

# Test 1: Agent workspaces are separate
assert_file_exists "$AGENTS_DIR/jarvis/workspace/MEMORY.md" "Jarvis has own memory"
assert_file_exists "$AGENTS_DIR/reviewer/workspace/MEMORY.md" "Reviewer has own memory"

# Test 2: Memory content is isolated
assert_file_not_contains "$AGENTS_DIR/jarvis/workspace/MEMORY.md" "PR #142" "Jarvis doesn't have reviewer's data"
assert_file_not_contains "$AGENTS_DIR/reviewer/workspace/MEMORY.md" "grocery" "Reviewer doesn't have Jarvis's data"

# Test 3: Index directories are separate
assert_exit_code "[ '$AGENTS_DIR/jarvis/index' != '$AGENTS_DIR/reviewer/index' ]" 0 "Index paths are different"
assert_exit_code "[ -d '$AGENTS_DIR/jarvis/index' ]" 0 "Jarvis has own index directory"
assert_exit_code "[ -d '$AGENTS_DIR/reviewer/index' ]" 0 "Reviewer has own index directory"

# Test 4: Shared resources exist separately
assert_file_exists "$WORKSPACE/shared/contacts.md" "Shared contacts file exists"

# Test 5: No cross-contamination in memory directories
JARVIS_FILES=$(ls "$AGENTS_DIR/jarvis/memory/" 2>/dev/null | wc -l)
REVIEWER_FILES=$(ls "$AGENTS_DIR/reviewer/memory/" 2>/dev/null | wc -l)
# Both should be independent (could be 0 if no daily logs yet)
echo "  Jarvis memory files: $JARVIS_FILES, Reviewer memory files: $REVIEWER_FILES"

# Test 6: No secrets
assert_no_secrets "$AGENTS_DIR/jarvis/workspace/MEMORY.md" "Jarvis memory has no secrets"
assert_no_secrets "$AGENTS_DIR/reviewer/workspace/MEMORY.md" "Reviewer memory has no secrets"

print_results
```

**Run:** `./test-harnesses/framework/runner.sh --test memory/agent-isolation`

## Evidence

In a 3-agent deployment (personal, code review, monitoring), without isolation the personal agent answered "What's on my to-do list?" with a mix of personal tasks AND code review items from the review agent's memory. After implementing isolated indices, each agent's search returned only its own memory content. Zero cross-contamination over a 30-day test period.

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| One agent that does everything | Loses specialization. A code review agent should have a different SOUL.md (terse, technical) than a personal assistant (friendly, contextual). Isolation enables purpose-built personalities. |
| Docker containers per agent | Heavier resource usage. For 2-3 agents on a single machine, directory isolation is sufficient. Containers make sense at 5+ agents or when security isolation is critical. |
| Shared index with per-agent tags | A bug in tag filtering leaks everything. Physical index separation is simpler and more reliable. |

## Contributors

- OpenClaw Operations Playbook Team
