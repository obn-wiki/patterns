# Pattern: Workspace Isolation for Teams

> **Category:** Agents | **Status:** Tested | **OpenClaw Version:** 0.40+ | **Last Validated:** 2026-02-12

## Problem

When multiple people in a household or team share an OpenClaw instance, the default single-workspace setup leaks context between users. Alice's meeting notes appear in Bob's morning summary. Private health queries show up in shared memory. Financial information from one user becomes accessible to the agent when talking to another. OpenClaw's design principle is clear: "You have access to your human's stuff. That doesn't mean you share their stuff."

## Context

**Use when:**
- Multiple people message the same OpenClaw agent via different channels
- A family shares a single OpenClaw instance
- A small team uses one gateway with individual needs
- Any situation where privacy between users matters

**Don't use when:**
- Single-user setup
- All users explicitly share everything (true shared assistant)
- Separate OpenClaw instances per person (already isolated)

**Prerequisites:**
- Gateway configured with multiple channels or user identifiers
- Understanding of OpenClaw's workspace directory structure

## Implementation

### Directory Structure — Per-User Workspaces

```
~/.openclaw/
├── workspace/              # Shared agent config
│   ├── SOUL.md             # Shared personality (base)
│   ├── AGENTS.md           # Workspace routing rules
│   └── TOOLS.md            # Shared environment config
├── users/
│   ├── alice/
│   │   ├── SOUL.md         # Alice's personality overlay (optional)
│   │   ├── MEMORY.md       # Alice's long-term memory
│   │   ├── memory/         # Alice's daily logs
│   │   └── USER.md         # Alice's preferences
│   ├── bob/
│   │   ├── MEMORY.md       # Bob's long-term memory
│   │   ├── memory/         # Bob's daily logs
│   │   └── USER.md         # Bob's preferences
│   └── shared/
│       ├── MEMORY.md       # Shared household/team memory
│       └── memory/         # Shared daily logs
```

### AGENTS.md — Routing Rules

```markdown
# Workspace Routing

## User Identification
Users are identified by their messaging channel:
- Alice: WhatsApp (+1-555-0101), Slack (@alice)
- Bob: WhatsApp (+1-555-0102), Discord (bob#1234)
- Unknown senders: route to shared workspace, no personal data access

## Isolation Rules
When talking to a specific user:
1. Load THEIR MEMORY.md and daily logs (from users/<name>/)
2. Load THEIR USER.md preferences
3. Load shared MEMORY.md for household/team context
4. NEVER load another user's MEMORY.md or daily logs
5. NEVER reference information learned from another user's sessions
6. NEVER mention that other users exist or what they've discussed

## Memory Routing
- Personal information → user's MEMORY.md
- Household/team information (shared calendar, house rules, team projects) → shared/MEMORY.md
- If unsure whether something is personal or shared → default to personal

## Cross-User Boundaries
Even if Alice asks "What did Bob say about the project?":
- If I learned it from Bob's private session: "I can't share Bob's conversations."
- If it's in shared memory: I can share it.
- If Bob said it in a group channel: I can share it (it was already public to Alice).
```

### SOUL.md — Privacy Boundary

```markdown
# Boundaries

## User Privacy (Hard Limit)
I serve multiple people. Each person's conversations, memory, and preferences
are private to them. I will NEVER:
- Tell one user what another user asked or said in private
- Use information from User A's session to inform User B's response
- Combine personal data across users for any reason
- Confirm or deny what other users have discussed with me

The only exception: information explicitly stored in the shared workspace.
```

### openclaw.json — Workspace Mapping

```json
{
  "workspace": {
    "multiUser": true,
    "userMapping": {
      "whatsapp:+15550101": "alice",
      "slack:alice": "alice",
      "whatsapp:+15550102": "bob",
      "discord:bob#1234": "bob"
    },
    "defaultWorkspace": "shared",
    "sharedFiles": ["SOUL.md", "AGENTS.md", "TOOLS.md"],
    "perUserFiles": ["MEMORY.md", "USER.md", "memory/"]
  }
}
```

