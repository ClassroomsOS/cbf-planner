# Roadmap y Estado del Proyecto

> Extraído de `CLAUDE.md` + auditoría `docs/auditoria/2026-04-04-auditoria-sistema.md`
> Última actualización: 2026-05-27

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
| Pipeline imágenes IA | ✅ Completo | Syllabus Wizard: Vision batch 5 págs → analyzeBookPages + distributePagesByWeek + advisorCheckSession · syllabus_session_resources tabla |
| **Syllabus Inteligente v2** | ✅ Completo | Wizard 5 fases · deepAnalyzeBookPages · classifySubunitsAI · generateTeachingStrategiesAI · start_unit · DB cols nuevas · pipeline teaching_strategies → guías |
| Refactoring (Fase 3) | ⬜ Pendiente | Archivos grandes, CSS modular, TeacherContext |
| **Módulo de Evaluación — Backend** | ✅ Completo | 10 tablas, triggers, cola AI, corrección Claude, escala colombiana. Probado E2E. |
| **Módulo de Evaluación — Frontend** | ✅ Completo | ~~Pantalla creación~~ ✅ · ~~N versiones anti-copia~~ ✅ · ~~Print CBF-G AC-01~~ ✅ · ~~ExamPlayerV2 email-auth~~ ✅ · ~~Antitrampa 5 capas~~ ✅ · ~~Generar instancias por roster~~ ✅ · ~~Preview+edición preguntas por versión~~ ✅ · ~~Dashboard resultados~~ ✅ · ~~Monitor en vivo~~ ✅ · ~~Revisión humana~~ ✅ |
| **Roster de Estudiantes** | ✅ Completo | school_students · StudentsPage · exam-instance-generator auto-query · email auth en /eval · displayName apellido-nombre · CSV robusto · import row-by-row · ordenamiento columna · eliminación por lotes |
| **CBF Observability Layer** | ✅ ~80% completo | Tablas + cbf-logger + alert_rules ✅ · QADashboardPage 7 tabs ✅ · 41/156 archivos usan logger (26%) · claude-proxy tiene logEvent() propio · Pendiente: instrumentar archivos restantes sin mutaciones |
| **CBF Quality Standard** | ✅ Completo | Definition of Done, clasificación bugs, estándares performance y disponibilidad |
| **Quiz vs Examen Final** | ✅ Completo | EXAM_PRESETS (quiz/final_lower/final_upper) · ExamCreatorPage wizard · prompt IA diferenciado · metadata exam_type · badge en dashboard · 23 tests |
| **Módulo Logros — Rediseño** | ✅ Completo | ObjectivesPage → AchievementsPage · ruta /achievements · header gradiente · stat cards · agrupación por materia+grado · GoalCard borde coloreado · 3 columnas por dimensión · WeightBar · CompletenessChecklist · CascadePanel · modales mejorados · empty state con diagrama |
| **Biblioteca CBF — Fase 1** | ✅ Completo | `school_library` tabla + RLS dual + Storage bucket `cbf-library` · `LibraryPage` tabs Institucional/Personal · upload (PDF/imagen/video/audio/MIDI) · visor universal · quota meter · delete confirm |
| **Biblioteca CBF — Fase 1.5** | ✅ Completo | `library_shares` (compartir con can_edit) · `library_edit_log` (triggers auto) · RPC `library_rollback` (SECURITY DEFINER) · Tab Supervisión admin · `EditModal` · `ShareModal` · `HistoryDrawer` con rollback |
| **Biblioteca CBF — Fase 2** | ✅ Completo | PDF.js 5 página a página · WaveSurfer.js 7 waveform · OpenSeadragon 6 deep zoom · Lazy loading via dynamic import (bundle inicial no crece) |
| **Biblioteca CBF — Fase 3** | ✅ Completo | Fragment Extractor: selección de región rectangular sobre PDF/imagen → captura canvas → análisis Claude Vision → SmartBlock pre-populado → insertar en guía · tabla `library_fragments` · `FragmentSelector.jsx` · `analyzeTextbookFragment()` |
| **Biblioteca CBF — Fase 3b** | ✅ Completo | Fragmentos fluyen a generación de guías: `getISOWeek` + fetch `library_fragments` en `GuideEditorPage` · callout azul en panel indicador · bloque `📚 FRAGMENTOS DEL LIBRO` en prompt `generateGuideStructure` · callout en paso 3 del modal |
| **Biblioteca CBF — Fase 3c** | ✅ Completo | Fragmentos en PlannerPage: callout azul con chips de tipo/SmartBlock → pasan a `AIGeneratorModal` → `generateGuideStructure` los recibe como contexto al generar desde el Planner |
| **Biblioteca CBF — Fase 4** | ✅ Completo | Imágenes de fragmentos fluyen como `imageBlocks` a `generateGuideStructure` (máx. 5, fragmentos prioritarios) · `analyzeTextbookPages()` acepta URLs o capturas base64 · UI "📖 Páginas" en PDF viewer: selección multi-página → renderizado offscreen → análisis Claude Vision → `PagesAnalysisPanel` con plan semanal + SmartBlock sugeridos |
| **Biblioteca CBF — Fase 5** | ✅ Completo | Integración Syllabus: `syllabus_topics.library_doc_id + library_pages[]` (migración prod) · `SyllabusLinkPanel` en PDF viewer: asignar páginas actuales a un `syllabus_topic` · `SyllabusPage` TopicFormModal con selector PDF + páginas; TopicDetailCard chip doc/páginas · `GuideEditorPage` callout verde "Páginas del libro vinculadas al syllabus (semana N)" |
| **Módulo Dictation** | ✅ Completo | 6 tablas (+ dictation_vocab_sets) + 4 Edge Fns (+ dictation-send-test) · DictationPage 8 componentes · 3 modos · 6 tipos de pregunta · Sala de Control 3 paneles RT · Volume control por pregunta · Anti-trampa: paste bloqueado + traducción deshabilitada + autoComplete/autoCorrect/spellCheck off · dictation-send-codes (URL visible) · dictation-send-test (prueba a correos del docente) · corrector robusto (0-responses → 1.0) |
| **Instrumento Docente** | 🔶 En desarrollo | Guión de sesión generado por IA para el docente (complemento de la Guía CBF-G AC-01) · IMS · estado del grupo · 3 opciones por fase · PREACHER CLOSE · prototipo en `theoric mark/teacher-instrument.jsx` |

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

