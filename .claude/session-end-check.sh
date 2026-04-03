#!/bin/bash
# Session end verification script
# Checks for uncommitted changes before ending Claude session

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Verificación de fin de sesión...${NC}\n"

# Check git status
if [[ -z $(git status -s) ]]; then
  echo -e "${GREEN}✅ No hay cambios sin commitear${NC}"
  echo -e "${GREEN}✅ Sesión lista para finalizar${NC}"
  exit 0
fi

# There are uncommitted changes
echo -e "${RED}⚠️  ALERTA: Hay cambios sin commitear${NC}\n"
git status --short

echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${RED}🚨 NO PUEDES SALIR DE LA SESIÓN${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

echo -e "${YELLOW}Opciones:${NC}"
echo -e "  1. Commitear cambios completos:"
echo -e "     ${GREEN}./.claude/auto-commit.sh \"feat(scope): descripción\"${NC}"
echo -e ""
echo -e "  2. Si el trabajo está a medias (WIP):"
echo -e "     ${GREEN}./.claude/auto-commit.sh \"WIP: descripción\"${NC}"
echo -e ""
echo -e "  3. Guardar cambios temporalmente:"
echo -e "     ${GREEN}git stash save \"descripción del trabajo\"${NC}"

exit 1
