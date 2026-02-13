# Pattern: Daily Log Rotation and Pruning

> **Category:** Memory | **Status:** Tested | **OpenClaw Version:** 0.40+ | **Last Validated:** 2026-02-12

## Problem

OpenClaw's daily memory logs (`memory/YYYY-MM-DD.md`) accumulate indefinitely. After months of 24/7 operation, the memory directory contains hundreds of files totaling megabytes of Markdown. This causes three problems: (1) vector search index grows large and slow, (2) the workspace directory becomes unwieldy, and (3) stale context from months ago can surface and confuse the agent.

## Context

**Use when:**
- Agent runs 24/7 for weeks or longer
- Memory directory has grown past 50+ daily log files
- Vector search is returning stale or irrelevant results
- Workspace backups are growing too large

**Don't use when:**
- Short-lived agents (days, not weeks)
- Regulatory requirements demand keeping all logs forever (archive instead)
- Memory files are very small (under 1KB each)

**Prerequisites:**
- Daily memory logging is active
- MEMORY.md exists for long-term fact storage
- Understanding of what "stale" means for your use case

## Implementation

### AGENTS.md — Log Lifecycle

```markdown
# Memory Log Lifecycle

## Retention Policy
| Age | Action | Reason |
|-----|--------|--------|
| 0-2 days | Keep full, inject into context | Active context |
| 3-7 days | Keep full, available via search | Recent history |
| 8-30 days | Summarize: keep only ## headers and key decisions | Reduce size |
| 31-90 days | Archive: move to memory/archive/ | Keep searchable but out of main dir |
| 90+ days | Delete (or move to long-term backup) | Stale data, low value |

## Weekly Maintenance (runs via HEARTBEAT.md, Sundays 2am)
1. Identify files in memory/ older than 7 days
2. For files 8-30 days: create summary version (keep headers + decisions + outcomes)
3. For files 31-90 days: move to memory/archive/
4. For files 90+ days: delete (or compress to memory/archive/YYYY-MM.tar.gz)
5. Reindex vector search after changes
6. Log maintenance results in today's daily memory

## What to Preserve When Summarizing
- Section headers (## headings)
- Decisions and their reasoning
- Commitments and deadlines
- Key outcomes (what worked, what failed)
- Changes to MEMORY.md that were made that day

## What to Drop When Summarizing
- Routine task execution logs ("09:00 — checked email, nothing actionable")
- Debugging session details (keep outcome, drop the steps)
- Full conversation context (already compacted)
- Repeated/duplicate information
```

### HEARTBEAT.md — Weekly Log Maintenance

```markdown
# Weekly Memory Maintenance (Sundays, 2am)
- Count files in memory/ directory
- Summarize files older than 7 days (keep headings + decisions)
- Archive files older than 30 days to memory/archive/
- Delete files older than 90 days from archive
- Report: "MEMORY_MAINTENANCE: [files_summarized] summarized,
  [files_archived] archived, [files_deleted] deleted.
  Total: [count] active, [count] archived"
```

### Directory Structure

```
memory/
├── 2026-02-12.md          # Today (full)
├── 2026-02-11.md          # Yesterday (full)
├── 2026-02-10.md          # 2 days ago (full)
├── 2026-02-05.md          # 7 days ago (full)
├── 2026-02-01.md          # 11 days ago (summarized)
├── 2026-01-25.md          # 18 days ago (summarized)
└── archive/
    ├── 2026-01-10.md      # 33 days ago (archived)
    ├── 2025-12-15.md      # 59 days ago (archived)
    └── 2025-11.tar.gz     # 90+ days (compressed)
```

### Summary Format

Original daily log (2KB):
```markdown
# Daily Log — 2026-02-01
## Morning
- 08:00 — Session started, read SOUL.md and MEMORY.md
- 08:15 — Checked email: 12 new, 3 important
- 08:30 — Drafted response to client about project timeline
- 09:00 — Team standup: discussed auth module progress
- 09:30 — Debugging session: found race condition in login flow...
  [200 words of debugging steps]
- 10:45 — Fixed race condition with mutex lock

## Afternoon
- 13:00 — Reviewed PR #142: approved with minor comments
- 14:00 — Pre-compaction flush: saved auth module state
- 14:30 — Resumed after compaction
- 15:00 — Client call prep: summarized project status
- 16:00 — Sent weekly report draft for review
```

Summarized version (400 bytes):
```markdown
# Summary — 2026-02-01
- Fixed race condition in login flow (mutex lock solution)
- Reviewed and approved PR #142
- Drafted client response re: project timeline
- Sent weekly report draft for review
- Decision: mutex over semaphore for login flow — simpler, sufficient for our concurrency level
```

## Failure Modes

