# CLAUDE.md

> **"Nosotros Diseñamos. El docente enseña."**
> El diseño no debe ser abrumador para el profesor. Nosotros diseñamos para ellos.

---

## 🔒 LEY FUNDAMENTAL — NO BORRAR JAMÁS

> **Referencia pedagógica completa:** `theoric mark/CBF_Analisis_Implementacion_Sistema.md`

```
INDICADOR DE LOGRO → PROYECTO NEWS (inmutable al publicar) → GUÍAS SEMANALES → EVALUACIÓN
```

**Reglas no negociables:**
1. El NEWS se crea al inicio del período. Una vez publicado, no se modifica.
2. `news_projects.target_id` es el vínculo más importante de toda la base de datos.
3. El indicador activo de una guía = NEWS con `due_date` más próxima al futuro de esa semana.
4. La IA genera con ese indicador como norte. El docente lo ve read-only.
5. Toda actividad evaluativa DEBE tener `fecha`. El sistema no permite guardar sin ella.
6. **Modelo B = Language Arts, Social Studies, Science, Lingua Skill** (`MODELO_B_SUBJECTS` en `constants.js`).

**Lookup indicador activo (`GuideEditorPage.jsx`):**
- Prioridad 1 — Modelo B: `actividades_evaluativas[].fecha` en días de la guía → indicador por `skill`
- Prioridad 2 — Modelo A + fallback B: `due_date` más próxima → `target_indicador`

---

## ⚠️ Session Checklist

**Al INICIAR:** Lee `.claude-session-checklist.md` + **revisa `OPEN_QUESTIONS.md`**.
**Al FINALIZAR:** Ejecuta `.claude/session-end-check.sh` y actualiza CLAUDE.md.

## 🤝 Convención — OPEN_QUESTIONS.md

Archivo raíz para preguntas de diseño que afectan múltiples archivos o bloquean implementación.
Preguntas puntuales (1-2 líneas) → directo en el chat.
Señal en el chat cuando hay algo nuevo: `📋 OPEN_QUESTIONS.md actualizado — [tema]`

## 🚨 Commits obligatorios

**NUNCA salir con cambios sin commitear y pushear.**
- Formato: `feat/fix/refactor/docs(scope):` — Scopes: `news`, `ai`, `editor`, `auth`, `export`, `perf`, `a11y`, `agenda`, `roles`
- Scripts: `./.claude/auto-commit.sh "feat(scope): desc"` · `./.claude/session-end-check.sh`
- **Siempre `git push origin main` después de cada bloque de trabajo.**

## Commands

```bash
npm run dev / build / preview
supabase functions deploy <fn> --no-verify-jwt
```
Local: `.env.local` con `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`

---

## 📊 Estado Actual del Sistema

> Detalle completo: [`docs/claude/roadmap.md`](docs/claude/roadmap.md)

| Área | Estado | Notas |
|---|---|---|
| Auth / Login | 🔶 A medias | Email+pass ✅ · Google OAuth handler ✅ · Forgot password ❌ · Emails automáticos ❌ |
| Roles y permisos | ✅ | Rector = Coordinador, `canManage` expandido, badges sidebar |
| Paneles admin | ✅ | SettingsPage (Coordinador), SuperAdminPage, AdminTeachersPage edit+delete |
| RLS assignments | ✅ | Policies para admin + superadmin + rector |
| Agenda semanal | ✅ | Dashboard, generación masiva, co-teacher, AgendaViewer |
| DirectorPage | ✅ | 3 tabs (Guías/NEWS/Agendas), FeedbackModal |
| Feedback/Revisión | 🔶 Parcial | FeedbackModal existe. **Falta:** sala-revision, edición con justificación |
| Tests + CI | ✅ | Vitest 71 tests, CI bloqueante |
| Mensajería | 🔶 Básica | 1-a-1 funciona. Falta: salas grupales |
| Export Virtual Campus | ✅ | Por jornada, CSS scoped, SmartBlocks interactivos funcionan |
| Sala de Revisión | ⬜ | `/sala-revision` — guías publicadas por grado |
| Archivado Fase 5 | ⬜ | Snapshot JSON/PDF al publicar, versioning |
| Refactoring Fase 3 | ⬜ | Archivos grandes, CSS modular, TeacherContext |

---

## 🔧 Patrones Obligatorios

