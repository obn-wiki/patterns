#!/bin/bash
# OpenClaw Operations Playbook — Test Runner
# Usage:
#   ./runner.sh                          # Run all tests
#   ./runner.sh --category memory        # Run tests in a category
#   ./runner.sh --test memory/secret-free # Run a specific test

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HARNESS_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

# Parse arguments
CATEGORY=""
SPECIFIC_TEST=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --category)
      CATEGORY="$2"
      shift 2
      ;;
    --test)
      SPECIFIC_TEST="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: runner.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --category <name>    Run tests in a specific category"
      echo "  --test <cat/name>    Run a specific test"
      echo "  --help, -h           Show this help"
      echo ""
      echo "Categories: soul, agents, memory, context, tools, security, operations, gateway"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Collect test files
TESTS=()

if [ -n "$SPECIFIC_TEST" ]; then
  TEST_FILE="$HARNESS_ROOT/$SPECIFIC_TEST.sh"
  if [ -f "$TEST_FILE" ]; then
    TESTS+=("$TEST_FILE")
  else
    echo -e "${RED}Test not found: $TEST_FILE${NC}"
    exit 1
  fi
elif [ -n "$CATEGORY" ]; then
  if [ -d "$HARNESS_ROOT/$CATEGORY" ]; then
    while IFS= read -r -d '' file; do
      TESTS+=("$file")
    done < <(find "$HARNESS_ROOT/$CATEGORY" -name "*.sh" -type f -print0 | sort -z)
  else
    echo -e "${RED}Category not found: $CATEGORY${NC}"
    exit 1
  fi
else
  # All categories
  for category in soul agents memory context tools security operations gateway; do
    if [ -d "$HARNESS_ROOT/$category" ]; then
      while IFS= read -r -d '' file; do
        TESTS+=("$file")
      done < <(find "$HARNESS_ROOT/$category" -name "*.sh" -type f -print0 | sort -z)
    fi
  done
fi

if [ ${#TESTS[@]} -eq 0 ]; then
  echo -e "${YELLOW}No test files found.${NC}"
  exit 0
fi

# Run tests
TOTAL=0
PASSED=0
FAILED=0
SKIPPED=0

echo -e "${BOLD}OpenClaw Operations Playbook — Test Runner${NC}"
echo "================================================"
echo ""

for test_file in "${TESTS[@]}"; do
  relative_path="${test_file#$HARNESS_ROOT/}"
  ((TOTAL++))

  echo -e "${BOLD}Running: $relative_path${NC}"

  set +e
  output=$(bash "$test_file" 2>&1)
  exit_code=$?
  set -e

  echo "$output" | sed 's/^/  /'

  if [ $exit_code -eq 0 ]; then
    ((PASSED++))
  elif echo "$output" | grep -q "\[SKIP\]"; then
    ((SKIPPED++))
  else
    ((FAILED++))
  fi

  echo ""
done

# Summary
echo "================================================"
echo -e "${BOLD}Summary${NC}"
echo -e "  Total:   $TOTAL"
echo -e "  ${GREEN}Passed:  $PASSED${NC}"
echo -e "  ${RED}Failed:  $FAILED${NC}"
echo -e "  ${YELLOW}Skipped: $SKIPPED${NC}"
echo "================================================"

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
exit 0
