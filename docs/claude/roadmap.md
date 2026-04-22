# Roadmap y Estado del Proyecto

> Extraído de `CLAUDE.md` + auditoría `docs/auditoria/2026-04-04-auditoria-sistema.md`
> Última actualización: 2026-04-22

---

## Estado por área — Snapshot actual

| Área | Estado | Notas |
|---|---|---|
| Auth / Login | 🔶 A medias | Email+pass ✅ · Google OAuth handler ✅ · Forgot password ❌ · Emails automáticos ❌ |
| Roles y permisos | ✅ Completo | Rector = Coordinador, canManage expandido, badges sidebar |
| Paneles admin | ✅ Completo | SettingsPage limpio, SuperAdminPage, AdminTeachersPage edit+delete |
| Asignaciones RLS | ✅ Completo | Policies para admin + superadmin + rector |
| Toast / UI | ✅ Completo | createPortal, visible sobre modales |
| Agenda semanal | ✅ Completo | Dashboard, generación masiva, AgendaViewer read-only, co-teacher |
| Director de Grupo | ✅ Completo | homeroom_grade/section, flujo propio, vista Agenda |
| Co-teacher | ✅ Completo | coteacher_grade/section, director_absent_until, edición activada por ausencia |
| DirectorPage | ✅ Completo | 3 tabs (Guías/NEWS/Agendas), FeedbackModal |
| Feedback/Revisión | ✅ Parcial | FeedbackModal + document_feedback table. **Falta:** sala-revision, interfaz edición con justificación |
| Tests + CI | ✅ Completo | Vitest 71 tests, CI bloqueante en deploy |
| Error handling | ✅ Completo | 23 escrituras Supabase, safeAsync |
| Seguridad XSS | ✅ Completo | exportRubricHtml esc(), RichEditor protocolos |
| Indicadores / NEWS | ✅ Completo | Modelo A y B, auto-creación NEWS, timelines |
| Guías semanales | ✅ Completo | Editor completo, SmartBlocks, export HTML+DOCX, IA |
| Mensajería | 🔶 Básica | Mensajes 1-a-1 funcionan. Falta: salas grupales |
| Sala de Revisión | ⬜ Pendiente | `/sala-revision` — guías publicadas organizadas por grado |
| Archivado (Fase 5) | ⬜ Pendiente | Snapshot JSON + PDF al publicar, versioning |
| Pipeline imágenes IA | ⬜ Pendiente | Fotos de textbook → multimodal → prompt |
| Refactoring (Fase 3) | ⬜ Pendiente | Archivos grandes, CSS modular, TeacherContext |
| **Módulo de Evaluación — Backend** | ✅ Completo | 10 tablas, triggers, cola AI, corrección Claude, escala colombiana. Probado E2E. |
| **Módulo de Evaluación — Frontend** | 🔶 Parcial | ~~Pantalla creación~~ ✅ · ~~N versiones anti-copia~~ ✅ · ~~Print CBF-G AC-01~~ ✅ · Dashboard resultados ❌ · Revisión humana ❌ |
| **CBF Observability Layer** | ✅ Completo | 16 códigos error `CBF-[MOD]-[TYPE]-[NNN]`, cbf-logger, alertas Telegram, health snapshots |
| **CBF Quality Standard** | ✅ Completo | Definition of Done, clasificación bugs, estándares performance y disponibilidad |

---

## Fases de desarrollo

| Fase | Estado | Contenido |
|---|---|---|
| **0** | ✅ | Fixes urgentes: minify, año dinámico, XSS, compressImage, null-safe |
| **1** | ✅ | Error handling 23 escrituras, CORS Edge Fn, env vars, código muerto |
| **2** | ✅ | Vitest 71 tests, CI bloqueante |
| **3** | ⬜ | Refactoring archivos grandes, TeacherContext, CSS modular, a11y |
| **4** | ⬜ | TypeScript gradual, offline support |
| **5** | ⬜ | Persistencia/archivado guías+NEWS, versioning, pipeline imágenes libros |
| **6** | ⬜ | Módulo de Evaluación — Frontend completo + exam player integrado |

---

## Próximas tareas — orden de prioridad

### 🔴 Alta prioridad

**Módulo de Evaluación — Frontend** (Fase 6)
El backend está completo y probado. El frontend avanza.
1. ~~Pantalla de creación de examen con AI — tema + grado → examen generado en < 2 min~~ ✅
2. ~~Interfaz de criterios y rúbrica — visible, editable, no obligatoria (principio Betty Crocker)~~ ✅
3. ~~N versiones anti-copia — shuffle determinístico, round-robin, badge versión al estudiante~~ ✅
4. ~~Impresión institucional CBF-G AC-01 — encabezado 3×3 exacto, 11 renderers por tipo~~ ✅
5. ~~Examen activo visible desde PlannerPage — callout con código de acceso~~ ✅