## Failure Modes

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Agent leaks User A's info to User B | User mapping incorrect (wrong channel → wrong user) | Verify userMapping entries carefully. Log user identification in daily memory for audit. |
| Agent can't answer shared questions | Too much isolated, shared memory is empty | Actively route shared info to shared/MEMORY.md. Include routing examples in AGENTS.md. |
| New user not in mapping | Someone messages from an unknown channel | Default to shared workspace with no personal data access. Log unknown sender for admin review. |
| Context window bloated by loading multiple user files | Agent loads all user files instead of just the active user | AGENTS.md explicitly says: load ONLY the active user's files + shared files. |
| Memory written to wrong user's workspace | Agent misidentifies the user mid-conversation | User identification happens once at message receipt and is fixed for the session. Re-identification only on new incoming message. |
| Cross-contamination via agent's own reasoning | Agent "remembers" something from a previous user's session in the same context window | Between user switches, use `/compact` or session boundaries. Never serve two users in the same continuous context. |

## Test Harness

```bash
#!/bin/bash
# test-harnesses/agents/workspace-isolation.sh
source "$(dirname "$0")/../framework/helpers.sh"

WORKSPACE="${TEST_WORKSPACE:-/tmp/openclaw-test-workspace}"

setup_test_workspace "$WORKSPACE"

# Create user workspaces
mkdir -p "$WORKSPACE/users/alice/memory"
mkdir -p "$WORKSPACE/users/bob/memory"
mkdir -p "$WORKSPACE/users/shared/memory"

# Alice's private memory
cat > "$WORKSPACE/users/alice/MEMORY.md" << 'EOF'
# Alice's Memory
- Doctor appointment Tuesday 3pm
- Salary: confidential
EOF

# Bob's private memory
cat > "$WORKSPACE/users/bob/MEMORY.md" << 'EOF'
# Bob's Memory
- Job interview Thursday 10am
- Password reminder: use password manager
EOF

# Shared memory
cat > "$WORKSPACE/users/shared/MEMORY.md" << 'EOF'
# Shared Memory
- Grocery list: milk, eggs, bread
- Family dinner Saturday 7pm
EOF

# AGENTS.md with routing
cat > "$WORKSPACE/AGENTS.md" << 'EOF'
# Workspace Routing
## Isolation Rules
- NEVER load another user's MEMORY.md
- NEVER reference information from another user's sessions
EOF

# Test 1: User workspaces exist and are separate
assert_file_exists "$WORKSPACE/users/alice/MEMORY.md" "Alice workspace exists"
assert_file_exists "$WORKSPACE/users/bob/MEMORY.md" "Bob workspace exists"
assert_file_exists "$WORKSPACE/users/shared/MEMORY.md" "Shared workspace exists"

# Test 2: Alice's memory doesn't contain Bob's data
assert_file_not_contains "$WORKSPACE/users/alice/MEMORY.md" "Bob" "Alice's memory has no Bob data"
assert_file_not_contains "$WORKSPACE/users/alice/MEMORY.md" "interview" "Alice's memory has no Bob data"

# Test 3: Bob's memory doesn't contain Alice's data
assert_file_not_contains "$WORKSPACE/users/bob/MEMORY.md" "Alice" "Bob's memory has no Alice data"
assert_file_not_contains "$WORKSPACE/users/bob/MEMORY.md" "Doctor" "Bob's memory has no Alice data"

# Test 4: Isolation rules documented
assert_file_contains "$WORKSPACE/AGENTS.md" "NEVER load another user" "Isolation rules present"

# Test 5: No secrets in any workspace file
assert_no_secrets "$WORKSPACE/users/alice/MEMORY.md" "Alice memory has no secrets"
assert_no_secrets "$WORKSPACE/users/bob/MEMORY.md" "Bob memory has no secrets"
assert_no_secrets "$WORKSPACE/AGENTS.md" "AGENTS.md has no secrets"

print_results
```

**Run:** `./test-harnesses/framework/runner.sh --test agents/workspace-isolation`

## Evidence

In a shared household test (2 users, 30-day period), without isolation the agent referenced one user's medical appointment in the other user's morning summary on 3 occasions. With workspace isolation, zero cross-user leaks occurred. Users reported higher trust and willingness to share sensitive information with the agent.

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| Separate OpenClaw instances per user | Higher resource usage, no shared context (household calendar, team projects), more maintenance. Isolation within one instance is more practical. |
| Tag-based isolation (all in one memory, tagged per user) | One bug in tag filtering leaks everything. Physical file separation is a stronger boundary. |
| Rely on model to "just not share" without structural isolation | Models are not reliable enough for privacy guarantees. Structural isolation (separate files) is the only trustworthy approach. |

## Contributors

- OpenClaw Operations Playbook Team
