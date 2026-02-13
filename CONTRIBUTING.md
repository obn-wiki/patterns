# Contributing to OpenClaw Operations Playbook

We want patterns that operators can trust at 3am. Quality over quantity, always.

## What Makes a Good Pattern

A good pattern submission:

1. **Solves a real operational problem** — not a tutorial, not a demo trick
2. **Documents failure modes** — the happy path is easy; what breaks?
3. **Includes a test harness** — reproducible validation, not "trust me"
4. **Pins to an OpenClaw version** — so operators know if it applies to them
5. **Shows evidence** — logs, metrics, or concrete outcomes from real usage

## What We Don't Want

- Theoretical patterns nobody has run in production
- Patterns that duplicate existing ones without material improvement
- "Awesome list" style link collections
- Vendor-specific patterns that only work with one provider
- Patterns without failure mode documentation

## Submission Process

### 1. Check for Duplicates

Search existing patterns first:
```bash
grep -r "your topic" patterns/
```

If a similar pattern exists, consider improving it instead of creating a new one.

### 2. Use the Template

Copy [PATTERN_TEMPLATE.md](PATTERN_TEMPLATE.md) and fill in every section. Incomplete submissions will be returned for revision.

### 3. Choose the Right Category

| Category | For patterns about... |
|----------|----------------------|
| `soul/` | SOUL.md personality, behavioral boundaries, tone calibration |
| `agents/` | AGENTS.md routing, multi-agent setups, workspace isolation |
| `memory/` | MEMORY.md, daily logs, compaction, vector search, knowledge bases |
| `context/` | Context window management, file injection, `/compact` strategies |
| `tools/` | TOOLS.md config, tool batching, rate limiting |
| `security/` | Prompt injection defense, secret management, data isolation |
| `operations/` | HEARTBEAT.md, cron jobs, monitoring, overnight execution |
| `gateway/` | Multi-channel routing, session management, remote access |

### 4. Name Your File

Use kebab-case: `patterns/memory/pre-compaction-memory-flush.md`

### 5. Include a Test Harness

Place test scripts in `test-harnesses/[category]/[pattern-name].sh`. Tests should:
- Be runnable with a single command
- Exit 0 on pass, non-zero on fail
- Print clear pass/fail output
- Document any required setup (API keys, running gateway, etc.)

### 6. Submit a PR

```bash
git checkout -b pattern/your-pattern-name
# Add your pattern + test harness
git commit -m "pattern: add [category]/[pattern-name]"
git push -u origin pattern/your-pattern-name
# Open PR using the template below
```

## PR Template

```markdown
## Pattern Submission

**Category:** [e.g., memory]
**Pattern:** [e.g., pre-compaction-memory-flush]
**OpenClaw Version:** [e.g., v0.42+]

### Checklist

- [ ] Used PATTERN_TEMPLATE.md format
- [ ] Documented at least 2 failure modes
- [ ] Included test harness script
- [ ] Pinned to OpenClaw version
- [ ] Provided evidence (logs/metrics/outcomes)
- [ ] Checked for duplicate patterns
- [ ] Tested on my own OpenClaw instance

### Summary
[1-2 sentences on what this pattern solves]

### Evidence
[Brief description of where/how you validated this]
```

## Review Criteria

Reviewers check:

| Criteria | Required? | Notes |
|----------|-----------|-------|
| Solves real problem | Yes | Not theoretical or demo-only |
| Complete template | Yes | All sections filled |
| Failure modes documented | Yes | Minimum 2 |
| Test harness included | Yes | Must be runnable |
| Version pinned | Yes | Specific OpenClaw version |
| Evidence provided | Yes | Logs, metrics, or outcomes |
| No secrets in config | Yes | Placeholder values only |
| Independent validation | Preferred | Another operator confirmed it works |

## Pattern Lifecycle

```
draft → tested → stable → deprecated
```

- **draft**: Submitted, not yet independently validated
- **tested**: At least one operator besides the author has validated it
- **stable**: 3+ validations, no known regressions for 30+ days
- **deprecated**: Superseded or broken by OpenClaw updates

## Improving Existing Patterns

Found a problem with an existing pattern? PRs welcome for:

- Adding failure modes you discovered
- Updating for newer OpenClaw versions
- Adding test harness coverage
- Providing additional evidence
- Fixing inaccuracies

When improving a pattern, add yourself to the Contributors section.

## Code of Conduct

- Be helpful, not performative
- Critique patterns, not people
- If you break something, document what happened — that's valuable data
- Respond to reviews constructively

## Questions?

Open a Discussion or file an Issue. We respond within 24 hours.
