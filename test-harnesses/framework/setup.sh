#!/bin/bash
# OpenClaw Operations Playbook — Test Environment Setup
# Run once before executing tests to verify your environment.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo "OpenClaw Test Environment Setup"
echo "================================"
echo ""

# Check bash version
BASH_VERSION_MAJOR="${BASH_VERSINFO[0]}"
if [ "$BASH_VERSION_MAJOR" -ge 4 ]; then
  echo -e "${GREEN}[OK]${NC} Bash version: $BASH_VERSION"
else
  echo -e "${RED}[FAIL]${NC} Bash 4.0+ required (found: $BASH_VERSION)"
fi

# Check OpenClaw
if command -v openclaw &> /dev/null; then
  OPENCLAW_VERSION=$(openclaw --version 2>/dev/null || echo "unknown")
  echo -e "${GREEN}[OK]${NC} OpenClaw installed: $OPENCLAW_VERSION"
else
  echo -e "${YELLOW}[WARN]${NC} OpenClaw not installed — integration tests will be skipped"
fi

# Check gateway
if curl -s --max-time 2 http://127.0.0.1:18789/health &> /dev/null; then
  echo -e "${GREEN}[OK]${NC} Gateway running on :18789"
else
  echo -e "${YELLOW}[WARN]${NC} Gateway not running — gateway tests will be skipped"
fi

# Check workspace
WORKSPACE="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}"
if [ -d "$WORKSPACE" ]; then
  echo -e "${GREEN}[OK]${NC} Workspace found: $WORKSPACE"
  if [ -f "$WORKSPACE/SOUL.md" ]; then
    echo -e "${GREEN}[OK]${NC} SOUL.md present"
  else
    echo -e "${YELLOW}[WARN]${NC} SOUL.md not found in workspace"
  fi
  if [ -f "$WORKSPACE/AGENTS.md" ]; then
    echo -e "${GREEN}[OK]${NC} AGENTS.md present"
  else
    echo -e "${YELLOW}[WARN]${NC} AGENTS.md not found in workspace"
  fi
else
  echo -e "${YELLOW}[WARN]${NC} Workspace not found at $WORKSPACE"
fi

# Check test harness structure
echo ""
echo "Test harness directories:"
for dir in soul agents memory context tools security operations gateway; do
  if [ -d "$SCRIPT_DIR/../$dir" ]; then
    count=$(find "$SCRIPT_DIR/../$dir" -name "*.sh" -type f 2>/dev/null | wc -l | tr -d ' ')
    echo -e "  ${GREEN}[OK]${NC} $dir/ ($count tests)"
  else
    echo -e "  ${YELLOW}[--]${NC} $dir/ (no tests yet)"
  fi
done

# Make scripts executable
echo ""
echo "Setting script permissions..."
find "$SCRIPT_DIR/.." -name "*.sh" -type f -exec chmod +x {} \;
echo -e "${GREEN}[OK]${NC} All .sh files made executable"

echo ""
echo "Setup complete. Run ./runner.sh to execute tests."