### 🔴 Alta prioridad — Sprint activo (2026-05-16)

**Instrumento Docente** — Guión de sesión generado por IA

Complemento de la Guía de Aprendizaje (CBF-G AC-01). Opera desde el docente: lee la guía y la operacionaliza en micro-experiencias por sesión.

**Plan de ejecución:**
1. Tabla DB: `teacher_instruments` (plan_id FK, group_state, ims_index, generated_json, created_at)
2. Función IA: `generateTeacherInstrument()` en `guideAI.js` — ~2500 tokens
3. Página: `/instrument/:planId` — `InstrumentPage.jsx`
4. Componentes: `InstrumentViewer`, `GroupStateSelector`, `IMSSelector`
5. Integración: botón en GuideEditorPage para abrir el instrumento de la guía actual

---

### ~~🔴 Observabilidad al 100% + QA Dashboard~~ ✅ ~80% completo (2026-05-16)

**Estado verificado:** QADashboardPage con 7 tabs existe y funciona. 41/156 archivos (26%) usan logger. cbf-logger Edge Fn operativo con Telegram. claude-proxy tiene logEvent() propio. El 74% restante son componentes sin mutaciones DB — no requieren instrumentación urgente.

---

### 🔴 Alta prioridad — Pendiente histórico

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

### 🟢 Baja prioridad — Instrumento Docente

**Módulo: Teacher Session Instrument** — diseñado en sesión Chat 2026-05-09

Complemento de la Guía de Aprendizaje (CBF-G AC-01). El instrumento **opera desde el docente**, no desde el estudiante — lee la guía y la operacionaliza en micro-experiencias por sesión.

**Decisiones de diseño ya tomadas:**

