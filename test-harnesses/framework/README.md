# Test Harness Framework

Reproducible validation for OpenClaw operational patterns.

## Philosophy

Every pattern in this repo must be testable. A pattern without a test harness is an opinion, not a pattern.

## Framework Structure

```
test-harnesses/
├── framework/
│   ├── README.md          # This file
│   ├── runner.sh          # Main test runner
│   ├── helpers.sh         # Shared assertion functions
│   └── setup.sh           # Environment setup and validation
├── corpus/
│   ├── messages/          # Standard message corpus for testing
│   ├── injections/        # Adversarial prompt injection samples
│   └── edge-cases/        # Edge case inputs
├── results/
│   └── .gitkeep           # Example results go here
├── soul/                  # Tests for soul/ patterns
├── agents/                # Tests for agents/ patterns
├── memory/                # Tests for memory/ patterns
├── context/               # Tests for context/ patterns
├── tools/                 # Tests for tools/ patterns
├── security/              # Tests for security/ patterns
├── operations/            # Tests for operations/ patterns
└── gateway/               # Tests for gateway/ patterns
```

## Running Tests

### Run all tests
```bash
./test-harnesses/framework/runner.sh
```

### Run tests for a specific category
```bash
./test-harnesses/framework/runner.sh --category memory
```

### Run a specific test
```bash
./test-harnesses/framework/runner.sh --test memory/pre-compaction-memory-flush
```

## Writing Tests

### Test Structure

Every test script should:

1. Source the helpers: `source "$(dirname "$0")/../framework/helpers.sh"`
2. Define what it validates in a comment block
3. Use assertion functions from helpers.sh
4. Exit 0 on all pass, non-zero on any failure
5. Print clear PASS/FAIL output per assertion

### Example Test

```bash
#!/bin/bash
# Test: pre-compaction-memory-flush
# Validates: Critical context persists through compaction cycles

source "$(dirname "$0")/../framework/helpers.sh"

setup_test_workspace

# Test 1: MEMORY.md structure includes persistence section
assert_file_contains "$WORKSPACE/MEMORY.md" "## Persist Before Compaction" \
  "MEMORY.md has persistence section"

# Test 2: Pre-compaction flush fires before threshold
simulate_context_fill 0.85
assert_file_modified_after "$WORKSPACE/MEMORY.md" "$FILL_TIMESTAMP" \
  "Memory flush triggered before compaction"

# Test 3: Critical facts survive compaction
trigger_compaction
assert_file_contains "$WORKSPACE/MEMORY.md" "$CRITICAL_FACT" \
  "Critical fact persisted through compaction"

print_results
```

## Assertion Functions

Available in `helpers.sh`:

| Function | Description |
|----------|-------------|
| `assert_file_exists <path> <msg>` | File exists at path |
| `assert_file_not_exists <path> <msg>` | File does not exist |
| `assert_file_contains <path> <string> <msg>` | File contains string |
| `assert_file_not_contains <path> <string> <msg>` | File does not contain string |
| `assert_exit_code <expected> <command> <msg>` | Command exits with expected code |
| `assert_output_contains <string> <command> <msg>` | Command output contains string |
| `assert_output_matches <regex> <command> <msg>` | Command output matches regex |
| `assert_line_count_under <path> <max> <msg>` | File has fewer than max lines |
| `assert_file_size_under <path> <max_kb> <msg>` | File smaller than max KB |
| `print_results` | Print summary and exit with appropriate code |

## Environment Requirements

- OpenClaw installed and configured
- Gateway running (for integration tests)
- Test workspace directory (created by `setup.sh`)
- Bash 4.0+ (for associative arrays)

## Test Categories

### Unit Tests (no running agent needed)
- File structure validation
- Config syntax checking
- Script functionality

### Integration Tests (requires running agent)
- Agent behavior validation
- Memory persistence verification
- Context window management

### Adversarial Tests (requires running agent + corpus)
- Prompt injection defense
- Secret leak detection
- Boundary enforcement

## Contributing Tests

When submitting a pattern, include a test in the matching category directory. Tests are required for pattern promotion from `draft` to `tested`.
