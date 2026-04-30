# Roadmap y Estado del Proyecto

> Extraído de `CLAUDE.md` + auditoría `docs/auditoria/2026-04-04-auditoria-sistema.md`
> Última actualización: 2026-04-22

---

## Estado por área — Snapshot actual

| Área | Estado | Notas |
|---|---|---|
| Auth / Login | 🔶 Casi completo | Email+pass ✅ · Google OAuth handler ✅ · Forgot password ✅ · Email bienvenida docente ✅ · Google OAuth config en Dashboard ❌ |
| Roles y permisos | ✅ Completo | Rector = Coordinador, canManage expandido, badges sidebar |
| Paneles admin | ✅ Completo | SettingsPage limpio, SuperAdminPage, AdminTeachersPage edit+delete |
| Asignaciones RLS | ✅ Completo | Policies para admin + superadmin + rector |
| Toast / UI | ✅ Completo | createPortal, visible sobre modales |
| Agenda semanal | ✅ Completo | Dashboard, generación masiva, AgendaViewer read-only, co-teacher |
| Director de Grupo | ✅ Completo | homeroom_grade/section, flujo propio, vista Agenda |
| Co-teacher | ✅ Completo | coteacher_grade/section, director_absent_until, edición activada por ausencia |
| DirectorPage | ✅ Completo | 3 tabs (Guías/NEWS/Agendas), FeedbackModal |
| Feedback/Revisión | ✅ Completo | FeedbackModal + document_feedback · Sala de Revisión completa · IntentModal + justificación obligatoria al guardar |
| Tests + CI | ✅ Completo | Vitest 71 tests, CI bloqueante en deploy |
| Error handling | ✅ Completo | 23 escrituras Supabase, safeAsync |
| Seguridad XSS | ✅ Completo | exportRubricHtml esc(), RichEditor protocolos |
| Indicadores / NEWS | ✅ Completo | Modelo A y B, auto-creación NEWS, timelines |
| Guías semanales | ✅ Completo | Editor completo, SmartBlocks, export HTML+DOCX, IA |
| Mensajería | 🔶 Básica | Mensajes 1-a-1 funcionan. Falta: salas grupales |
| Sala de Revisión | ✅ Completo | Cola submitted + acordeón por grado + stats · Aprobar/Devolver/Publicar · IntentModal + justificación al guardar · snapshot HTML en Storage |
| Archivado (Fase 5) | ✅ Completo | storage_path en lesson_plan_versions · news_project_versions · HTML inmutable a Storage · "Archivar versión" en NEWS |
| **Módulo Psicosocial** | ✅ Completo | 3 tablas · PsicosocialPage · semáforo · perfil/seguimiento/plan docente · modo consulta docentes · notas confidenciales ocultas |
| **PIAR en IA** | ✅ Completo | Acomodaciones inyectadas en `generateGuideStructure` sin PII · aviso en ConversationalGuideModal |
| **Privacidad Telegram** | ✅ Completo | Código anónimo (last-6 instance_id) en alertas y ciclo · columna Código en ExamLiveMonitor |
| Pipeline imágenes IA | ⬜ Pendiente | Fotos de textbook → multimodal → prompt |
| Refactoring (Fase 3) | ⬜ Pendiente | Archivos grandes, CSS modular, TeacherContext |
| **Módulo de Evaluación — Backend** | ✅ Completo | 10 tablas, triggers, cola AI, corrección Claude, escala colombiana. Probado E2E. |
| **Módulo de Evaluación — Frontend** | ✅ Completo | ~~Pantalla creación~~ ✅ · ~~N versiones anti-copia~~ ✅ · ~~Print CBF-G AC-01~~ ✅ · ~~ExamPlayerV2 email-auth~~ ✅ · ~~Antitrampa 5 capas~~ ✅ · ~~Generar instancias por roster~~ ✅ · ~~Preview+edición preguntas por versión~~ ✅ · ~~Dashboard resultados~~ ✅ · ~~Monitor en vivo~~ ✅ · ~~Revisión humana~~ ✅ |
| **Roster de Estudiantes** | ✅ Completo | school_students · StudentsPage · exam-instance-generator auto-query · email auth en /eval · displayName apellido-nombre · CSV robusto · import row-by-row · ordenamiento columna · eliminación por lotes |
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
| **5** | ✅ | Archivado inmutable guías+NEWS · storage_path · news_project_versions · HTML a Storage |
| **6** | ✅ | Módulo de Evaluación — Frontend completo · ExamPlayerV2 · antitrampa · monitor en vivo · revisión humana |

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