**🔒 Sistema antitrampa — ExamPlayerPage** ← SESIÓN K, ÍTEM 1
El conteo de tabs existe pero no hay lockdown real. Implementar en `ExamPhase`:
- `requestFullscreen()` al iniciar + alerta si el estudiante sale del fullscreen (`fullscreenchange`)
- `onContextMenu → e.preventDefault()` en el contenedor del examen (bloquear click derecho)
- `onCopy / onCut / onPaste → e.preventDefault()` en todas las áreas de texto
- Bloquear teclas sospechosas: `F12`, `Ctrl+U`, `Ctrl+Shift+I`, `Ctrl+C` (global `keydown`)
- Umbral de alerta: si `tab_switch_count >= 3` → marcar `integrity_flags.high_risk = true` en DB
- Badge visual en rojo cuando `tab_switch_count >= 2` (hoy es naranja genérico)
- En `ExamDetailModal`: mostrar `⚠️ Riesgo alto` junto al nombre del estudiante si `high_risk`
- **Marca de agua forense** — nombre completo del estudiante + fecha + hora repetido en toda
  la pantalla (CSS `::before` rotado -30°, `opacity: 0.07`, `pointer-events: none`, `position: fixed`)
  Si el estudiante fotografía la pantalla y la comparte, el nombre queda impreso en la imagen

6. **Dashboard de resultados por examen** — quién presentó, quién no, notas, alertas de integridad
7. **Panel de revisión humana** — correcciones AI con confianza < 0.65 para revisión del docente

**Login/Auth completo** (`LoginPage.jsx`, `App.jsx`, Edge Fn `admin-create-teacher`)
1. Configurar Google OAuth en Supabase Dashboard → Auth → Providers → Google
2. Validar dominio `@redboston.edu.co` post-OAuth en `App.jsx:onAuthStateChange`
3. Agregar "Olvidé mi contraseña" → `resetPasswordForEmail()` → `SetPasswordPage` (ya existe)
4. Email automático al crear docente desde `admin-create-teacher` (Supabase SMTP / Resend)

Ver detalles en [`security.md`](security.md).

### 🟠 Media-alta prioridad

**Sincronización local post-sesión 2026-04-21**
- [ ] `supabase db pull` — traer las 4 migraciones nuevas al local
- [ ] Copiar `supabase/functions/exam-ai-corrector/index.ts` (v3) al local
- [ ] Copiar `supabase/functions/cbf-logger/index.ts` (v1) al local
- [ ] Subir `/docs/` al repo (Quality Standard, Test Cases, Deploy Checklist, ROADMAP)
- [ ] Verificar que los backups de Supabase están activos
- [ ] Instrumentar `claude-proxy` con `cbf-logger`

**Ambiente de desarrollo separado**
- Crear Supabase Branch para dejar de trabajar directo en producción
- Hoy todo fue directo a producción — riesgo real que hay que cerrar

### 🟡 Media prioridad

**Sala de Revisión de Guías Publicadas** (`/sala-revision`)
- Guías publicadas organizadas por grado
- Coordinador/rector edita con justificación + notificación al docente
- RLS: UPDATE para `admin` y `rector`

**Mensajería expandida**
- `MessagesPage` → chat 1-a-1 completo + salas grupales

**Auditoría de seguridad del exam player**
- Sesión dedicada a intentar romperlo como estudiante de 15 años
- Documentar vulnerabilidades y resolución

### 🟢 Baja prioridad / Fase 3

**Refactoring archivos grandes:**
| Archivo | Líneas | Plan |
|---|---|---|
| `GuideEditorPage.jsx` | ~1521 | Partir en subcomponentes por panel |
| `NewsProjectEditor.jsx` | ~1516 | Partir por steps del wizard |
| `SmartBlocks.jsx` | ~1339 | Un archivo por tipo de bloque |
| `src/styles/index.css` | ~2643 | CSS modules por página/componente |

---

## Features pendientes de diseño — Fase 5

### Archivado de guías y NEWS publicadas
Cuando una guía o proyecto NEWS cambia a `published`:
1. Snapshot JSON inmutable en Supabase Storage: `archives/{school_id}/guides/{plan_id}.json`
2. PDF automático: `archives/{school_id}/pdfs/{plan_id}.pdf`
3. Tabla `archived_versions`: `{ entity_type, entity_id, version, storage_path, archived_at, archived_by }`
4. Campo `locked: bool` en `lesson_plans` y `news_projects` — bloquea edición sin aprobación admin

