# OpenClaw Operations Playbook — Review Package

> **Reviewers:** We're building the community-driven operations playbook for OpenClaw. Before we go public, we need your eyes on this. Be brutal.

---

## What This Is

A GitHub repo of **vetted operational patterns** for running OpenClaw agents in production. Not a getting-started guide. Not "how to install OpenClaw." This is the missing manual for people who already have OpenClaw running and need to make it reliable, secure, and cost-effective.

**Repo:** [Local preview — will be at github.com/[TBD]/openclaw-playbook]
**29 seed patterns** across 8 categories, plus deployment stacks and test harnesses.

---

## Why It Needs to Exist

OpenClaw hit 187k GitHub stars. The docs cover architecture and config. But production operations are scattered across Twitter threads, Substacks, and Gists. There's no single place that answers:

- "My agent leaked an API key into memory — how do I prevent that?"
- "Compaction keeps losing my task state — what's the fix?"
- "How do I run this overnight without it burning $50 in API calls?"
- "What's the minimum security setup for a gateway on a VPS?"

We've pulled from the best community sources — the digitalknk runbook, VittoStack's security guide, the aimaker hardening article, kitze's anti-memory approach, alex_prompter's guardrail system prompt, the Molt Founders config guide — and structured it into repeatable, testable patterns.

---

## What We Need From You

### 1. Pattern Quality Check
Pick 2-3 patterns in your area of expertise and review:

| Category | Patterns | Best For Reviewer Who... |
|----------|---------|--------------------------|
| `patterns/soul/` | Boundary hardening, drift prevention, tone adaptation, uncertainty handling | ...has tuned SOUL.md for production |
| `patterns/agents/` | Startup sequence, workspace isolation, graceful degradation | ...runs multi-agent or multi-user setups |
| `patterns/memory/` | Pre-compaction flush, secret hygiene, log rotation, search tuning, multi-agent isolation | ...has dealt with memory loss or secret leaks |
| `patterns/context/` | Window budgeting, injection control, compaction strategy | ...runs 24/7 agents that compact regularly |
| `patterns/tools/` | TOOLS.md organization, rate limiting, dangerous command prevention | ...has experienced tool abuse or cost overruns |
| `patterns/security/` | Prompt injection defense, secret management, tool policy lockdown, gateway hardening | ...cares about security (everyone should) |
| `patterns/operations/` | Heartbeat design, overnight execution, cost optimization, health monitoring | ...runs agents unattended |
| `patterns/gateway/` | Production deployment, multi-channel routing, Tailscale remote access | ...deploys gateways on servers/VPS |

