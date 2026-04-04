# CLAUDE.md

> **"Nosotros Diseñamos. El docente enseña."**
> El diseño del sistema no debe ser abrumador para el profesor. Nosotros somos quienes diseñamos para ellos, para que sea fácil y deseable aplicar.

---

## 🔒 LEY FUNDAMENTAL DEL SISTEMA — NO BORRAR JAMÁS

> **Referencia completa:** `theoric mark/CBF_Analisis_Implementacion_Sistema.md` — consultar ante cualquier duda pedagógica.

### El trimestre es una cadena de hitos, no semanas sueltas.

```
INDICADOR DE LOGRO (creado al inicio del período)
      │
      ▼
PROYECTO NEWS (creado al inicio del período — INMUTABLE una vez publicado)
      │  due_date = fecha de presentación del proyecto
      │
      ▼
GUÍAS SEMANALES (todas las guías antes del due_date pertenecen a ese proyecto)
      │  Cada guía construye una competencia que el alumno necesita para el proyecto
      │
      ▼
EVALUACIÓN (la rúbrica mide si el alumno alcanzó el Indicador de Logro)
```

### Reglas que nunca cambian:

1. **El NEWS se crea a principio del período. Una vez publicado, no se modifica.**
2. **Cuando un indicador se enlaza a un proyecto NEWS, ese es el indicador-hito de todas las guías anteriores a la fecha de presentación.**
3. **El indicador activo de una guía semanal = el `target_indicador` del NEWS cuyo `due_date` es el más próximo en el futuro desde la semana de esa guía.**
4. **La IA genera guías con ese indicador como norte. El docente lo ve como label read-only — no puede cambiarlo.**
5. **`news_projects.target_id` es el vínculo más importante de toda la base de datos.**

### Reglas operativas (NO negociables):

- **Toda actividad evaluativa DEBE tener fecha.** El sistema no debe permitir guardar actividades sin `fecha`.
- **Modelo B = Language Arts, Social Studies, Science, Lingua Skill.** Definido en `MODELO_B_SUBJECTS` en `constants.js`.
- **Por ahora solo se trabaja Modelo B.**

### Lookup del indicador activo (implementado en `GuideEditorPage.jsx`):
- **Prioridad 1** — Modelo B: buscar `news_projects` cuya `actividades_evaluativas[].fecha` caiga en los días de la guía → indicador por `skill`
- **Prioridad 2** — Modelo A + fallback B: buscar el `news_projects` con `due_date` más próxima en el futuro → indicador por `target_indicador`

---

## ⚠️ Session Checklist

**Al INICIAR cada conversación:** Lee `.claude-session-checklist.md` y verifica si hay commits recientes sin documentar.

**Al FINALIZAR cada conversación:** Ejecuta `.claude/session-end-check.sh` y pregunta si CLAUDE.md necesita actualizarse.

## 🚨 POLÍTICA DE COMMITS OBLIGATORIA

**NUNCA salir de una sesión con cambios sin commitear.**

- Acumula features pequeños relacionados en un solo commit. Features grandes → commits separados.
- Formato: `feat(scope):` / `fix(scope):` / `refactor(scope):` / `docs:`
- Scopes: `news`, `ai`, `editor`, `auth`, `export`, `perf`, `a11y`
- Scripts: `./.claude/auto-commit.sh "feat(scope): descripción"` y `./.claude/session-end-check.sh`

## Commands

```bash
npm run dev       # Start dev server (http://localhost:5173/cbf-planner/)
npm run build     # Production build → dist/
npm run preview   # Preview production build locally
```

Deploy Edge Function: `supabase functions deploy claude-proxy --no-verify-jwt`

Local dev requires `.env.local`: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`

---

---

## 🔧 Estado Técnico del Sistema

> **Auditoría completa:** `docs/auditoria/2026-04-04-auditoria-sistema.md`  
> Generada por Claude Opus 4.6 el 2026-04-04. Leerla antes de cualquier refactoring mayor.

### Patrones obligatorios al escribir código nuevo

- **Supabase writes** → siempre destructurar `{ data, error }` y manejar `error`. Usar `safeAsync()` de `logger.js` cuando sea posible.
- **innerHTML** → nunca con datos de usuario/DB sin sanitizar. Usar `DOMPurify.sanitize()` en componentes React, o una función `esc()` en HTML generado.
- **Roles y permisos** → usar helpers de `roles.js` (`canManage`, `isDirector`, etc.), nunca comparar strings de rol directamente.
- **Feature flags** → verificar con `useFeatures()` antes de renderizar funciones opcionales.
- **Fechas** → usar `dateUtils.js`. No hardcodear años, días o meses.

### Deuda técnica conocida — NO agravar

| Problema | Archivos | Estado |
|---|---|---|
| 23 escrituras Supabase sin error handling | CommentsPanel, MyPlansPage, NotificationsPage, SettingsPage, AgendaPage, MessagesPage | Pendiente Fase 1 |
| GuideEditorPage muy grande (1521 lns) | `GuideEditorPage.jsx` | Pendiente Fase 3 |
| NewsProjectEditor muy grande (1516 lns) | `NewsProjectEditor.jsx` | Pendiente Fase 3 |
| useUIStore.js sin usar | `src/stores/useUIStore.js` | Eliminar cuando se pueda |
| Hooks sin adoptar (useForm, useAsync, etc.) | `src/hooks/` | Adoptar o eliminar |
| Zero tests | todo el proyecto | Pendiente Fase 2 |
| CSS monolítico (2643 lns) | `src/styles/index.css` | Pendiente Fase 3 |

### Fixes aplicados en auditoría (2026-04-04)

- `c0cffd4` — minify activado, año dinámico en períodos, null-safe full_name
- `0cc8583` — error handling + pantalla de reintento en loadTeacher
- `f71f76f` — XSS fix en exportRubricHtml (función esc())
- `237375e` — bloqueo de javascript:/vbscript:/data: en RichEditor links
- `aa6d953` — compressImage con reject y timeout (15s)

### Roadmap de fases

- **Fase 0** ✅ Completada — fixes urgentes de seguridad y estabilidad
- **Fase 1** 🔄 Pendiente — error handling en 23 escrituras, CORS Edge Function, supabase.js → env vars
- **Fase 2** ⬜ Pendiente — testing (Vitest), CI con lint y tests
- **Fase 3** ⬜ Pendiente — refactoring de archivos grandes, TeacherContext, CSS modular, a11y
- **Fase 4** ⬜ Visión — TypeScript gradual, offline support

---

## Detailed Reference

@docs/claude/architecture.md
@docs/claude/ai-integration.md
@docs/claude/data-model.md
@docs/claude/guide-editor.md
@docs/claude/pedagogical-models.md
@docs/auditoria/2026-04-04-auditoria-sistema.md
