# Gap Analysis — Community Research vs. Current Patterns

> Research conducted: Feb 13, 2026 | Sources: X/Twitter threads, Substacks, Gists, official docs, GitHub

---

## What We Have vs. What the Community Is Talking About

### Covered Well (our patterns align with community consensus)

| Topic | Community Source | Our Pattern | Alignment |
|-------|----------------|-------------|-----------|
| Pre-compaction memory flush | digitalknk runbook, official docs | `memory/pre-compaction-memory-flush` | Strong — our config matches the actual `memoryFlush` config shape |
| Secret-free memory | Multiple reports of API key leaks | `memory/secret-free-memory-hygiene` | Strong — 34% of workspaces had leaked keys per our audit |
| Gateway hardening (localhost + Tailscale) | VittoStack, aimaker, Pulumi blog, official docs | `security/gateway-hardening` | Strong — everyone says "never 0.0.0.0" |
| Prompt injection defense | @EXM7777, aimaker guide, OpenClaw v2026.2.1 guardrails | `security/prompt-injection-defense` | Good — but needs update for native System Guardrails |
| Cost optimization | digitalknk ($45-50/mo target), @ItakGol, @riyazmd774 | `operations/cost-optimization-strategies` | Good — our numbers are in range, model tiering matches |
| Heartbeat on cheap models | digitalknk, community consensus | `operations/heartbeat-checklist-design` | Good — we recommend Haiku, community recommends GPT-5 Nano |
| Dangerous command prevention | aimaker (allowlist > denylist), alex_prompter | `tools/dangerous-command-prevention` | Good — but aimaker's "allowlist only" approach is stricter than ours |

### Partially Covered (we have something, but community goes deeper)

| Topic | What Community Says | What We Have | Gap |
|-------|--------------------|--------------|----|
| Tool allowlisting | aimaker: "Never use denylists—attackers find alternatives." Strict allowlist-only for shell commands. | We use blocklist + confirmation. | Should add an "advanced" variant with allowlist-only approach per aimaker's Tier 2 |
| Compaction config | Official docs: `contextPruning.mode` can be `cache-ttl`, `sliding`, or `none`. `compaction.mode` can be `safeguard` or `aggressive`. | We reference `softThresholdTokens` but not the full config taxonomy. | Update compaction pattern with all pruning modes |
| Multi-agent setups | Nader Dabit (10 agents), Antfarm (7-agent pipelines), community discussing orchestration | We have `multi-agent-memory-isolation` and `workspace-isolation-for-teams` | Missing: orchestration patterns (how agents delegate, coordinate, hand off) |
| Security hardening depth | aimaker goes to 3 tiers: (1) basic isolation, (2) tool allowlisting + MCP security, (3) container sandbox + Squid proxy | We have gateway hardening + tool policy + secret management | Missing Tier 3: container sandboxing, LiteLLM credential brokering, egress filtering |

### Not Covered (significant gaps from community research)

| Missing Pattern | Priority | Source | Description |
|----------------|----------|--------|-------------|
| **Cheap Model Coordinator** | HIGH | digitalknk, community consensus | Use cheap model (Haiku/Nano) as default coordinator. Only invoke expensive models (Sonnet/Opus) for complex reasoning. This is THE #1 cost optimization and we don't have a dedicated pattern for it. |
| **Two-Agent Untrusted Content** | HIGH | @EXM7777 | Reader agent (no tools) processes untrusted content → passes sanitized data to Actor agent (limited tools). Architectural defense against injection. |
| **Rotating Heartbeat** | MEDIUM | digitalknk | Single heartbeat cycles through different checks on a schedule (email every 30m, calendar every 2h, git daily). More efficient than parallel checks. |
| **Skill/Plugin Security Vetting** | HIGH | OpenClaw v2026.2.6, Cisco Talos (26% vuln rate), VirusTotal integration (Feb 13 2026), Snyk (283 skills with critical flaws) | Process for vetting ClawdHub skills before installation. VirusTotal now scans all skills (SHA-256 fingerprint → benign/suspicious/malicious), but won't catch prompt injection. Safety scanner + manual review needed. |
| **LiteLLM Credential Brokering** | MEDIUM | aimaker Tier 3 | Three-container setup: LiteLLM handles API keys, OpenClaw never sees real credentials. Rate limiting + cost controls at the proxy layer. |
| **Container Sandbox Deployment** | MEDIUM | aimaker Tier 3 | Rootless Podman, read-only filesystem, tmpfs for writable dirs, internal-only network. OpenClaw has zero internet access; talks only to LiteLLM. |
| **Domain Egress Filtering** | LOW | aimaker Tier 3 | Squid proxy with domain allowlist. Deny-by-default outbound network. Heavy but effective for high-security deployments. |
| **Anti-Memory Minimalism** | LOW | @thekitze | Deliberately minimal memory: no fancy memory system, use `/new` often, point to files manually. Valid pattern for certain workflows. |
| **Matrix E2E Messaging** | LOW | VittoStack | E2E encrypted messaging via Matrix instead of Telegram/WhatsApp (where bots can't use E2E). Privacy-maximizing channel choice. |
| **Mem0 External Memory** | LOW | mem0.ai blog | External memory service that survives compaction, session restarts, and token limits. Auto-Recall pulls relevant context. |
| **Cloudflare Workers Edge Deployment** | LOW | @rakeshgohel01 | Serverless gateway deployment, AI Gateway for cost control and observability. |
| **Git-Tracked Config** | MEDIUM | digitalknk | Initialize git in `~/.openclaw`, commit before changes. Instant rollback for bad config changes. Simple but not obvious. |
| **Native System Guardrails Integration** | HIGH | OpenClaw v2026.2.1 | Our prompt injection pattern predates native guardrails. Need to document how our SOUL.md-based defense layers WITH the built-in guardrails. |

---

## Version Compatibility Risks

| Our Pattern | OpenClaw Change | Risk |
|-------------|----------------|------|
| `security/prompt-injection-defense` | v2026.2.1 added native System Guardrails | Our pattern may duplicate built-in protection. Need to position as complementary (SOUL.md layer + native layer). |
| `security/gateway-hardening` | v2026.2.1 added TLS 1.3 minimum | Good — aligns with our recommendations. Should reference the native TLS enforcement. |
| `operations/heartbeat-checklist-design` | v2026.2.3 added heartbeat accountId routing | Our pattern doesn't cover multi-account routing. Should add a section on this. |
| `security/tool-policy-lockdown` | v2026.2.6 added skill/plugin safety scanner | Our pattern focuses on tool policy config. Should reference the native safety scanner as an additional layer. |
| All compaction patterns | Official docs show `contextPruning.mode` and `compaction.mode` config keys | Our patterns use generic config. Should update to match actual config key names from v2026.2+. |

---

## Recommended V1.1 Additions (post-launch)

**Highest priority — write these next:**
1. Cheap Model Coordinator Pattern (cost optimization cornerstone)
2. Skill/Plugin Security Vetting (26% vuln rate demands this)
3. Native System Guardrails Integration (update existing pattern)
4. Two-Agent Untrusted Content Architecture
5. Git-Tracked Config (simple, high-value)

**V1.2:**
6. Rotating Heartbeat
7. LiteLLM Credential Brokering
8. Container Sandbox Deployment

**V2:**
9. Domain Egress Filtering
10. Multi-Agent Orchestration Patterns
11. Matrix E2E Messaging
12. External Memory (Mem0)
