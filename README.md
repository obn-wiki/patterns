# OBN — OpenClaw Builder Network

**[obn.wiki](https://obn.wiki)** — Vetted patterns for running OpenClaw agents in production.

Production operators need patterns that won't fail at 3am. This repo is the canonical, vendor-neutral reference for running OpenClaw agents 24/7 safely — with tested configs, documented failure modes, and reproducible test harnesses.

> **Browse the docs:** [obn.wiki](https://obn.wiki) has search, navigation, and an AI assistant that answers questions grounded in these patterns.

## Why This Exists

OpenClaw is powerful, but operational knowledge is scattered:

- Memory architectures copied from blog posts without understanding failure modes
- Tool patterns that work in demos but leak secrets in production
- Context management strategies that hallucinate or corrupt state
- Security patterns based on folk wisdom, not tested defenses

Operators reinvent solutions, make preventable mistakes, and waste days on solved problems.

This repo fixes that.

## Repository Structure

```
obn-wiki/
├── patterns/                # Source of truth — contributors edit here
│   ├── soul/               # SOUL.md personality, boundaries, behavioral tuning
│   ├── agents/             # AGENTS.md multi-agent routing, workspace isolation
│   ├── memory/             # MEMORY.md, compaction, vector search, daily logs
│   ├── context/            # Context packs, window optimization, injection control
│   ├── tools/              # TOOLS.md, tool batching, rate limiting, caching
│   ├── security/           # Prompt injection defense, data isolation, sandboxing
│   ├── operations/         # HEARTBEAT.md, cron, overnight execution, monitoring
│   └── gateway/            # Multi-channel routing, session management, pairing
├── stacks/
│   ├── daemon/             # systemd / launchd production configs
│   ├── docker/             # Containerized deployment
│   ├── cloud/              # Cloud VM deployment (AWS, GCP, etc.)
│   └── n8n/                # Workflow automation integration
├── test-harnesses/
│   ├── framework/          # Test runner, assertion helpers
│   ├── corpus/             # Standard input corpus (1k messages, edge cases)
│   └── results/            # Example test results and evidence
├── site/                   # Astro Starlight docs site (obn.wiki)
│   ├── src/components/     # AI chat sidebar (React)
│   ├── scripts/            # Content transformer (patterns → docs)
│   └── astro.config.mjs    # Site configuration
├── PRD.md                  # Product requirements document
├── CONTRIBUTING.md         # How to submit patterns
└── PATTERN_TEMPLATE.md     # Standard pattern format
```

## Pattern Format

Every pattern follows a consistent structure:

1. **Problem** — What this solves
2. **Context** — When to use / not use
3. **Implementation** — Full config snippets (SOUL.md, AGENTS.md, etc.)
4. **Failure Modes** — What can go wrong + mitigations
5. **Test Harness** — Reproducible validation script
6. **Evidence** — Logs, metrics, example outcomes
7. **OpenClaw Version** — Which version this was tested against

See [PATTERN_TEMPLATE.md](PATTERN_TEMPLATE.md) for the full template.

## Version Matrix

Patterns target different minimum OpenClaw versions. Check which patterns apply to your version before implementing.

| Min Version | Patterns | What Changed |
|-------------|----------|-------------|
| **0.40+** | All 29 original patterns (soul, agents, memory, context, tools, operations, gateway) | Baseline. Memory system, SOUL.md, AGENTS.md, context compaction, tool policies all available. |
| **2026.2.1+** | [Native Guardrails Integration](patterns/security/native-guardrails-integration.md), [Prompt Injection Defense](patterns/security/prompt-injection-defense.md) (updated) | **System Guardrails** added — native prompt injection defense at the system prompt level. TLS 1.3 minimum for gateway. Session injection support. All security patterns should layer on top of guardrails when available. |
| **2026.2.3+** | [Heartbeat Checklist Design](patterns/operations/heartbeat-checklist-design.md) | **Announce delivery mode** for isolated cron. Heartbeat `accountId` routing for multi-user setups. |
| **2026.2.6+** | [Skill/Plugin Security Vetting](patterns/security/skill-plugin-security-vetting.md), [Cost Optimization](patterns/operations/cost-optimization-strategies.md) (updated), [Cheap Model Coordinator](patterns/operations/cheap-model-coordinator.md) | **Safety scanner** for skills/plugins. VirusTotal integration (SHA-256 fingerprinting, daily rescans). Opus 4.6 + GPT-5.3-Codex support. Web UI token dashboard. Session history caps and billing clarity. |
| **Multi-version** | [Two-Agent Untrusted Content](patterns/security/two-agent-untrusted-content.md) | Works on any version with multi-agent support (0.40+). Benefits from System Guardrails on 2026.2.1+. |

> **Upgrade note:** If you're on 0.40 and upgrading to 2026.2.1+, enable System Guardrails first (`agents.defaults.guardrails.enabled: true`), then review the [Native Guardrails Integration](patterns/security/native-guardrails-integration.md) pattern to understand how your existing SOUL.md rules compose with the new native defenses.

## Pattern Categories

| Category | Count | Description |
|----------|-------|-------------|
| [Soul](patterns/soul/) | 4 | SOUL.md personality, behavioral boundaries, evolution |
| [Agents](patterns/agents/) | 3 | Multi-agent routing, workspace isolation, group behavior |
| [Memory](patterns/memory/) | 5 | Persistent state, compaction, vector search, daily logs |
| [Context](patterns/context/) | 3 | Window management, file injection, compaction strategy |
| [Tools](patterns/tools/) | 3 | TOOLS.md config, batching, rate limiting |
| [Security](patterns/security/) | 7 | Prompt injection, data isolation, secret management, guardrails, skill vetting, two-agent architecture |
| [Operations](patterns/operations/) | 5 | Heartbeat, cron, overnight execution, cost optimization, model coordination |
| [Gateway](patterns/gateway/) | 3 | Multi-channel, session management, remote access |

## Quick Start

**Find a pattern:**
```bash
# Browse by category
ls patterns/memory/

# Search for a specific concern
grep -r "compaction" patterns/
```

**Use a pattern:**
1. Read the full pattern file
2. Check "OpenClaw Version" matches yours
3. Copy the Implementation section into your workspace
4. Run the linked test harness to validate
5. Monitor using the Evidence section as baseline

**Contribute a pattern:**
See [CONTRIBUTING.md](CONTRIBUTING.md) for submission guidelines.

## Who This Is For

**Primary: Production Operators** — You run OpenClaw agents on real workloads (cron, webhooks, 24/7 services). You need patterns that won't fail at 3am. You value reliability over novelty, tested over theoretical.

**Secondary:**
- Companies evaluating OpenClaw for production
- Researchers benchmarking agent architectures
- Tool builders needing community feedback

## Quality Standards

Every pattern in this repo must have:

- [ ] Documented failure modes (not just the happy path)
- [ ] Test harness (reproducible validation)
- [ ] Version pinning (which OpenClaw version it was tested against)
- [ ] Evidence (logs, metrics, or example outcomes)
- [ ] At least one independent validation

Patterns without test harnesses are marked `[UNTESTED]` and cannot be promoted to stable.

## License

MIT

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). We review every PR within 24 hours.
