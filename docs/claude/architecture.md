# Architecture

**Stack:** React 18 + Vite 5 SPA → GitHub Pages (`/cbf-planner/`). Supabase for auth, PostgreSQL, and Edge Functions.

## Auth & routing (`App.jsx`)

`App.jsx` is a state machine: `session === undefined` = loading, `null` = no session, object = logged in. After login, it fetches `teachers.*, schools(*)` and gates routing by `teacher.status` (`pending` | `approved` | `rejected`) and `teacher.role` (`teacher` | `admin`). The whole authenticated experience lives under `DashboardPage`.

## Context providers (mounted in `DashboardPage`)

- **`FeaturesContext`** — loads `schools.features` (JSONB) once per session and exposes per-school feature flags. Default flags are in `FeaturesContext.jsx`. Use `useFeatures()` to gate UI; use `updateFeature(key, value)` to persist changes (admin only).
- **`ToastContext`** — global toast notifications. Use `const { showToast } = useToast()`. Signature: `showToast(message, type?, duration?)`. Types: `'success' | 'error' | 'info' | 'warning'`.

## Real-time updates

Supabase Realtime is used for instant notifications and messages updates instead of polling. **No polling intervals exist in the codebase** — all data updates are event-driven.

**Implementation (`DashboardPage.jsx`):**
- Two Realtime subscriptions: `notifications-changes` and `messages-changes`
- Listens to `INSERT`, `UPDATE`, `DELETE` events on respective tables
- Filters applied: `school_id=eq.X` for notifications, `to_id=eq.X` for messages
- RLS policies are automatically respected by Realtime
- Subscriptions are cleaned up on component unmount

**Auto-save in GuideEditorPage:** The only remaining `setInterval` is for auto-saving lesson plans every 30s. This is intentional and local to the editor — not polling remote data.

## Multi-tenancy

Every table uses `school_id` to scope data. The `teacher` object (passed as prop through the entire component tree) carries `school_id` and is the primary source of truth for scoping all queries.

## SPA routing on GitHub Pages

`public/404.html` encodes the path as `/?//path` and redirects to `index.html`. A script in `index.html` restores the real URL via `history.replaceState`. `pathSegmentsToKeep = 1` preserves the `/cbf-planner/` base.

## Modal rules

**No modal should close on outside click.** All modal overlays must NOT have `onClick` on the overlay div. Use `createPortal(…, document.body)` for any modal rendered inside a component that lives inside a clickable parent (e.g. section headers with `onClick` for accordion). The SmartBlocks modal already uses this pattern.

**Convención de color de headers de modales principales:**
| Modal | Header color | Significado semántico |
|---|---|---|
| Logros de Desempeño (`lt-modal-header`) | Navy `#1F3864 → #2E5598` | Meta curricular formal, institucional |
| Proyecto NEWS (`NewsProjectEditor`) | Verde `#1A6B3A → #2D8A50` | Proyecto vivencial, experiencia, crecimiento |

Ambos headers usan texto blanco, badge de tipo (`lt-modal-type-tag` para Logros, span inline para NEWS) y botón cierre traslúcido. El sidebar nav de NEWS usa el mismo verde `#1A6B3A` para bordes activos, dots y hover.

## Logging

Use `logError(err, { page, action, entityId })` and `logActivity(action, entityType, entityId, description)` from `src/utils/logger.js`. For Supabase calls that might fail, use the `safeAsync()` wrapper which returns `{ data, error }` and auto-logs.

## Deploy

Push to `main` triggers GitHub Actions → `npm run build` → GitHub Pages. The build injects `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from GitHub Secrets (the Edge Function URL is derived from `VITE_SUPABASE_URL` at runtime in `AIAssistant.js`).

## Paneles de administración

> Detalle completo en [`roles.md`](roles.md).

- **`/settings` — SettingsPage** (Coordinador/Superadmin): franjas del horario (`schedule_slots`), feature flags, acceso a docentes
  - `SchedulePage` usa `parseTimeMin()` para ordenar franjas. Heurística PM: hora < 6 → sumar 12.
  - Vista "Por Docente": celdas sin clase muestran **"Admin Hours"** en gris itálico.
- **`/superadmin` — SuperAdminPage** (solo Superadmin): nombre, DANE, resolución, logo, dominio email
- **`/teachers` — AdminTeachersPage** (canManage): crear + editar + eliminar docentes, asignaciones, co-teacher