- **Fechas** → usar `dateUtils.js`. No hardcodear años, días o meses.
- **Modales** → nunca cerrar con click fuera. Usar `createPortal(…, document.body)` si el modal está dentro de un padre clickeable.
- **Toast** → `createPortal(…, document.body)` en `ToastContext.jsx` — visible siempre sobre modales.
- **Logging** → `logError(err, { page, action })` y `logActivity(...)` de `logger.js`.
- **Supabase writes** → siempre `{ data, error }`, manejar `error`. Usar `safeAsync()`.
- **innerHTML** → nunca con datos de usuario/DB. `DOMPurify.sanitize()` o `esc()`.
- **Roles** → helpers de `roles.js`, nunca comparar strings directo.
- **Feature flags** → `useFeatures()` antes de renderizar funciones opcionales.

---

## 🗂 Mapa de Roles — Resumen ejecutivo

> Detalle completo en [`docs/claude/roles.md`](docs/claude/roles.md)

| Perfil | Rol DB | Capacidades clave |
|---|---|---|
| Docente | `teacher` | Guías propias, NEWS propio, mensajes |
| Dir. de grupo | `teacher` + `homeroom_grade` | + Agenda de su grupo |
| Co-teacher | `teacher` + `coteacher_grade` | + Agenda del grupo (editar si ausencia activa) |
| Psicopedagoga | `psicopedagoga` | + Calendario, horario, ver todos los planes |
| Rector | `rector` | = Coordinador completo + vista Director + feedback |
| Coordinador | `admin` | Gestión docentes, roles, feature flags, revisión |
| Superadmin | `superadmin` | Todo + identidad institucional + seguridad |

---

## 🔐 Seguridad — Resumen

> Detalle completo en [`docs/claude/security.md`](docs/claude/security.md)

- Validación dominio email: toggle en `/superadmin` → `schools.features.restrict_email_domain`
- Creación docentes: Edge Fn `admin-create-teacher` → recovery link → `SetPasswordPage`
- **Pendiente:** Google OAuth con validación de dominio post-login, Olvidé mi contraseña, email automático al crear docente

---

## 📚 Historial de sesiones relevantes

**Sesión 2026-04-04 (post-auditoría):**
- `c0cffd4` minify, año dinámico, null-safe full_name · `0cc8583` error handling loadTeacher
- `f71f76f` XSS fix exportRubricHtml · `237375e` bloqueo protocolos RichEditor
- `aa6d953` compressImage con reject+timeout · Fase 1 ✅ · Fase 2 ✅ Vitest 71 tests

**Sesión 2026-04-04 (features):**
- `f4ddc70` PlannerPeriodTimeline + `detectActivityType()` + campo `tier`
- `school_calendar` integrado en NewsProjectEditor: warnings días no laborables

**Sesión 2026-04-05 (agenda + auth + roles):**
- `2aaf2aa` Agenda: generación masiva, cobertura por grado/sección
- `3079d47` Edge Fn `admin-create-teacher` + modal Crear docente
- `bf5fb47` `SetPasswordPage` para recovery link
- `542c5d8` Validación dominio email · `1d2cfaa` Toggle restrict_email_domain
- `7895290` Co-teacher + FeedbackModal + DirectorPage 3 tabs
- `6837ff5` Rename director → rector en todo el sistema

**Sesión 2026-04-05 (paneles admin):**
- `e29180b` Rector = Coordinador en todos los permisos (`roles.js`)
- `aa02d73` Badge de rol en sidebar + editar/eliminar docentes en AdminTeachersPage
- `2931943` SuperAdminPage (`/superadmin`): identidad institucional + seguridad
- `840084e` Fix test canManage rector · `78b54db` Toast con createPortal

**Sesión 2026-04-06 (export + AI bíblico):**
- `ccdaf33` Fix `#pdf-tip` oculto en `@media print`
- `f387cce`–`e050193` (sesión anterior): fix encoding UTF-8, logo persistencia, columnas `document_code`/`doc_version`, principio bíblico en AI y export
- `427adfc` Export por jornada para Virtual Campus — `buildDayHtml`, `exportDayHtml`, `getActiveDays` en `exportHtml.js`
- `0c2a486` CSS scoped a `.cbf-day` — evita destruir layout del virtual campus al pegar snippet
- `7f22a5e` `type="button"` en todos los botones SmartBlock — evita submit de form en virtual campus
- `3306aa1` Click-outside handler para dropdown export (reemplaza `onMouseLeave` frágil)

---

## Detailed Reference

@docs/claude/architecture.md
@docs/claude/ai-integration.md
@docs/claude/data-model.md
@docs/claude/guide-editor.md
@docs/claude/pedagogical-models.md
@docs/claude/roles.md
@docs/claude/security.md
@docs/claude/roadmap.md
@docs/auditoria/2026-04-04-auditoria-sistema.md
