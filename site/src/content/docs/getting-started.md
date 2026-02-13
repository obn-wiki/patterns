---
title: Getting Started
description: How to use the OBN pattern library for your OpenClaw agent.
---

## Find Your Pattern

**Option 1: Browse by category.** Use the sidebar to navigate 8 categories — Soul, Agents, Memory, Context, Tools, Security, Operations, Gateway.

**Option 2: Search.** Use the search bar (top of page) to find patterns by keyword — try "compaction", "injection", or "heartbeat".

**Option 3: Start from your problem.** Pick the path that matches your situation:

### I need security NOW

If your agent is on a server, processes email, or runs unattended — start here:

1. **[Gateway Hardening](/patterns/security/gateway-hardening/)** — Lock down the WebSocket server. Bind address, token auth, firewall, Tailscale.
2. **[Tool Policy Lockdown](/patterns/security/tool-policy-lockdown/)** — Least-privilege tool access. Block dangerous commands mechanically.
3. **[Prompt Injection Defense](/patterns/security/prompt-injection-defense/)** — Authority model in SOUL.md. Define who can give instructions.
4. **[Native Guardrails Integration](/patterns/security/native-guardrails-integration/)** (v2026.2.1+) — Layer your rules with OpenClaw's built-in defenses.
5. **[Skill/Plugin Security Vetting](/patterns/security/skill-plugin-security-vetting/)** (v2026.2.6+) — Three-gate process for evaluating ClawHub skills.

### My agent keeps losing context

If your agent forgets tasks after compaction or loses critical state:

1. **[Pre-Compaction Memory Flush](/patterns/memory/pre-compaction-memory-flush/)** — Save active tasks, decisions, and commitments before compaction.
2. **[Compaction Strategy for 24/7 Agents](/patterns/context/compaction-strategy-for-24-7-agents/)** — Optimize when and how compaction happens.
3. **[Window Budget Management](/patterns/context/window-budget-management/)** — Allocate your context window wisely (15/65/20 rule).

### This is costing too much

If your monthly API bill is higher than expected:

1. **[Cheap Model Coordinator](/patterns/operations/cheap-model-coordinator/)** — The single biggest savings. Haiku as default, Sonnet for complex only. 70-80% reduction.
2. **[Cost Optimization Strategies](/patterns/operations/cost-optimization-strategies/)** — 7 strategies ranked by ROI with a monthly cost estimator.
3. **[Heartbeat Checklist Design](/patterns/operations/heartbeat-checklist-design/)** — Stop burning tokens on verbose health checks.

### I want to run my agent 24/7

If you're moving from interactive use to always-on operation:

1. **[Overnight Autonomous Execution](/patterns/operations/overnight-autonomous-execution/)** — Decision framework for unattended operation.
2. **[Health Monitoring and Alerting](/patterns/operations/health-monitoring-and-alerting/)** — Four-level health check pyramid.
3. **[Production Gateway Deployment](/patterns/gateway/production-gateway-deployment/)** — systemd/Docker/cloud deployment configs.

## Use a Pattern

Each pattern follows the same structure:

1. **Read the Problem** — confirm this matches your situation.
2. **Check Context** — "Use when" / "Don't use when" / "Prerequisites."
3. **Check the Version** — make sure your OpenClaw version meets the minimum (see [Version Matrix](/reference/version-matrix/)).
4. **Copy the Implementation** — each pattern has copy-paste-ready `SOUL.md`, `openclaw.json`, and `HEARTBEAT.md` configs.
5. **Run the Test Harness** — validate your setup: `./test-harnesses/framework/runner.sh --test <category>/<pattern>`
6. **Review Failure Modes** — know what can still go wrong.
7. **Follow cross-links** — patterns reference related patterns. Follow them for defense-in-depth.

## Contribute a Pattern

See [Contributing](/contributing/) for the full guide. The short version:

1. Fork the repo
2. Copy `PATTERN_TEMPLATE.md` to `patterns/<category>/your-pattern.md`
3. Fill in all sections (Problem, Context, Implementation, Failure Modes, Test Harness, Evidence)
4. Submit a PR

You don't need to know anything about the site build — just write markdown. The site rebuilds automatically.