**🔒 Sistema antitrampa — ExamPlayerV2Page** ← SESIÓN L, ÍTEM 1
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
- **Sistema antitrampa NIVEL MÁXIMO** — 5 capas de defensa:
  - **Capa 1 — Detección multi-evento**: `visibilitychange` + `window blur` + `fullscreenchange`
    + `resize` (DevTools anclado) + `keydown` global + `beforeunload` + `contextmenu` +
    `copy/cut/paste` + `pagehide` (iOS) + `MutationObserver` en body. Cada evento → DB + Telegram.
  - **Capa 2 — Marca de agua en Canvas** (resistente a DevTools): `<canvas>` `position:fixed`
    `z-index:9999` redibujo por `requestAnimationFrame` + `MutationObserver` que lo reinserta
    si alguien lo borra. Texto: nombre + versión + hora diagonal -30°.
  - **Capa 3 — Fullscreen adaptativo**: Desktop → `requestFullscreen()` obligatorio.
    iPad iOS Safari (no soporta fullscreen) → "modo quiosco": banner rojo fijo + body scroll bloqueado.
  - **Capa 4 — Telegram en tiempo real**: Edge Function `exam-integrity-alert` dedicada.
    Mensaje inmediato al primer evento; throttle 1/60s para no hacer spam.
    Requiere `teachers.telegram_chat_id` (nueva migración).
  - **Capa 5 — Matriz de pruebas obligatoria**: iPad Safari/Chrome · MacBook Air Safari/Chrome/Firefox
    · Mac Safari/Chrome. Cada combinación verificada antes de marcar como completo.
  - **Límites honestos del navegador**: Alt+Tab del OS y botón Home físico del iPad no pueden
    bloquearse — solo detectarse. Screenshots del sistema tampoco — la marca de agua es la
    única contramedida para fotos con celular.

6. ~~**Dashboard de resultados por examen**~~ ✅
7. ~~**Panel de revisión humana**~~ ✅

---

> ### 📌 Nota pedagógica — Responsabilidad del docente (no es tarea de desarrollo)
>
> **El sistema antitrampa técnico tiene un límite:** un estudiante que fotografíe la pantalla
> y le envíe la imagen a una IA externa (ChatGPT, Gemini, etc.) puede recibir ayuda si las
> preguntas son genéricas. La tecnología no puede resolver esto sola.
>
> **Lo que sí está en manos del docente:** diseñar preguntas con contexto irrepetible:
> - Fragmentos de un texto leído o discutido específicamente en clase esa semana
> - Situaciones hipotéticas con nombres de personajes del libro de texto CBF
> - Casos que referencien algo dicho en clase ("según lo que vimos el martes...")
> - Preguntas que exijan conectar dos ideas trabajadas en la unidad, no hechos aislados
>
> Una IA externa sin acceso al contexto de la clase dará respuestas genéricas o incorrectas
> ante este tipo de preguntas. **Esto es criterio de diseño de evaluación — cada docente
> debe saberlo y aplicarlo.** No es una función del sistema; es una competencia del evaluador.
>
> *Recomendación para capacitación docente: incluir este principio en la inducción al módulo
> de evaluación cuando se haga el lanzamiento institucional.*

---

**Login/Auth** — pendiente solo Google OAuth
1. Configurar Google OAuth en Supabase Dashboard → Auth → Providers → Google
2. Validar dominio `@redboston.edu.co` post-OAuth en `App.jsx:onAuthStateChange`
- ~~"Olvidé mi contraseña"~~ ✅ · ~~Email automático al crear docente (Resend)~~ ✅

Ver detalles en [`security.md`](security.md).

### 🟠 Media-alta prioridad

