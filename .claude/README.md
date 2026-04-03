# Claude Code Scripts - CBF Planner

Scripts de automatización para garantizar integridad del trabajo entre sesiones concurrentes.

## 🚨 Problema que resuelven

En sesiones anteriores se perdió trabajo implementado porque:
- Se implementaron features
- Se probaron exitosamente
- Pero **nunca se commitearon**
- Otra sesión sobreescribió los cambios

Con múltiples sesiones de Claude Code trabajando en paralelo, **la falta de commits causa pérdida de trabajo**.

## 📜 Scripts disponibles

### `auto-commit.sh`
Commitea cambios automáticamente con formato estándar.

**Uso:**
```bash
./.claude/auto-commit.sh "feat(news): add image upload to textbook tab"
./.claude/auto-commit.sh "fix(editor): prevent modal close on outside click"
./.claude/auto-commit.sh "refactor(ai): extract date utilities to shared module"
./.claude/auto-commit.sh "WIP: implementing rubric generation"
```

**Qué hace:**
1. Muestra cambios pendientes (`git status -s`)
2. Hace `git add -A`
3. Commitea con el mensaje + `Co-Authored-By: Claude Opus 4.6`
4. Muestra confirmación del commit

**Cuándo usarlo:**
- ✅ Después de implementar cualquier feature (grande o pequeño)
- ✅ Después de completar un refactor verificado
- ✅ Después de aplicar un fix que funciona
- ✅ Después de actualizar documentación

### `session-end-check.sh`
Verifica que no haya cambios sin commitear antes de finalizar sesión.

**Uso:**
```bash
./.claude/session-end-check.sh
```

**Qué hace:**
1. Verifica `git status`
2. Si hay cambios → **BLOQUEA** (exit code 1) y muestra instrucciones
3. Si no hay cambios → **APRUEBA** (exit code 0)

**Cuándo usarlo:**
- ✅ **SIEMPRE** al final de cada sesión de Claude Code
- ✅ Antes de despedirse del usuario

## 🔄 Flujo de trabajo obligatorio

### Durante la sesión:
```bash
# 1. Implementar feature
# 2. Probar que funciona (npm run dev)
# 3. Commit inmediato
./.claude/auto-commit.sh "feat(scope): description"

# Repetir para cada feature...
```

### Al finalizar sesión:
```bash
# 1. Ejecutar verificación
./.claude/session-end-check.sh

# 2. Si falla → commitear cambios pendientes
./.claude/auto-commit.sh "WIP: description"

# 3. Volver a verificar
./.claude/session-end-check.sh
# ✅ Debe pasar antes de salir
```

## 📝 Formato de commits

```
feat(scope): add new feature
fix(scope): fix bug description
refactor(scope): refactor description
docs: update documentation
WIP: work in progress description
```

**Scopes comunes:**
- `news` — NEWS projects, rubrics, learning targets
- `editor` — GuideEditorPage, RichEditor, sections
- `ai` — AIAssistant.js, prompts, AI functions
- `export` — HTML/DOCX/PDF export
- `auth` — Authentication, roles, permissions
- `perf` — Performance optimizations
- `a11y` — Accessibility improvements
- `smartblocks` — SmartBlocks components

## ⚠️ Reglas no negociables

1. **NUNCA** salir de sesión con `git status` mostrando cambios
2. **SIEMPRE** commitear features probados antes de continuar con otro
3. **NO** acumular múltiples features sin commitear
4. **SÍ** hacer commits frecuentes (uno por feature)

## 🔗 Ver también

- `CLAUDE.md` — Políticas completas de commits
- `.claude-session-checklist.md` — Checklist de inicio/fin de sesión