- **No es diferenciación por estudiante** — aplica UDL: una sola actividad, rango amplio de outputs válidos. PDA/PiAR son canales institucionales separados.
- **IMS (Índice de Madurez de Sesión):** las 3 dimensiones avanzan en paralelo por semanas del período:

  | IMS | Semanas | Cognitivo | Autónomo | Social |
  |---|---|---|---|---|
  | 1 | 1–2 | Exposición | Muy guiado | Individual |
  | 2 | 3–5 | Conexión | Guiado con opciones | Parejas |
  | 3 | 6–8 | Aplicación | Semi-autónomo | Equipos |
  | 4 | 9–10 | Producción | Autónomo | Comunidad |

- **Estado del grupo** (5 estados, selector visual): Presentes · Dispersos · Caídos · Eléctricos · Ansiosos → cambia el instrumento estructuralmente
- **Estructura de tiempo (límites duros):** Pre-desarrollo ≤ 17 min · Durante ≤ 20 min · Cierre ≤ 10 min
- **Cada fase tiene 3 opciones:** A = Estructurada · B = Semi-abierta · C = Solo conversación
- **ANCHOR:** una pregunta que sostiene toda la sesión
- **PREACHER CLOSE:** habilidad → principio de vida → verdad del versículo → DECLARACIÓN en voz alta
- **Versículo del indicador** como hilo estructural en todos los momentos (no decorativo)
- **Ruta mínima:** sesión completa en 15 min

**Flujo:**
```
Docente abre instrumento desde GuideEditorPage (o ruta /instrument/:planId)
  → Selecciona materia · habilidad · estado del grupo · semana IMS
  → IA genera el guión completo (JSON → renderizado por fases)
  → Docente ajusta opciones A/B/C por fase
  → Instrumento se guarda asociado al plan_id de la guía
```

**Archivos de referencia:**
- `theoric mark/instrumento-docente-sesion.md` — diseño pedagógico completo
- `theoric mark/teacher-instrument.jsx` — prototipo UI funcional con llamada a Claude

**Pendiente antes de implementar:**
- [ ] Definir ruta: `/instrument/:planId` vs panel dentro de GuideEditorPage
- [ ] Tabla DB: `teacher_instruments` (plan_id FK, group_state, ims_index, generated_json, created_at)
- [ ] Función IA: `generateTeacherInstrument()` en `guideAI.js` — ~2500 tokens, retorna JSON de fases
- [ ] Componentes: `InstrumentViewer.jsx` (renderiza fases + opciones A/B/C) · `GroupStateSelector.jsx` · `IMSSelector.jsx`

---

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

## Completado — sesión 2026-05-28c (Dictation — hardening anti-trampa + UX mejoras)

- [x] `DictationPlayerPage`: control de volumen por pregunta de audio — slider range + icono dinámico (🔇/🔈/🔉/🔊) + % — cada pregunta tiene su propio volumen independiente
- [x] `DictationPlayerPage`: bloqueo de paste a nivel `document` (registra violación, mismo patrón que copy/cut)
- [x] `DictationPlayerPage`: `translate="no"` en container del examen + `notranslate` class en `<html>` + `<meta name="google" content="notranslate">` inyectado on-mount — bloquea Google Translate y prompts de traducción del navegador; se limpia al salir
- [x] `DictationPlayerPage`: inputs con `autoCorrect="off"` `autoCapitalize="off"` `data-form-type="other"` — desactiva corrector iOS, autocapitalización Android y autofill de gestores de contraseñas
- [x] `DictationPlayerPage`: `onPaste={e.preventDefault()}` también en container, listen_type input y writing textarea (capa React adicional)
- [x] `dictation-corrector` Edge Fn: handle 0-responses (blank submission) → calcula grade 1.0 + upsert result en vez de devolver 404
- [x] `DictationPlayerPage`: fallback chain en corrector fetch — `.then()` y `.catch()` siempre llaman `setResult` (con fallback 1.0 si error); timeout 12s fetch directo a DB; spinner en submitted phase; `grade != null` en lugar de `grade ?`
- [x] `dictation-send-codes` Edge Fn: URL del player visible como texto plano bajo el botón CTA (para copy-paste si el botón no funciona)
- [x] `dictation-send-test` Edge Fn (nueva): crea instancia TEST-XXXXXX real para el docente, envía email de prueba con banner ámbar a `teacher.email` + `extra_email` opcional; código devuelto en UI para test E2E
- [x] `CreateTab`: botón "🧪 Probar envío a mis correos" en panel post-publish — input extra_email persiste en localStorage
- [x] `ListTab`: botones 🗑️ para eliminar sesiones y blueprints con confirmación inline + cascade delete (responses → results → instances → sessions → blueprint)
- [x] `CreateTab`: progreso visual para generación IA (mensajes rotatorios animados) y para generación TTS (barra determinada por item)
- [x] `DictationPlayerPage`: opciones MC con placement cíclico correcto (A→B→C→D en preguntas sucesivas) — previene inducción por patrón
- [x] `SessionControlPage`: badge de violaciones titila hasta que el docente reconoce; fila del estudiante resaltada en rojo hasta reconocer
- [x] CSS: `.dict-audio-volume`, `.dict-audio-vol-slider`, `.dict-postpublish-test-box`, `.dict-result-loading`, `.dict-result-spinner`, `@keyframes dict-spin`