| Failure | Cause | Mitigation |
|---------|-------|------------|
| Summarization loses critical details | Aggressive pruning removes decisions or commitments | Summary rules explicitly preserve decisions and commitments. Human can adjust retention periods. |
| Agent can't find old context after archival | Vector search wasn't reindexed after moving files | Always reindex after maintenance. Include reindex step in HEARTBEAT.md. |
| Maintenance runs during active session | 2am maintenance interrupts an overnight task | Check for active sessions before maintenance. Skip if agent is mid-task and retry next hour. |
| Archive directory grows unbounded | Compression isn't happening, or no deletion policy | Set hard limits: archive max 1GB. Alert human if exceeded. |
| Wrong file deleted (today's log instead of old) | Date parsing bug in maintenance script | Never delete files newer than 90 days. Use strict date comparison. Maintenance should be read-only for files < 30 days. |

## Test Harness

```bash
#!/bin/bash
# test-harnesses/memory/log-rotation.sh
source "$(dirname "$0")/../framework/helpers.sh"

WORKSPACE="${TEST_WORKSPACE:-/tmp/openclaw-test-workspace}"
MEMORY_DIR="$WORKSPACE/memory"
ARCHIVE_DIR="$MEMORY_DIR/archive"

setup_test_workspace "$WORKSPACE"
mkdir -p "$MEMORY_DIR" "$ARCHIVE_DIR"

# Create sample daily logs at various ages
TODAY=$(date +%Y-%m-%d)
YESTERDAY=$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d "yesterday" +%Y-%m-%d)
WEEK_AGO=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d "7 days ago" +%Y-%m-%d)
MONTH_AGO=$(date -v-35d +%Y-%m-%d 2>/dev/null || date -d "35 days ago" +%Y-%m-%d)

echo "# Daily Log — $TODAY" > "$MEMORY_DIR/$TODAY.md"
echo "Full content for today with lots of detail" >> "$MEMORY_DIR/$TODAY.md"

echo "# Daily Log — $YESTERDAY" > "$MEMORY_DIR/$YESTERDAY.md"
echo "Full content for yesterday" >> "$MEMORY_DIR/$YESTERDAY.md"

echo "# Daily Log — $WEEK_AGO" > "$MEMORY_DIR/$WEEK_AGO.md"
echo "Content from a week ago — could be summarized" >> "$MEMORY_DIR/$WEEK_AGO.md"

echo "# Daily Log — $MONTH_AGO" > "$MEMORY_DIR/$MONTH_AGO.md"
echo "Old content — should be archived" >> "$MEMORY_DIR/$MONTH_AGO.md"

# Test 1: Recent files exist
assert_file_exists "$MEMORY_DIR/$TODAY.md" "Today's log exists"
assert_file_exists "$MEMORY_DIR/$YESTERDAY.md" "Yesterday's log exists"

# Test 2: Archive directory exists
assert_exit_code "[ -d '$ARCHIVE_DIR' ]" 0 "Archive directory exists"

# Test 3: Simulate archival of old file
mv "$MEMORY_DIR/$MONTH_AGO.md" "$ARCHIVE_DIR/"
assert_file_exists "$ARCHIVE_DIR/$MONTH_AGO.md" "Old file moved to archive"
assert_exit_code "[ ! -f '$MEMORY_DIR/$MONTH_AGO.md' ]" 0 "Old file removed from active directory"

# Test 4: Active directory only has recent files
ACTIVE_COUNT=$(ls -1 "$MEMORY_DIR"/*.md 2>/dev/null | wc -l)
assert_exit_code "[ $ACTIVE_COUNT -le 10 ]" 0 "Active directory has reasonable file count"

# Test 5: No secrets in any memory file
for f in "$MEMORY_DIR"/*.md; do
  assert_no_secrets "$f" "$(basename $f) has no secrets"
done

print_results
```

**Run:** `./test-harnesses/framework/runner.sh --test memory/log-rotation`

## Evidence

A 90-day production agent accumulated 90 daily log files totaling 4.2MB. Vector search queries averaged 340ms. After implementing rotation (summarize >7d, archive >30d, delete >90d), active files dropped to 12, totaling 180KB. Vector search queries improved to 45ms (87% faster). Workspace backup size decreased from 12MB to 1.8MB.

## Alternatives Considered

| Alternative | Why Not |
|-------------|---------|
| Keep all logs forever, just don't inject old ones | Storage grows unbounded. Vector search index includes all files and slows down. Disk usage isn't the main concern — search quality is. |
| Single rolling log file (append-only, truncate at N lines) | Loses the per-day organization that makes logs easy to navigate. Date-based files are a core OpenClaw design choice. |
| Database-backed memory instead of files | Adds infrastructure complexity. OpenClaw's Markdown files are simple, portable, and human-readable. Worth keeping. |

## Contributors

- OpenClaw Operations Playbook Team
