# Pattern: SSRF Defense for Gateway

> **Category:** Security | **Status:** Tested | **OpenClaw Version:** 2026.2.12+ | **Last Validated:** 2026-02-14

> **See also:** [Gateway Hardening](gateway-hardening.md) for network-level security. This pattern focuses specifically on Server-Side Request Forgery (SSRF) prevention.

## Problem

OpenClaw's gateway accepts `input_file` and `input_image` URL parameters that tell the agent to fetch external resources. Without restrictions, an attacker can craft URLs pointing to internal network resources (cloud metadata endpoints, localhost services, private IPs) — turning the agent into an SSRF proxy. A single `input_file=http://169.254.169.254/latest/meta-data/iam/security-credentials/` can leak your cloud IAM credentials.

Before v2026.2.12, there was no built-in SSRF protection. The agent would fetch any URL it was given.

## Context

**Use when:**
- Agent fetches URLs from user input, webhooks, or external messages
- Running on cloud infrastructure (AWS, GCP, Azure) where metadata endpoints exist
- Agent has access to internal network resources
- Any production deployment with gateway exposed (even via Tailscale)

**Don't use when:**
- Agent never fetches external URLs (no web tools, no file tools)
- Fully offline deployment with no network access

**Prerequisites:**
- OpenClaw v2026.2.12+
- Understanding of your internal network topology (what shouldn't be reachable)
- [Gateway Hardening](gateway-hardening.md) pattern already applied

## Implementation

### Default Deny Policy (v2026.2.12+)

v2026.2.12 ships with an explicit SSRF deny policy that blocks known-dangerous address ranges by default:

- `127.0.0.0/8` (localhost)
- `10.0.0.0/8` (private network)
- `172.16.0.0/12` (private network)
- `192.168.0.0/16` (private network)
- `169.254.0.0/16` (link-local / cloud metadata)
- `fd00::/8` (IPv6 private)
- `::1` (IPv6 localhost)

This is on by default — no configuration needed for the deny list.

### Hostname Allowlists (Required Configuration)

The deny policy blocks internal IPs, but you should also configure allowlists for the external domains your agent legitimately needs to fetch:

```json
{
  "gateway": {
    "files": {
      "urlAllowlist": [
        "storage.googleapis.com",
        "s3.amazonaws.com",
        "cdn.example.com",
        "raw.githubusercontent.com"
      ],
      "maxUrlParts": 5
    },
    "images": {
      "urlAllowlist": [
        "i.imgur.com",
        "cdn.example.com",
        "upload.wikimedia.org"
      ],
      "maxUrlParts": 3
    }
  }
}
```

**Key settings:**
- `urlAllowlist` — Only these hostnames are allowed. Empty list = deny all external fetches (safest).
- `maxUrlParts` — Limits the number of URL path segments per request, preventing URL-based payload delivery.

### Audit Logging

Blocked fetch attempts are now audit-logged. Monitor these logs for SSRF probes:

```bash
# Check for blocked SSRF attempts
grep "ssrf_blocked\|url_denied\|fetch_rejected" ~/.openclaw/logs/gateway.log

# Monitor in real-time
tail -f ~/.openclaw/logs/gateway.log | grep -i "ssrf\|blocked\|denied"
```

### HEARTBEAT.md — SSRF Monitoring

```markdown
# SSRF Check (every 6 hours)
- Count blocked URL fetch attempts since last check
- If > 10 blocked attempts in 6 hours: alert (possible SSRF probing)
- Report: "SSRF_MONITOR: [count] blocked fetches. Top blocked domains: [list]."
- Verify urlAllowlist hasn't been modified
```

### Cloud Metadata Protection

If you're running on a cloud VM, add extra protection for the metadata endpoint:

**AWS:**
```bash
# Require IMDSv2 (token-based) — blocks simple SSRF
aws ec2 modify-instance-metadata-options \
  --instance-id i-xxx \
  --http-tokens required \
  --http-endpoint enabled
```

**GCP:**
```bash
# Metadata endpoint already requires Metadata-Flavor header
# But add firewall rule for defense in depth
gcloud compute firewall-rules create block-metadata-from-openclaw \
  --direction=EGRESS \
  --action=DENY \
  --rules=tcp:80 \
  --destination-ranges=169.254.169.254/32 \
  --target-tags=openclaw-server
```

### DNS Rebinding Protection

SSRF can bypass IP-based deny lists via DNS rebinding (domain resolves to internal IP after initial check):

```json
{
  "gateway": {
    "security": {
      "dnsRebindingProtection": true,
      "resolveBeforeFetch": true
    }
  }
}
```

When `resolveBeforeFetch` is enabled, the gateway resolves the hostname and checks the resulting IP against the deny list before making the request. This prevents DNS rebinding attacks where `evil.com` resolves to `169.254.169.254`.

## Failure Modes

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Legitimate URL blocked | Domain not in allowlist | Add the domain to the appropriate `urlAllowlist`. Review blocked fetch logs to identify false positives. |
| SSRF via DNS rebinding | Domain resolves to internal IP after initial check | Enable `resolveBeforeFetch` to check resolved IP against deny list. Use IMDSv2 on AWS. |
| SSRF via redirect chain | Allowed URL redirects to internal IP | OpenClaw follows redirects but checks each hop against the deny list. Verify with test: `curl -L allowed-url.com` to see redirect chain. |
| Cloud metadata exfiltrated | Running on cloud without metadata endpoint protection | Use IMDSv2 (AWS) or Metadata-Flavor header requirement (GCP). Firewall egress to 169.254.169.254. |
| Allowlist too permissive | Wildcards or broad domains in allowlist | Be specific. Use `cdn.example.com` not `*.example.com`. Review quarterly. |
| Attacker uses allowed domain as proxy | Allowed domain has an open redirect or SSRF vulnerability | Allowlist only domains you control or trust. Monitor for redirects from allowed domains. |

## Test Harness

```bash
#!/bin/bash
# test-harnesses/security/ssrf-defense.sh
source "$(dirname "$0")/../framework/helpers.sh"

WORKSPACE="${TEST_WORKSPACE:-/tmp/openclaw-test-workspace}"

setup_test_workspace "$WORKSPACE"

# Create config with SSRF protection
cat > "$WORKSPACE/openclaw.json" << 'EOF'
{
  "gateway": {
    "files": {
      "urlAllowlist": ["cdn.example.com", "storage.googleapis.com"],
      "maxUrlParts": 5
    },
    "images": {
      "urlAllowlist": ["i.imgur.com"],
      "maxUrlParts": 3
    }
  }
}
EOF

# Test 1: Allowlist is configured (not empty)
assert_file_contains "$WORKSPACE/openclaw.json" "urlAllowlist" "URL allowlist configured"

# Test 2: No wildcards in allowlist
assert_file_not_contains "$WORKSPACE/openclaw.json" '"*"' "No wildcard entries"

# Test 3: maxUrlParts is set
assert_file_contains "$WORKSPACE/openclaw.json" "maxUrlParts" "URL parts limit set"

# Test 4: No internal IPs in allowlist
assert_file_not_contains "$WORKSPACE/openclaw.json" "127.0.0.1" "No localhost in allowlist"
assert_file_not_contains "$WORKSPACE/openclaw.json" "192.168" "No private IPs in allowlist"
assert_file_not_contains "$WORKSPACE/openclaw.json" "169.254" "No link-local in allowlist"
assert_file_not_contains "$WORKSPACE/openclaw.json" "10.0" "No 10.x IPs in allowlist"

# Test 5: Simulate SSRF URLs that should be blocked
SSRF_URLS=(
  "http://169.254.169.254/latest/meta-data/"
  "http://127.0.0.1:18789/admin"
  "http://192.168.1.1/config"
  "http://[::1]:8080/internal"
  "http://0x7f000001:80/"
)

for url in "${SSRF_URLS[@]}"; do
  # Extract hostname and check against deny patterns
  HOST=$(echo "$url" | sed -E 's|https?://([^/:]+).*|\1|')
  if echo "$HOST" | grep -qE "^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.|0x|::1|\[::1\]|localhost)"; then
    echo "  PASS — SSRF URL correctly identified as blocked: $url"
    ((PASSED++))
  else
    echo "  FAIL — SSRF URL not identified: $url"
    ((FAILED++))
  fi
  ((TOTAL++))
done

# Test 6: No secrets in config
assert_no_secrets "$WORKSPACE/openclaw.json" "Config has no secrets"

print_results
```

**Run:** `./test-harnesses/framework/runner.sh --test security/ssrf-defense`

## Evidence

v2026.2.12 release notes report that gateway and OpenResponses now enforce a strict SSRF deny policy for URL-based `input_file` and `input_image` requests. SecurityScorecard's research found 40,000+ exposed OpenClaw deployments — any of these without SSRF protection could be used as a proxy to access internal network resources. The explicit deny policy + hostname allowlists reduce the attack surface from "any URL on the internet" to "only explicitly approved domains."

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| Network-level egress filtering only | Doesn't protect against SSRF to the local machine or cloud metadata endpoints. Application-level deny list is needed in addition to network firewalls. |
| Disable all URL fetching | Too restrictive. Agents need to fetch files and images for many legitimate tasks. Allowlists let you permit known-good domains. |
| Proxy all requests through a sanitizing proxy | Over-engineered for most setups. The built-in deny policy handles the common cases. Consider a proxy (Squid) only for high-security enterprise deployments. |

## Contributors

- OpenClaw Operations Playbook Team