## Completado — sesión 2026-05-28 (Dictation — CorrectedExamView + PDF corregido + email representante)

- [x] `buildCorrectedHtml()` / `printCorrectedHtml()` en `exportDictationHtml.js`: PDF corregido por estudiante con header CBF-G AC-01, fila de resultado (nota/nivel/puntos), preguntas agrupadas por tipo con respuesta del estudiante (verde=correcto, rojo=incorrecto) y respuesta correcta si falló
- [x] `dictation-notify` Edge Function: recibe `instance_id`, consulta student → `representative_email`, result, teacher, school → genera email HTML institucional → envía vía Resend
- [x] `SessionControlPage`: botones "📋 Ver respuestas corregidas" y "📧 Enviar al representante" en panel derecho cuando `instance_status === 'submitted'`
- [x] `CorrectedExamView` modal: `createPortal` full-screen, agrupa preguntas por `question_type`, muestra audio_text/sentence/options, answer (verde/rojo), correct_answer si incorrecto, score por pregunta
- [x] `CorrectedExamView`: botones "🖨️ PDF corregido" y "📧 Representante" en header del modal
- [x] Nuevos CSS: `.ctrl-action-corrected`, `.ctrl-action-email`, `.ctrl-corrected-*` (~60 líneas)
- [x] Build limpio · DevStatusPage 99%→100% `complete`

## Completado — sesión 2026-05-27c (Sala de Control de Dictados)

- [x] Migración DB: `force_closed` en CHECK constraint de `dictation_instances.instance_status`
- [x] `DictationPlayerPage`: Supabase Realtime Broadcast listener (`dictation-ctrl-{sessionId}`)
- [x] `DictationPlayerPage`: `teacher_warning` event → full-screen warning overlay (10s auto-dismiss + "Understood")
- [x] `DictationPlayerPage`: `force_close` event → exit fullscreen + DB update + `force_closed` phase render
- [x] `DictationPlayerPage`: `registerViolation()` enriquecida con `events[]` array en `integrity_flags`
- [x] `SessionControlPage.jsx` (nuevo): 3 paneles RT — link/preview/stats | tabla estudiantes | detalle+acciones
- [x] `SessionControlPage`: Realtime en `dictation_instances` + `dictation_results` (postgres_changes)
- [x] `SessionControlPage`: Broadcast channel para enviar `teacher_warning` y `force_close`
- [x] `SessionControlPage`: Timeline de violaciones desde `integrity_flags.events[]`
- [x] `SessionControlPage`: Resumen de secciones para estudiantes entregados
- [x] `SessionControlPage`: Confirm modal antes de force-close
- [x] `WarningModal.jsx` (nuevo): severity selector + mensajes rápidos + textarea + `createPortal`
- [x] `DictationPreview.jsx` (nuevo): vista previa read-only del blueprint por tipo de pregunta con correct_answers
- [x] `DashboardPage`: lazy import + ruta `/dictations/session/:sessionId`
- [x] `MonitorTab`: botón "🎛️ Sala de Control" para la sesión activa seleccionada
- [x] `ListTab`: botón "Sala" por sesión ready/active en el acordeón de cada blueprint
- [x] `CreateTab`: panel post-publish con URL copiable + "Abrir Sala de Control" (en lugar de reset inmediato)
- [x] CSS: ~250 líneas nuevas `ctrl-*` (layout 3 paneles) + `dict-modal-*` + `dict-postpublish-*` + `dict-btn-sala`
- [x] Build limpio · migración aplicada a producción

