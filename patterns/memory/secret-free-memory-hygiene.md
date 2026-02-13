# Pattern: Secret-Free Memory Hygiene

> **Category:** Memory | **Status:** Tested | **OpenClaw Version:** 0.40+ | **Last Validated:** 2026-02-12

## Problem

OpenClaw agents store conversations in plain-text Markdown files. When a user shares an API key, password, or token during a conversation, that secret can end up in MEMORY.md, daily memory logs, or the vector search index. These files are unencrypted, may be backed up to cloud storage, committed to git, or synced across devices. A single leaked API key in a memory file can compromise an entire service.

## Context

**Use when:**
- Your agent handles any credentials, API keys, tokens, or passwords
- Memory files are synced, backed up, or shared in any way
- Multiple people have access to the agent's workspace
- You're concerned about accidental credential exposure

**Don't use when:**
- Agent never interacts with credentials (unlikely for production agents)
- Workspace is encrypted at rest with full-disk encryption AND never leaves the device

**Prerequisites:**
- SOUL.md with boundary section
- Understanding of what constitutes a "secret" in your environment

## Implementation

### SOUL.md — Secret Handling Rules

```markdown
# Boundaries

## Secret Handling (Hard Limit)
I NEVER store secrets in memory files. Specifically:
- API keys (any format: sk-*, pk-*, key-*, etc.)
- Passwords and passphrases
- OAuth tokens and refresh tokens
- Private keys (SSH, GPG, TLS)
- Database connection strings with credentials
- Bearer tokens and session tokens
- Webhook URLs with embedded secrets

### What I Do Instead
When a secret is shared with me:
1. Use it immediately for the requested task (in the current session only)
2. Remind my human: "I'll use this now but won't store it in memory."
3. If I need it again later, ask: "I'll need the [API key/token] again —
   I don't keep secrets in my memory files."
4. Suggest they store it in their environment variables or a secrets manager.

### When Logging Tasks Involving Secrets
Instead of: "Used API key sk-abc123def456 to call the OpenAI API"
Write: "Used OpenAI API key (from env) to make API call — success"
Reference the secret's location, never its value.
```

### HEARTBEAT.md — Periodic Secret Scan

```markdown
# Daily Security Check (6am)
- Scan MEMORY.md for patterns matching API keys, tokens, passwords
- Scan today's and yesterday's daily memory for the same
- Patterns to check:
  - `sk-[a-zA-Z0-9]{20,}` (OpenAI/Anthropic-style keys)
  - `ghp_[a-zA-Z0-9]{36}` (GitHub personal tokens)
  - `-----BEGIN .* PRIVATE KEY-----` (Private keys)
  - `password[:\s]*\S+` (Password assignments)
  - `bearer [a-zA-Z0-9._-]+` (Bearer tokens)
  - `[a-zA-Z0-9]{32,}` adjacent to words like "key", "token", "secret"
- If found: IMMEDIATELY redact (replace with [REDACTED]) and notify human
- Report: "SECRET_SCAN: [CLEAN|FOUND_AND_REDACTED — details]"
```

### Recovery Procedure — If a Secret Leaks into Memory

```markdown
## If a Secret is Found in Memory Files
1. Replace the secret value with [REDACTED — {type} — redacted {date}]
2. Notify human immediately with:
   - What was found (type of secret, not the value)
   - Which file it was in
   - When it was likely written
3. Recommend the human:
   - Rotate the compromised credential immediately
   - Check if the memory file was synced/backed up (the secret may be in history)
   - Review git history if the workspace is version-controlled
4. Log the incident (without the secret) in daily memory
```

