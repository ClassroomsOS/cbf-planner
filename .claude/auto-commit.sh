#!/bin/bash
# Auto-commit script for Claude Code sessions
# Usage: ./.claude/auto-commit.sh "feat(scope): description"

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if commit message provided
if [ -z "$1" ]; then
  echo -e "${RED}❌ Error: Commit message required${NC}"
  echo "Usage: ./.claude/auto-commit.sh \"feat(scope): description\""
  exit 1
fi

COMMIT_MSG="$1"

# Check if there are changes
if [[ -z $(git status -s) ]]; then
  echo -e "${YELLOW}⚠️  No changes to commit${NC}"
  exit 0
fi

# Show what will be committed
echo -e "${YELLOW}📋 Changes to commit:${NC}"
git status --short

# Add all changes
echo -e "\n${YELLOW}📦 Staging changes...${NC}"
git add -A

# Commit with provided message
echo -e "${YELLOW}💾 Committing...${NC}"
git commit -m "$COMMIT_MSG

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

echo -e "${GREEN}✅ Committed successfully!${NC}"
echo -e "${GREEN}📝 Message: $COMMIT_MSG${NC}"

# Show last commit
echo -e "\n${YELLOW}Last commit:${NC}"
git log -1 --oneline