## Completado — sesión 2026-05-27b (Dictation — 3 modos de evaluación + fixes)

- [x] ASSESSMENT_MODES: 3 modos (dictation, vocab_quiz, combined) con tipos, colores, requiresAudio flag
- [x] ITEM_COUNTS: matriz de conteo por modo × dificultad × tipo de pregunta
- [x] SECTION_META: icon, label, color por cada uno de los 5 tipos de pregunta
- [x] getQuestionCounts(difficulty, assessmentMode): retorna conteo + total
- [x] scoreWriting(): auto-scoring de writing por conteo de palabras requeridas en la respuesta
- [x] scoreDictation(): enhanced — soporta 5 tipos incluyendo matching y writing
- [x] ManualEntryForm: nuevas secciones matching (word → 4 definiciones) y writing (prompt + required_words)
- [x] buildManualSectionsScaffold(difficulty, assessmentMode): ahora mode-aware con scaffolds matching/writing
- [x] exportDictationHtml: nuevos renderers matching/writing + header dinámico por assessmentMode
- [x] dictationAI.js: prompt dinámico basado en assessmentMode — genera los 5 tipos de pregunta
- [x] CreateTab: selector de assessmentMode en Step 1 + normalizeVocab auto-split comas/espacios + loadedSetName
- [x] VocabSetPicker/VocabLibraryTab: separación limpia + auto-sanitize commas en input
- [x] Fix INSERT policy dictation_instances para teacher_insert (migración remota 07c48ba)
- [x] Fix Service Worker v2: non-cacheable requests bypass SW, cache bump v1→v2
- [x] Fix voice preview: Azure TTS Edge Function + cache-buster ?t=Date.now()
- [x] Fix UX layout: vocabulario primero en Step 1, botón con word count + red hint

## Completado — sesión 2026-05-27 (Dictation — 5 mejoras + extracción)

- [x] Extracción de componentes: DictationPage.jsx de 895 líneas → ~50 líneas (shell de tabs) + 6 componentes en `src/components/dictation/`
- [x] CreateTab.jsx: wizard extraído con toggle `entryMode: 'ai' | 'manual'`, integración VocabSetPicker + AudioExportPanel + botón PDF
- [x] ManualEntryForm.jsx: entrada manual de oraciones por sección (listen_type, listen_identify, fill_blank) con datalist de vocabulario
- [x] VocabSetPicker.jsx: selector dropdown de vocabularios guardados + "Guardar lista" en Step 1
- [x] VocabLibraryTab.jsx: CRUD completo de sets de vocabulario (nombre, palabras, grado, materia, período) — 5° tab en DictationPage
- [x] AudioExportPanel.jsx: descarga individual MP3 + ZIP completo con JSZip organizado por sección
- [x] ListTab.jsx: reescritura como biblioteca de dictados — filtros (grado/materia/búsqueda), detalle expandible con secciones+respuestas, sesiones vinculadas, reusar sesión (re-query roster), archivar/restaurar, PDF export
- [x] exportDictationHtml.js: buildDictationHtml + printDictationHtml — header institucional CBF-G AC-01 "LISTENING ASSESSMENT", answer key en página separada
- [x] dictationUtils.js: buildManualSectionsScaffold(difficulty) — scaffold vacío según DIFFICULTY_CONFIG
- [x] Migración SQL: dictation_vocab_sets (id, school_id, teacher_id, name, vocabulary[], grade, subject, period) + RLS owner/school_read
- [x] package.json: jszip ^3.10.1 como dependencia explícita
- [x] Fix voice preview: stopPreview(), cancel on voice change, optgroups 10 voces (8 EN + 2 ES)
- [x] index.css: ~80 líneas adicionales .dict-* para nuevos componentes
- [x] DevStatusPage.jsx: actualizado progress 90→95, works[] y history[]