**Sincronización local post-sesión 2026-04-21**
- [ ] `supabase db pull` — traer las 4 migraciones nuevas al local
- [ ] Copiar `supabase/functions/exam-ai-corrector/index.ts` (v3) al local
- [ ] Copiar `supabase/functions/cbf-logger/index.ts` (v1) al local
- [ ] Subir `/docs/` al repo (Quality Standard, Test Cases, Deploy Checklist, ROADMAP)
- [ ] Verificar que los backups de Supabase están activos
- [ ] Instrumentar `claude-proxy` con `cbf-logger`


### 🟡 Media prioridad

~~**Sala de Revisión de Guías Publicadas**~~ ✅ completado — `/sala-revision` operativo

**Mensajería expandida**
- `MessagesPage` → chat 1-a-1 completo + salas grupales

~~**Auditoría de seguridad del exam player**~~ ✅ completado en Sesión L
- Sistema antitrampa 5 capas implementado (detección multi-evento, canvas watermark, fullscreen adaptativo, Telegram realtime, matriz de pruebas)

### 🟢 Baja prioridad / Fase 3

**Refactoring archivos grandes:**
| Archivo | Líneas | Plan |
|---|---|---|
| `GuideEditorPage.jsx` | ~1521 | Partir en subcomponentes por panel |
| `NewsProjectEditor.jsx` | ~1516 | Partir por steps del wizard |
| `SmartBlocks.jsx` | ~1339 | Un archivo por tipo de bloque |
| `src/styles/index.css` | ~2643 | CSS modules por página/componente |

---

## ~~Features pendientes de diseño — Fase 5~~ ✅ Completado

### ~~Archivado de guías y NEWS publicadas~~ ✅
~~Cuando una guía o proyecto NEWS cambia a `published`:~~
1. ~~Snapshot JSON inmutable en Supabase Storage~~ → implementado: `archives/{school_id}/guides/{plan_id}/v{n}.html`
2. ~~Tabla `archived_versions`~~ → implementado: `lesson_plan_versions.storage_path` + `news_project_versions`
3. ~~Campo `locked: bool`~~ → implementado en `lesson_plans`

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
| Deploy directo a producción | Todas las migraciones y Edge Functions | ✅ Supabase Branch creado |

---

## Completado — sesión 2026-04-25 (N.2 — refinamientos)

- [x] StudentsPage: `displayName()` orden apellido-nombre · checkboxes + eliminación por lotes + confirmación
- [x] StudentsPage: CSV reordenado (Apellido1 | Apellido2 | Nombre1 | Nombre2 | Grado | Sección...)
- [x] StudentsPage: parser CSV robusto — mínimo 4 cols, email auto-generado si dominio incorrecto, warnings no bloqueantes
- [x] StudentsPage: import row-by-row — reintenta fila a fila cuando el batch falla por `23505`
- [x] StudentsPage: ordenamiento por columna (▲▼) en Nombre, Grado, Sección, Código
- [x] PsicosocialPage: notas confidenciales ocultas para `role='teacher'` · banner azul "Modo consulta"
- [x] AIAssistant.generateGuideStructure: bloque `♿ PIAR` — acomodaciones por categoría, sin nombres (privacidad)
- [x] GuideEditorPage: consulta `student_accommodation_plans` → agrega por categoría → `piarData`
- [x] ConversationalGuideModal: aviso naranja en paso 3 si hay acomodaciones activas
- [x] ExamPlayerV2Page + exam-integrity-alert: Telegram anónimo — código last-6 de `instance_id` en lugar de nombre
- [x] ExamLiveMonitor: columna "Código" para cruzar alertas Telegram con monitor en vivo

## Completado — sesión 2026-04-22 (continuación)

- [x] school_students: tabla nueva con trigger auto-student_code, RLS, índices
- [x] exam_instances: columnas student_email, student_id, student_section
- [x] StudentsPage (/students): agregar uno a uno + importar CSV/Excel pegado
- [x] ExamPlayerV2Page: entry cambia a email @redboston.edu.co + access_code
- [x] ExamPlayerV2Page: Telegram alert incluye student_section
- [x] exam-instance-generator: acepta grade+section; auto-consulta roster; guarda email/id/section
- [x] DashboardPage: ruta /students + link sidebar "👩‍🎓 Mis Estudiantes"
- [x] Migración 20260422000004 ejecutada en producción

## Completado — sesión 2026-04-22 (primera parte)

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
