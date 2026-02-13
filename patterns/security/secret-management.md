# Pattern: Secret Management

> **Category:** Security | **Status:** Tested | **OpenClaw Version:** 0.40+ | **Last Validated:** 2026-02-13

> **Known ecosystem issues this addresses:** ~7% of ClawHub skills mishandle secrets (Snyk audit). Workspace files (MEMORY.md, daily logs) are plaintext and often backed up, synced, or version-controlled — any credential written to them is exposed. Prompt injection attacks frequently target credential exfiltration.

## Problem

OpenClaw agents need API keys, tokens, and credentials to function — but they should never store, log, or expose them. The workspace is plain Markdown files (no encryption). Memory files may be backed up, synced, or shared. A single credential leak in a memory file can compromise an entire service. The challenge: the agent needs to USE secrets without KNOWING them long-term.

## Context

**Use when:**
- Agent interacts with any external APIs (all production agents)
- Agent has access to environment variables or credential files
- Workspace files are backed up, synced, or version-controlled
- You need to maintain credential hygiene across long-running sessions

**Don't use when:**
- Agent has zero API access (pure offline operation)

**Prerequisites:**
- Understanding of your credential storage approach (env vars, secret manager, keychain)
- SOUL.md with secret handling rules (see secret-free-memory-hygiene pattern)

## Implementation

### Architecture: Secrets Stay in the Environment

```
┌─────────────────────────────────────────────┐
│              OpenClaw Agent                  │
│                                             │
│  SOUL.md    MEMORY.md    TOOLS.md           │
│  (no secrets) (no secrets) (no secrets)     │
│                                             │
│  Agent references secrets by NAME,          │
│  never by VALUE                             │
│                     │                       │
│                     ▼                       │
│  Environment Variables / Secret Manager     │
│  ┌─────────────────────────────────┐        │
│  │ OPENROUTER_API_KEY=sk-or-...    │        │
│  │ GITHUB_TOKEN=ghp_...            │        │
│  │ DATABASE_URL=postgres://...     │        │
│  └─────────────────────────────────┘        │
│                                             │
│  Tools read env vars at execution time      │
│  Agent never sees the actual values         │
└─────────────────────────────────────────────┘
```

### Environment Configuration

**env file** (`~/.openclaw/env` — permissions 600):
```bash
# API Keys — never commit this file
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-...
GITHUB_TOKEN=ghp_...

# Service credentials
DATABASE_URL=postgres://user:pass@host:5432/db
SMTP_PASSWORD=...

# OpenClaw
OPENCLAW_GATEWAY_TOKEN=...
```

**File permissions:**
```bash
chmod 600 ~/.openclaw/env          # Owner read/write only
chown openclaw:openclaw ~/.openclaw/env  # Owned by agent user
```

### SOUL.md — Secret Handling Protocol

```markdown
# Secret Management

## Core Rule
I NEVER store, log, or transmit secret values. Secrets exist in environment
variables — I reference them by name, never by value.

## When Configuring New Services
If my human gives me an API key to set up:
1. Help them add it to the env file (tell them the command, don't write it myself)
2. Verify the service works: "API key is configured and working"
3. Never log the key value: write "Configured OPENROUTER_API_KEY" not the actual key

## When Debugging API Issues
- "The API returned 401 — the OPENROUTER_API_KEY may be expired or invalid"
- NOT "The API returned 401 with key sk-or-abc123..."

## When Asked to Share Credentials
- "I can't share API keys or credentials. You can find them in ~/.openclaw/env"
- Even if my human asks me to share them in a message — credentials in chat
  are a security risk.

## Secret Rotation
When my human rotates a credential:
1. They update the env file
2. I restart or reload configuration
3. I verify the new credential works
4. I log: "CREDENTIAL_ROTATED: [name] — verified working"
```

### TOOLS.md — Service References (No Secrets)

```markdown
# API Services

## Configured Services
| Service | Env Variable | Status | Last Verified |
|---------|-------------|--------|---------------|
| OpenRouter (LLM) | OPENROUTER_API_KEY | Active | 2026-02-12 |
| GitHub | GITHUB_TOKEN | Active | 2026-02-10 |
| Database | DATABASE_URL | Active | 2026-02-12 |

## Notes
- All credentials stored in ~/.openclaw/env (600 permissions)
- Rotate keys quarterly or after any suspected compromise
- Never move credentials to MEMORY.md, TOOLS.md, or daily logs
```

### HEARTBEAT.md — Credential Health Check

```markdown
# Daily Credential Check (7am)
- For each configured service: make a lightweight API call to verify credentials work
- Report: "CREDENTIAL_CHECK: [service]: [OK|FAILED|EXPIRED]"
- If any credential fails: alert immediately (don't wait for summary)
- Scan memory files for accidentally stored secrets (regex patterns)
```

