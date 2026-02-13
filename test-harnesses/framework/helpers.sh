#!/bin/bash
# OpenClaw Operations Playbook — Test Helpers
# Source this in every test script: source "$(dirname "$0")/../framework/helpers.sh"

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Counters
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

# Test workspace
TEST_WORKSPACE="${TEST_WORKSPACE:-/tmp/openclaw-test-workspace}"

# --- Setup Functions ---

setup_test_workspace() {
  rm -rf "$TEST_WORKSPACE"
  mkdir -p "$TEST_WORKSPACE/memory"
  echo "Test workspace created at $TEST_WORKSPACE"
}

cleanup_test_workspace() {
  rm -rf "$TEST_WORKSPACE"
}

check_openclaw_installed() {
  if ! command -v openclaw &> /dev/null; then
    echo -e "${YELLOW}[SKIP] OpenClaw not installed — skipping integration tests${NC}"
    exit 0
  fi
}

check_gateway_running() {
  if ! curl -s http://127.0.0.1:18789/health &> /dev/null; then
    echo -e "${YELLOW}[SKIP] Gateway not running — skipping integration tests${NC}"
    exit 0
  fi
}

# --- Assertion Functions ---

assert_file_exists() {
  local path="$1"
  local msg="$2"
  if [ -f "$path" ]; then
    echo -e "${GREEN}[PASS]${NC} $msg"
    ((PASS_COUNT++))
  else
    echo -e "${RED}[FAIL]${NC} $msg (file not found: $path)"
    ((FAIL_COUNT++))
  fi
}

assert_file_not_exists() {
  local path="$1"
  local msg="$2"
  if [ ! -f "$path" ]; then
    echo -e "${GREEN}[PASS]${NC} $msg"
    ((PASS_COUNT++))
  else
    echo -e "${RED}[FAIL]${NC} $msg (file exists: $path)"
    ((FAIL_COUNT++))
  fi
}

assert_dir_exists() {
  local path="$1"
  local msg="$2"
  if [ -d "$path" ]; then
    echo -e "${GREEN}[PASS]${NC} $msg"
    ((PASS_COUNT++))
  else
    echo -e "${RED}[FAIL]${NC} $msg (directory not found: $path)"
    ((FAIL_COUNT++))
  fi
}

assert_file_contains() {
  local path="$1"
  local string="$2"
  local msg="$3"
  if grep -q "$string" "$path" 2>/dev/null; then
    echo -e "${GREEN}[PASS]${NC} $msg"
    ((PASS_COUNT++))
  else
    echo -e "${RED}[FAIL]${NC} $msg (string not found in $path)"
    ((FAIL_COUNT++))
  fi
}

assert_file_not_contains() {
  local path="$1"
  local string="$2"
  local msg="$3"
  if ! grep -q "$string" "$path" 2>/dev/null; then
    echo -e "${GREEN}[PASS]${NC} $msg"
    ((PASS_COUNT++))
  else
    echo -e "${RED}[FAIL]${NC} $msg (string found in $path)"
    ((FAIL_COUNT++))
  fi
}

assert_exit_code() {
  local expected="$1"
  shift
  local msg="${@: -1}"
  local cmd="${@:1:$#-1}"
  local actual
  set +e
  eval "$cmd" &>/dev/null
  actual=$?
  set -e
  if [ "$actual" -eq "$expected" ]; then
    echo -e "${GREEN}[PASS]${NC} $msg"
    ((PASS_COUNT++))
  else
    echo -e "${RED}[FAIL]${NC} $msg (expected exit $expected, got $actual)"
    ((FAIL_COUNT++))
  fi
}

assert_output_contains() {
  local string="$1"
  shift
  local msg="${@: -1}"
  local cmd="${@:1:$#-1}"
  local output
  set +e
  output=$(eval "$cmd" 2>&1)
  set -e
  if echo "$output" | grep -q "$string"; then
    echo -e "${GREEN}[PASS]${NC} $msg"
    ((PASS_COUNT++))
  else
    echo -e "${RED}[FAIL]${NC} $msg (output does not contain: $string)"
    ((FAIL_COUNT++))
  fi
}

assert_output_matches() {
  local regex="$1"
  shift
  local msg="${@: -1}"
  local cmd="${@:1:$#-1}"
  local output
  set +e
  output=$(eval "$cmd" 2>&1)
  set -e
  if echo "$output" | grep -qE "$regex"; then
    echo -e "${GREEN}[PASS]${NC} $msg"
    ((PASS_COUNT++))
  else
    echo -e "${RED}[FAIL]${NC} $msg (output does not match: $regex)"
    ((FAIL_COUNT++))
  fi
}

assert_line_count_under() {
  local path="$1"
  local max="$2"
  local msg="$3"
  local count
  count=$(wc -l < "$path" 2>/dev/null || echo "0")
  count=$(echo "$count" | tr -d ' ')
  if [ "$count" -lt "$max" ]; then
    echo -e "${GREEN}[PASS]${NC} $msg ($count lines)"
    ((PASS_COUNT++))
  else
    echo -e "${RED}[FAIL]${NC} $msg ($count lines, max $max)"
    ((FAIL_COUNT++))
  fi
}

assert_file_size_under() {
  local path="$1"
  local max_kb="$2"
  local msg="$3"
  local size_kb
  if [ -f "$path" ]; then
    size_kb=$(du -k "$path" | cut -f1)
    if [ "$size_kb" -lt "$max_kb" ]; then
      echo -e "${GREEN}[PASS]${NC} $msg (${size_kb}KB)"
      ((PASS_COUNT++))
    else
      echo -e "${RED}[FAIL]${NC} $msg (${size_kb}KB, max ${max_kb}KB)"
      ((FAIL_COUNT++))
    fi
  else
    echo -e "${RED}[FAIL]${NC} $msg (file not found: $path)"
    ((FAIL_COUNT++))
  fi
}

assert_no_secrets() {
  local path="$1"
  local msg="$2"
  local found=0

  # Common secret patterns
  local patterns=(
    "sk-[a-zA-Z0-9]{20,}"
    "AKIA[0-9A-Z]{16}"
    "ghp_[a-zA-Z0-9]{36}"
    "-----BEGIN.*PRIVATE KEY-----"
    "password\s*[:=]\s*['\"][^'\"]{8,}"
    "token\s*[:=]\s*['\"][^'\"]{20,}"
    "api[_-]?key\s*[:=]\s*['\"][^'\"]{10,}"
  )

  for pattern in "${patterns[@]}"; do
    if grep -rqE "$pattern" "$path" 2>/dev/null; then
      echo -e "${RED}[FAIL]${NC} $msg (potential secret found matching: $pattern)"
      ((FAIL_COUNT++))
      found=1
      break
    fi
  done

  if [ "$found" -eq 0 ]; then
    echo -e "${GREEN}[PASS]${NC} $msg"
    ((PASS_COUNT++))
  fi
}

# --- Results ---

print_results() {
  echo ""
  echo "================================"
  echo -e "Results: ${GREEN}$PASS_COUNT passed${NC}, ${RED}$FAIL_COUNT failed${NC}, ${YELLOW}$SKIP_COUNT skipped${NC}"
  echo "================================"

  if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
  fi
  exit 0
}