### Pipeline de imágenes de libros para IA
Cuando el docente sube fotos de textbook en NewsProjectEditor:
1. Bucket: `guide-images/textbook/{school_id}/{news_id}/page_{n}.webp`
2. Compresión automática: max 1200px, WebP, calidad 0.85
3. URLs firmadas → `generateGuideStructure()` como `textbook_pages: [url1, url2, ...]`
4. Prompt: bloque `📖 PÁGINAS DEL LIBRO` con URLs para lectura multimodal
5. UI: sección "Subir páginas del libro" con previsualización y reorden drag

### ~~Exámenes diferenciados por estudiante (Módulo de Evaluación — Fase 6)~~ ✅ Implementado
- ~~N versiones del mismo examen — misma rúbrica, preguntas distintas~~
- ~~Cada estudiante recibe una versión única — la copia se vuelve estructuralmente imposible~~
- ~~La corrección AI usa la misma rúbrica para todas las versiones~~

**Implementación:** `seededShuffle` + `shuffleMCOptions` en ExamPlayerPage. Seed determinístico = `version_number × 31337`. Asignación round-robin por `sessionCount % N`. El docente elige 1/2/3/4 versiones en el wizard antes de publicar.

---

## Deuda técnica — NO agravar

| Problema | Archivo | Estado |
|---|---|---|
| GuideEditorPage muy grande | `GuideEditorPage.jsx` (~1521 lns) | Fase 3 |
| NewsProjectEditor muy grande | `news/NewsProjectEditor.jsx` (~1516 lns) | Fase 3 |
| CSS monolítico | `src/styles/index.css` (~2643 lns) | Fase 3 |
| Hooks sin adoptar | `src/hooks/` | Adoptar o eliminar en Fase 3 |
| Props drilling `teacher` | App → 15 páginas | `TeacherContext` en Fase 3 |
| Race condition GuideEditor | `contentRef.current` mutado en 5+ lugares | Fase 3 |
| `claude-proxy` sin observabilidad | `supabase/functions/claude-proxy/` | Instrumentar con cbf-logger |
| Deploy directo a producción | Todas las migraciones y Edge Functions | Crear Supabase Branch |

---

## Completado — sesión 2026-04-22

- [x] ExamDashboardPage: selector de N versiones (1–4) en wizard Step 2 con checkboxes shuffle
- [x] ExamDashboardPage: wizard Step 3 — criterios editables + RIGOR_META UI (3 botones color)
- [x] ExamDashboardPage: sanitizador rigor_level → fix constraint `question_criteria_rigor_level_check`
- [x] ExamDashboardPage: botón 🖨️ Imprimir wired up con `printExamHtml()`
- [x] exportExamHtml.js: encabezado CBF-G AC-01 correcto (tabla 3×3 según header1.xml)
- [x] exportExamHtml.js: 11 renderers de tipo de pregunta para layout de impresión institucional
- [x] AIAssistant.js: prompt reforzado — rigor_level whitelist explícita en el prompt
- [x] PlannerPage: callout de examen activo con código de acceso + botón copiar
- [x] ExamPlayerPage: `seededShuffle` (LCG) + `shuffleMCOptions` (reordena + actualiza correct_answer)
- [x] ExamPlayerPage: asignación round-robin por `sessionCount % N_versions`
- [x] ExamPlayerPage: `assessment_version_id` en INSERT de sesión + badge versión en InstructionsPhase

## Completado — sesión 2026-04-21

- [x] Schema del módulo de evaluación — 10 tablas, RLS, triggers, índices, vistas
- [x] Edge Function `exam-ai-corrector` v3 — cola AI con reintentos, logging, corrección con rúbrica
- [x] Edge Function `cbf-logger` v1 — sistema nervioso de observabilidad
- [x] CBF Observability Layer v1.0 — 16 códigos error, 5 reglas de alerta, health snapshots, crons
- [x] CBF Quality Standard v1.0 — Definition of Done, clasificación bugs, SLA interna
- [x] Test Cases Exam Module v1.0 — 15 casos documentados, 8 ejecutados (todos PASS)
- [x] Deploy Checklist v1.0 — protocolo de deploy con plan de rollback
- [x] README.md institucional + técnico — ADRs, estado actual vs lo que viene
- [x] Bug encontrado y corregido en producción — JOIN incorrecto en exam-ai-corrector (v1→v3)
- [x] Prueba E2E exitosa — corrección AI con nota colombiana 3.8/5.0, confianza 0.85
