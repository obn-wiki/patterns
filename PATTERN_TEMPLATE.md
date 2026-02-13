# Pattern Template

Use this template for all new pattern submissions. Copy this file and fill in each section.

---

```markdown
# Pattern: [Descriptive Name]

> Category: [soul | agents | memory | context | tools | security | operations | gateway]
> Status: [draft | tested | stable | deprecated]
> OpenClaw Version: [e.g., v0.42+]
> Last Validated: [YYYY-MM-DD]

## Problem

[1-3 sentences. What operational problem does this solve? Be specific about the failure mode
or inefficiency that operators encounter without this pattern.]

## Context

**Use when:**
- [Condition 1]
- [Condition 2]

**Don't use when:**
- [Condition where this pattern is wrong or overkill]

**Prerequisites:**
- [Any required OpenClaw features, config, or infrastructure]

## Implementation

[Full, copy-paste-ready config. Include the relevant files (SOUL.md, AGENTS.md,
HEARTBEAT.md, openclaw.json, etc.) with inline comments explaining non-obvious choices.]

### [Config File 1] (e.g., SOUL.md snippet)

```markdown
[Full config snippet here]
```

### [Config File 2] (e.g., openclaw.json snippet)

```json5
{
  // Annotated config
}
```

### Setup Steps

1. [Step 1]
2. [Step 2]
3. [Verification step — how to confirm it's working]

## Failure Modes

| Failure | Cause | Symptom | Mitigation |
|---------|-------|---------|------------|
| [Name] | [Root cause] | [What the operator sees] | [How to fix or prevent] |

## Test Harness

**Script:** `test-harnesses/[category]/[pattern-name].sh`

**What it validates:**
- [Assertion 1]
- [Assertion 2]

**How to run:**

```bash
[Command to execute the test]
```

**Expected output:**

```
[Example passing output]
```

## Evidence

**Environment:** [OS, OpenClaw version, model provider, uptime duration]

**Metrics:**
- [Metric 1: value]
- [Metric 2: value]

**Example log excerpt:**

```
[Relevant log lines showing the pattern working correctly]
```

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| [Other approach] | [Tradeoff that made this pattern better for the stated context] |

## Contributors

- [@handle](https://github.com/handle) — [role: original author / validated / improved]
```