## Completado — sesión 2026-05-26 (Módulo Dictation — base)

- [x] Migración SQL: 5 tablas (dictation_blueprints, dictation_sessions, dictation_instances, dictation_responses, dictation_results) + RLS + RPC `get_dictation_instance_safe` + trigger + Storage bucket
- [x] dictationUtils.js: DIFFICULTY_CONFIG, VOICE_OPTIONS (10 voces), levenshtein(), scoreTypedWord(), scoreDictation(), generateDictationCode(), QUESTION_POINTS
- [x] dictationAI.js: generateDictation() — 4000 tokens, 3 secciones (listen_type, listen_identify, fill_blank) desde vocabulario + dificultad
- [x] AIAssistant.js: barrel export `generateDictation` desde dictationAI.js
- [x] Edge Function dictation-tts: Azure Cognitive Services SSML → MP3 → Supabase Storage
- [x] Edge Function dictation-corrector: scoring server-side (Levenshtein + exact match) + upsert results + Telegram
- [x] DictationPage.jsx: wizard 3 pasos (vocabulario → IA genera + TTS → publicar) + lista + monitor Realtime + config Telegram
- [x] DictationPlayerPage.jsx: player público /eval/dictation, antitrampa 5 capas (reutiliza exam-integrity-alert), IndexedDB autosave, timer, resultado descargable HTML
- [x] App.jsx: ruta /eval/dictation
- [x] DashboardPage.jsx: lazy import DictationPage + ruta /dictations + sidebar "🎧 Dictados"
- [x] index.css: ~280 líneas .dict-* con responsive
- [x] DevStatusPage.jsx: entrada del módulo dictation (90%, status active)

## Completado — sesión 2026-05-01 (N.3 — Quiz/Final + Logros rediseño)

- [x] examUtils.js: `EXAM_PRESETS` (quiz/final_lower/final_upper), `extractGradeNumber()`, `getExamPreset()`, `finalExamGrade()`
- [x] ExamCreatorPage: selector Quiz / Examen Final en Step 1, banner protocolo en Step 2, sección Extra Points
- [x] ExamCreatorPage: preset auto-ajusta cuando cambia el grado y examType=final
- [x] examAI.js: `buildExamPrompt` diferenciado por tipo — final comprehensivo, quiz parcial
- [x] ExamDashboardPage: badge Quiz/Final en cada examen (vía `metadata.exam_type`)
- [x] examUtils.test.js: 23 tests nuevos (total 161, todos pasando)
- [x] ObjectivesPage.jsx → AchievementsPage.jsx · ruta /objectives → /achievements
- [x] DashboardPage: import + ruta + sidebar "🎯 Logros"
- [x] GuideEditorPage + NewsProjectEditor: referencias /objectives → /achievements
- [x] useAchievements: `getGoalConnections(goalId)` — NEWS, guías y checkpoints vinculados
- [x] AchievementsPage: header gradiente navy + 4 stat cards
- [x] AchievementsPage: filtros tab-group períodos + selects materia/grado
- [x] AchievementsPage: agrupación automática por materia+grado
- [x] GoalCard: borde izquierdo coloreado por estado (verde=publicado, azul=completo, gris=borrador)
- [x] GoalCard: indicadores en 3 columnas por dimensión (cognitivo/procedimental/actitudinal)
- [x] WeightBar: barra visual de peso total (verde=100%, ámbar=incompleto, rojo=excede)
- [x] CompletenessChecklist: 5 ítems (3 dimensiones + peso + NEWS vinculado)
- [x] CascadePanel: NEWS projects, conteo guías y checkpoints evaluados
- [x] GoalFormModal: header gradiente navy, showToast() en vez de alert(), year_verse auto desde schools
- [x] IndicatorFormModal: gradiente del color de dimensión, contexto del logro padre en header
- [x] Empty state: diagrama visual 3 pasos de la cascada pedagógica
- [x] index.css: ~280 líneas de clases `.ach-*` con responsive
- [x] Build limpio + 161 tests pasando

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