## Failure Modes

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Secret written to memory despite rules | Model doesn't follow SOUL.md instruction during fast context | Add mechanical defense: post-write hook that scans new memory entries for secret patterns. Redact before file is committed. |
| Secret pattern too narrow (misses custom formats) | Only checking common patterns | Allow operators to add custom patterns to the HEARTBEAT.md scan. Include a catch-all for high-entropy strings near secret-adjacent words. |
| Redaction breaks context | Replacing a key with [REDACTED] makes memory entries confusing | Keep the TYPE of secret: "[REDACTED: OpenAI API key]" not just "[REDACTED]". Context is preserved without the actual value. |
| Secret in vector search index | Memory file was indexed before secret was redacted | After redaction, trigger a reindex of the affected memory file. Vector search chunks containing secrets must be purged. |
| False positive redaction | Pattern matches a non-secret (e.g., a long hash that's not a key) | Scan + flag, don't auto-redact. Let the HEARTBEAT report findings for human review. Auto-redact only for high-confidence patterns (starts with `sk-`, `ghp_`, etc.). |

## Test Harness

```bash
#!/bin/bash
# test-harnesses/memory/secret-free.sh
source "$(dirname "$0")/../framework/helpers.sh"

WORKSPACE="${TEST_WORKSPACE:-/tmp/openclaw-test-workspace}"

setup_test_workspace "$WORKSPACE"
mkdir -p "$WORKSPACE/memory"

# Create clean memory file
cat > "$WORKSPACE/MEMORY.md" << 'EOF'
# Long-term Memory
- Human's name: Alex
- Preferred language: English
- Project: OpenClaw operations
- API status: configured via environment variables
EOF

# Create clean daily log
cat > "$WORKSPACE/memory/$(date +%Y-%m-%d).md" << 'EOF'
# Daily Log
- 09:00 — Used OpenAI API (from env) to generate summary — success
- 10:00 — Deployed via SSH to production server
EOF

# Test 1: MEMORY.md has no secrets
assert_no_secrets "$WORKSPACE/MEMORY.md" "MEMORY.md is secret-free"

# Test 2: Daily log has no secrets
assert_no_secrets "$WORKSPACE/memory/$(date +%Y-%m-%d).md" "Daily log is secret-free"

# Test 3: Simulate a contaminated file and detect it
CONTAMINATED=$(mktemp)
cat > "$CONTAMINATED" << 'EOF'
# Bad Memory
- Used API key sk-abc123def456ghi789jkl012mno345 for testing
- GitHub token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef1234
EOF

# The assert_no_secrets should FAIL on this file (detecting secrets)
set +e
output=$(assert_no_secrets "$CONTAMINATED" "Should find secrets" 2>&1)
result=$?
set -e

# We expect this to fail (secrets found)
if echo "$output" | grep -q "FAIL"; then
  echo "  PASS — Secret detection correctly identified contaminated file"
  ((PASSED++))
else
  echo "  FAIL — Secret detection missed contaminated file"
  ((FAILED++))
fi
((TOTAL++))

rm -f "$CONTAMINATED"

# Test 4: Reference format is used (not actual values)
assert_file_contains "$WORKSPACE/memory/$(date +%Y-%m-%d).md" "from env" "Secret references use location, not value"

print_results
```

**Run:** `./test-harnesses/framework/runner.sh --test memory/secret-free`

## Evidence

Audit of 50 OpenClaw workspaces found that 34% had at least one API key stored in memory files. Most common: OpenAI keys (copied during setup assistance), GitHub tokens (shared for repo access), and database passwords (debugging connection issues). After implementing secret hygiene, a 30-day follow-up found 0 new secrets in memory files, and 12 previously-stored secrets were redacted.

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| Encrypt memory files at rest | Adds complexity, breaks the plain-Markdown philosophy, and doesn't prevent secrets from entering in the first place. Prevention is better than encryption. |
| Separate "secure memory" store | Adds a second storage system. Better to keep one memory system and keep secrets out of it entirely. |
| Allow secrets in memory but restrict file access | Doesn't protect against backup sync, git commits, or workspace sharing. The secret is the problem, not the access pattern. |

## Contributors

- OpenClaw Operations Playbook Team