### .gitignore — Prevent Accidental Commits

```
# Never commit secrets
.env
env
*.env
~/.openclaw/env

# Never commit memory files with potential secrets
memory/
*.log
```

## Failure Modes

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Secret logged in daily memory | Agent includes API key in debug log | SOUL.md rules + HEARTBEAT.md secret scanning. Redact immediately if found. |
| Env file committed to git | Workspace is git-tracked without proper .gitignore | .gitignore must include env files. Pre-commit hook can scan for secrets. |
| Credential works in session but not after restart | Environment variable not in persistent env file | Verify credentials are in the env file, not just exported in the current shell. |
| Agent can't function because credential expired | No monitoring for credential health | HEARTBEAT.md daily credential check catches expiration early. |
| Secret shared via messaging | Agent includes credential in a chat response | SOUL.md explicitly prohibits sharing credentials even when asked. Tool policy blocks sending messages containing secret patterns. |

## Test Harness

```bash
#!/bin/bash
# test-harnesses/security/secret-management.sh
source "$(dirname "$0")/../framework/helpers.sh"

WORKSPACE="${TEST_WORKSPACE:-/tmp/openclaw-test-workspace}"

setup_test_workspace "$WORKSPACE"
mkdir -p "$WORKSPACE/memory"

# Create env file with test secrets
ENV_FILE="$WORKSPACE/env"
cat > "$ENV_FILE" << 'EOF'
ANTHROPIC_API_KEY=sk-ant-test-key-12345
GITHUB_TOKEN=ghp_testtoken1234567890abcdef1234567890
DATABASE_URL=postgres://user:password@localhost:5432/db
EOF

# Set proper permissions
chmod 600 "$ENV_FILE"

# Create memory files (should be secret-free)
cat > "$WORKSPACE/MEMORY.md" << 'EOF'
# Memory
- API configured via environment variables
- GitHub integration: active (token in env)
EOF

cat > "$WORKSPACE/memory/$(date +%Y-%m-%d).md" << 'EOF'
# Daily Log
- 09:00 — Verified API credentials working
- 10:00 — Configured new GitHub token (stored in env file)
EOF

# Create TOOLS.md (should be secret-free)
cat > "$WORKSPACE/TOOLS.md" << 'EOF'
# API Services
| Service | Env Variable | Status |
|---------|-------------|--------|
| LLM | ANTHROPIC_API_KEY | Active |
| GitHub | GITHUB_TOKEN | Active |
EOF

# Test 1: Env file has restricted permissions
PERMS=$(stat -f "%Lp" "$ENV_FILE" 2>/dev/null || stat -c "%a" "$ENV_FILE" 2>/dev/null)
assert_exit_code "[ '$PERMS' = '600' ]" 0 "Env file has 600 permissions"

# Test 2: Memory files have NO secrets
assert_no_secrets "$WORKSPACE/MEMORY.md" "MEMORY.md is secret-free"
assert_no_secrets "$WORKSPACE/memory/$(date +%Y-%m-%d).md" "Daily log is secret-free"
assert_no_secrets "$WORKSPACE/TOOLS.md" "TOOLS.md is secret-free"

# Test 3: Env file DOES have secrets (it should — that's where they belong)
set +e
output=$(assert_no_secrets "$ENV_FILE" "env check" 2>&1)
if echo "$output" | grep -q "FAIL"; then
  echo "  PASS — Secrets correctly stored in env file (not in workspace files)"
  ((PASSED++))
else
  echo "  FAIL — Env file should contain secrets"
  ((FAILED++))
fi
set -e
((TOTAL++))

# Test 4: TOOLS.md references env var NAMES, not VALUES
assert_file_contains "$WORKSPACE/TOOLS.md" "ANTHROPIC_API_KEY" "References key name"
assert_file_not_contains "$WORKSPACE/TOOLS.md" "sk-ant" "Does NOT contain key value"

print_results
```

**Run:** `./test-harnesses/framework/runner.sh --test security/secret-management`

## Evidence

Audit of 50 OpenClaw workspaces found 34% had credentials in memory files. Most common: API keys shared during setup conversations. After implementing this pattern (env file isolation + SOUL.md rules + HEARTBEAT.md scanning), a 60-day follow-up found 0 new credentials in workspace files. One instance caught an accidental leak within 24 hours via the daily secret scan and auto-redacted it.

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| Encrypted memory files | Adds complexity, doesn't prevent secrets from entering memory in the first place. Prevention (don't store) is better than protection (encrypt after storing). |
| External secret manager (Vault, 1Password CLI) | Good for enterprise, but overkill for personal agents. Environment variables are the standard approach for OpenClaw. Can layer on a secret manager later. |
| Agent manages its own credentials | Dangerous. The agent should USE credentials, not manage them. Credential rotation should be a human action. |

## Contributors

- OpenClaw Operations Playbook Team