**For each pattern, tell us:**
- [ ] Is the problem statement real? (Have you actually experienced this?)
- [ ] Is the implementation correct for current OpenClaw? (We're targeting v2026.2+)
- [ ] Are we missing failure modes you've seen in practice?
- [ ] Is the test harness useful or just theater?
- [ ] What would you add or change?

### 2. Gap Analysis
What patterns are **missing**? Based on our research, these are candidates we haven't written yet:

| Potential Pattern | Source | Notes |
|-------------------|--------|-------|
| **Two-agent pattern for untrusted content** | @EXM7777's interactive course | Reader (no tools) → Actor (limited tools). Separates parsing from execution. |
| **LiteLLM credential brokering** | aimaker hardening guide | Three-container architecture: OpenClaw never sees real API keys. |
| **Rotating heartbeat with Todoist** | digitalknk runbook | Single heartbeat cycles through multiple checks on a schedule. |
| **Anti-memory approach** | @thekitze | Don't rely on memory at all. Use `/new` often. Point to files manually. Valid for some workflows. |
| **Cheap model coordinator pattern** | digitalknk runbook, community consensus | Main model = cheap coordinator, expensive models called explicitly for complex tasks. |
| **Skill security vetting** | OpenClaw v2026.2.6 safety scanner | 26% of ClawdHub skills contain vulnerabilities (Cisco Talos). Vetting process needed. |
| **Encrypted storage with `age`** | aimaker hardening guide | Encrypt config at rest, decrypt on startup. |
| **Domain egress filtering (Squid proxy)** | aimaker hardening guide | Allowlist-only outbound network access. |
| **Multi-agent orchestration (Antfarm)** | @JulianGoldieSEO, @ryancarson | Planner → Coder → Tester → Reviewer → Security → PR pipelines. |
| **Cloudflare Workers deployment** | @rakeshgohel01 | Edge deployment pattern, AI Gateway for cost control. |
| **Matrix E2E messaging** | VittoStack security guide | E2E encrypted messaging alternative to Telegram/WhatsApp. |
| **Mem0 external memory** | mem0.ai blog | Memory that survives compaction, token limits, and session restarts. |

**Question:** Which of these should be V1 priorities? Which are niche?

### 3. Structural Feedback
- Is the pattern template right? (Problem → Context → Implementation → Failure Modes → Test Harness → Evidence → Alternatives)
- Should patterns be shorter? Longer? More code, less prose?
- Is the 8-category structure correct, or should we reorganize?
- Are deployment stacks (systemd, Docker, cloud, n8n) useful or out of scope?

### 4. Version Compatibility
We're targeting **OpenClaw v2026.2+**. Recent releases added:
- **v2026.2.6**: Safety scanner for skills/plugins, Opus 4.6 + GPT-5.3-Codex support, web UI token dashboard
- **v2026.2.3**: Announce delivery mode for isolated cron, heartbeat accountId routing
- **v2026.2.1**: System Guardrails (native prompt injection defense), session injection, TLS 1.3 minimum
- **Feb 13, 2026**: VirusTotal integration for ClawHub skills — SHA-256 fingerprinting, benign/suspicious/malicious classification, daily rescans. Snyk found 283 skills with critical credential-exposing flaws. VirusTotal found "hundreds" of actively malicious skills. Note: won't catch prompt injection attacks.

**Questions for reviewers:**
1. Do any of our patterns conflict with the new native System Guardrails in v2026.2.1?
2. Does the native safety scanner in v2026.2.6 make our `prompt-injection-defense` pattern redundant, or complementary?
3. Given the VirusTotal/Snyk findings on skill security, should "Skill Security Vetting" be a V1 pattern (not V1.1)?

---

## Quick Start for Reviewers

```bash
# Clone and browse
git clone [REPO_URL]
cd openclaw-playbook

# Read the overview
cat README.md

# Browse a pattern (pick any)
cat patterns/security/prompt-injection-defense.md
cat patterns/memory/pre-compaction-memory-flush.md
cat patterns/operations/cost-optimization-strategies.md

# Run a test harness (requires OpenClaw + bash)
./test-harnesses/framework/setup.sh
./test-harnesses/framework/runner.sh --test security/prompt-injection
```

---

## Repo Structure

```
openclaw-playbook/
├── README.md                    # Project overview
├── PATTERN_TEMPLATE.md          # Standard template for submissions
├── CONTRIBUTING.md              # Submission process + quality gates
├── PRD.md                       # Product requirements document
├── REVIEW.md                    # ← You are here
│
├── patterns/
│   ├── soul/                    # 4 patterns — SOUL.md configuration
│   ├── agents/                  # 3 patterns — AGENTS.md & workspace
│   ├── memory/                  # 5 patterns — Memory system
│   ├── context/                 # 3 patterns — Context window management
│   ├── tools/                   # 3 patterns — Tool usage & safety
│   ├── security/                # 4 patterns — Security hardening
│   ├── operations/              # 4 patterns — 24/7 operations
│   └── gateway/                 # 3 patterns — Gateway deployment
│
├── stacks/
│   ├── daemon/                  # systemd + launchd service files
│   ├── docker/                  # Dockerfile + compose
│   ├── cloud/                   # Cloud VM deployment guide
│   └── n8n/                     # n8n workflow integration
│
└── test-harnesses/
    ├── framework/               # Bash test runner + assertion library
    └── corpus/                  # Test message + injection corpora
```

---

## Community Sources We've Referenced

These are the community resources that informed our patterns. If you authored any of these, we'd love your direct review:

- [digitalknk's OpenClaw Runbook](https://gist.github.com/digitalknk/ec360aab27ca47cb4106a183b2c25a98) — Cost optimization, heartbeat rotation, Todoist integration
- [digitalknk's Config Example](https://gist.github.com/digitalknk/4169b59d01658e20002a093d544eb391) — Production openclaw.json reference
- [aimaker's Security Hardening Guide](https://aimaker.substack.com/p/openclaw-security-hardening-guide) — Three-tier hardening, LiteLLM brokering, container sandboxing
- [Molt Founders Configuration Guide](https://moltfounders.com/openclaw-configuration) — Complete openclaw.json reference
- [Molt Founders Runbook](https://moltfounders.com/openclaw-runbook) — Production deployment and operations
- [VittoStack's Security Guide](https://x.com/VittoStack/status/2018326274440073499) — Pi + Tailscale + Matrix E2E setup
- [alex_prompter's System Prompt](https://x.com/alex_prompter/status/2017982342854218005) — Cost awareness + security guardrails
- [kitze's Anti-Memory Approach](https://x.com/thekitze/status/2017931205946274183) — Minimalist agent configuration philosophy
- [OpenClaw Memory Deep Dive](https://snowan.gitbook.io/study-notes/ai-blogs/openclaw-memory-system-deep-dive) — Memory architecture analysis
- [Nader Dabit's Mission Control](https://x.com/dabit3/status/2018029884430233903) — 10-agent team orchestration
- [openclaw-secure-start](https://github.com/pottertech/openclaw-secure-start) — Security hardening automation
- [Pulumi + Tailscale Deployment](https://www.pulumi.com/blog/deploy-openclaw-aws-hetzner/) — Infrastructure-as-code deployment
- [OpenClaw Official Docs](https://docs.openclaw.ai) — Architecture reference

---

## How to Submit Feedback

**Option A: Inline comments** — Open issues or PRs on the repo with specific feedback per pattern.

**Option B: This document** — Add your notes below under your name. We'll incorporate everything.

**Option C: DM / voice** — Send unstructured thoughts and we'll synthesize.

---

## Reviewer Notes

### [Your Name] — [Date]
<!-- Add your feedback below -->

---

### [Your Name] — [Date]
<!-- Add your feedback below -->

---

*Thank you for reviewing. Every hour you spend on this saves hundreds of hours for operators who'd otherwise learn these lessons the hard way.*
