# CBF PLANNER — v6.5
## CLAUDE.md — Documento maestro

> **Principio rector:** *"Nosotros diseñamos. El docente enseña."*
> Léelo completo antes de escribir código. · Última actualización: Mayo 27, 2026

---

## 🏫 CONTEXTO

```
Institución: Colegio Boston Flexible (CBF) — Barranquilla, Colombia
             DANE: 308001800455 · Res. 09685/2019
Plataforma:  CBF Planner → ETA Platform (Experiencia Total de Aprendizaje)
Repo:        ClassroomsOS/cbf-planner  ('ClassroomsOS' con 's' — typo original, no cambiar)
Deploy:      https://classroomsos.github.io/cbf-planner/
Local:       C:\BOSTON FLEX\ClassroomOS\cbf-planner
Supabase:    prod=vouxrqsiyoyllxgcriic · dev=gfjiicfnwpkbkptwgnte
School ID:   a21e681b-5898-4647-8ad9-bdb5f9844094
Admin:       edoardoortiz@redboston.edu.co (role: admin)
Tema 2026:   "AÑO DE LA PUREZA" · Génesis 1:27-28a (TLA)
Notas:       1.0–5.0 · (puntaje/total)×4+1 · Superior≥4.50 · Alto≥4.00 · Básico≥3.50 · Bajo<3.50
Libros:      Uncover 4 (8°) · Evolve 4 (9°) · Cambridge One (digital)
```

---

## 📋 HISTORIAL Y PENDIENTES

- Changelog completo → `docs/claude/changelog.md`
- Roadmap y estado por área → `docs/claude/roadmap.md`

---

## 🏛️ VISIÓN ETA — SCOPE DE DESARROLLO

```
CAPA 1 — DISEÑO DOCENTE           ← activa — no diseñar para capas superiores
CAPA 2 — PRODUCCIÓN MULTIMEDIA    ← pendiente
CAPA 3 — EXPERIENCIA ESTUDIANTIL  ← pendiente
CAPA 4 — EVALUACIÓN INTEGRADA     ← pendiente
CAPA 5 — INTELIGENCIA PEDAGÓGICA  ← pendiente
```

---

## 🧠 LA CASCADA PEDAGÓGICA — LEY DEL SISTEMA

```
SYLLABUS TOPICS → ACHIEVEMENT GOAL → ACHIEVEMENT INDICATORS
  → NEWS PROJECT → LESSON PLAN → CHECKPOINT → EVALUACIÓN
```

> Historial de sesiones y roadmap completo → `docs/claude/roadmap.md`

---

## ⚠️ REGLAS CRÍTICAS — NUNCA VIOLAR

```
1.  minify: false en vite.config.js — NUNCA reactivar
2.  Edge Functions: siempre deploy con --no-verify-jwt
3.  RLS teachers: SIEMPRE usar get_my_school_id() SECURITY DEFINER
4.  JSONB: patrón preferido para datos flexibles
5.  supabase.exe: en raíz del proyecto, en .gitignore
6.  Modelo IA: claude-sonnet-4-20250514 — no cambiar sin avisar
7.  Migraciones: numeradas cronológicamente, nunca editar una ya ejecutada en prod
8.  Nunca borrar datos de producción sin backup explícito
9.  news_legacy: LEGACY — no borrar (datos históricos de proyectos)
10. NUNCA usar window.alert — usar showToast() del ToastContext
11. Grade: ver tabla GRADE+SECTION — hay CHECKs activos en DB, violarlos da error 23514
12. seededShuffle: función canónica en examUtils.js — NUNCA duplicar en componentes
13. helpers de estudiantes: funciones canónicas en studentUtils.js — no duplicar inline
14. Migraciones a prod: siempre link a vouxrqsiyoyllxgcriic antes de db push/query
    Restaurar link a dev (gfjiicfnwpkbkptwgnte) al terminar
15. Tablas DEPRECATED (assessments/questions/student_exam_sessions/assessment_results):
    No crear nuevos registros. Para evaluaciones usar exam_blueprints → exam_sessions
16. DevStatusPage SIEMPRE al día: toda mejora, fix o feature completada debe reflejarse en
    src/pages/DevStatusPage.jsx antes del commit final. Actualizar: progress, status, works[],
    pending[], history[] del módulo afectado. Si hay backlog item relacionado, marcar como 'done'.
```

---

## 📐 GRADE+SECTION — CONVENCIÓN (LEY DEL SISTEMA)

**Confirmado contra datos reales de prod. Hay CHECK constraints activos en DB.**

```
COMBINED "8.° Blue" →  lesson_plans · achievement_goals · achievement_indicators · syllabus_topics · checkpoints
                        CHECK activo: LIKE '%.° %'

BASE "8.°" + section →  teacher_assignments · news_projects · school_students
                         CHECK activo: LIKE '%.°' AND NOT LIKE '% %'
```

- `lesson_plans` tiene AMBAS: `grade = "8.° Blue"` (combined) Y columna `section = "Blue"` separada.
- `lesson_plans` NO tiene columna `week TEXT` — usa `week_number INTEGER` + `date_range TEXT`.
- Dropdowns: SIEMPRE `<select>` con `assignments.map(a => \`${a.grade} ${a.section}\`)` — NUNCA `<input>` libre
- Queries a `lesson_plans`/`achievement_goals`: `.eq('grade', combinedGrade)` — NUNCA `.ilike` ni `.split`
- Queries a `school_students`: `.eq('grade', baseGrade).eq('section', section)`

**NUNCA hacer:**
```js
grade.replace(/\s+[A-Z]$/, '').trim()   // ❌
plan.grade.split(' ')[0]                 // ❌
q.ilike('grade', gradeBase + '%')        // ❌
```

---

## 🐛 GOTCHAS — REGLAS DERIVADAS DE BUGS RESUELTOS

### 1. Editor/modal con entity por prop → siempre `key={entity.id}`
Sin `key`, React reutiliza la instancia y los `useEffect` no disparan.
```jsx
<NewsProjectEditor key={editingProject?.id || 'new'} project={editingProject} />
```

### 2. `indicator_id` FK y `target_indicador` texto siempre sincronizados juntos
```js
updateForm('indicator_id', ind.id)
updateForm('target_indicador', ind.text || '')  // ← habilita botón IA
```
Agregar useEffect de sincronización para proyectos existentes con `indicator_id` pero `target_indicador` vacío.

### 3. LEY DE LA CASCADA — fuente de indicator_id en guías
```
1. NEWS project con actividad evaluativa en la semana de la guía
2. NEWS project con due_date más cercano ≥ primer día de la guía
3. Fallback: primer indicador del achievement_goal del período
```
NUNCA usar solo el período como fuente primaria.

### 4. Gate de IA = `activeIndicator || achievementGoal` — sin legacies
```jsx
{!activeIndicator && !achievementGoal ? <aviso> : <formulario + botón Generar>}
```

### 5. `upsert(onConflict)` solo si la constraint UNIQUE existe en prod
Para operaciones críticas usar check-then-write (busca → update/insert).

### 6. PDFJS_WORKER_URL — versión hardcodeada como trap de mantenimiento
`LibraryPage.jsx` tiene hardcodeado `'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/build/pdf.worker.min.mjs'`.
Al actualizar `pdfjs-dist` en `package.json`, hay que actualizar TAMBIÉN esta URL o el visor PDF falla silenciosamente. Dynamic imports no admiten `?url` de Vite para el worker.

### 6b. ExamPlayerV2 — `section_name` en `exam_instances.generated_questions`
Si `section_name === ''` → preguntas sin tabs. Si hay valores distintos → tabs automáticos. **NUNCA hardcodear `section_name: ''`** — usar `q.section_name || ''`.

### 8. RLS — nunca crear un ciclo entre tablas relacionadas
Si la tabla A tiene una policy que consulta tabla B, y tabla B tiene una policy que consulta tabla A → **infinite recursion**. Síntoma: `ERROR: infinite recursion detected in policy for relation` (código 42P17).
Caso real: `school_library.library_shared_read` → `library_shares`, y `library_shares.shares_doc_owner_read` → `school_library`. Fix: DROP `shares_doc_owner_read` — el dueño ya ve shares via `shares_owner_manage` (`shared_by = auth.uid()`).
**Regla:** las policies de tablas hijas (shares, log, versions) NUNCA deben hacer SELECT a la tabla padre que las referencia.

### 9. PlannerPeriodTimeline — componente separado, requiere props explícitos
`PlannerPeriodTimeline` es una función componente fuera del scope de `PlannerPage`. Variables como `periodStartISO` y `compoundWeeks` deben pasarse como props — nunca asumir acceso a closure del padre.

### 7. exam-integrity-alert — eventos de ciclo vs. violaciones
`CYCLE_EVENTS = ['exam_started', 'exam_resumed', 'exam_submitted']` NO actualizan `integrity_flags`; usan formato Telegram distinto. Cualquier otro `event_type` → violación → actualiza `tab_switches` + mensaje rojo.

---

## 🗄️ BASE DE DATOS — TABLAS EN PRODUCCIÓN

```
teachers              — RLS via get_my_school_id() SECURITY DEFINER · telegram_chat_id text
schools               — features JSONB · year_verse · logo_url · dane · resolution
teacher_assignments   — grade(base) · section · subject · horario JSONB
lesson_plans          — content JSONB · indicator_id · syllabus_topic_id · week_count · status
news_projects         — indicator_id FK · actividades_evaluativas · biblical_principle
rubric_templates      — 5 plantillas institucionales sembradas
achievement_goals     — UNIQUE(teacher_id, subject, grade, period, academic_year)
achievement_indicators— dimension + skill_area · teacher_id (denorm. para RLS)
syllabus_topics       — contenidos por semana · indicator_id FK · library_doc_id · library_pages[]
syllabus_session_resources — plan_id FK · week_number · day_key · resource_type · title · url · fragment_id
                             abc_section · duration_minutes · justification · emphasis_notes
checkpoints           — indicator_id · target_id nullable (legacy) · plan_id
eleot_domains/items/block_mapping — seed inmutable (7 dominios · 28 ítems)
eleot_observations    — historial observaciones Cognia
school_monthly_principles — year_verse · month_verse · indicator_principle por mes
principle_documents       — school_id FK · year int · month int · file_name · file_path · file_size · mime_type
                            uploaded_by FK · principle_id uuid(nullable, legacy FK → school_principles)
                            Storage bucket: class-library · RLS: principle_docs_write usa school_id (docente del mismo colegio)
                            Migración 20260518000001: añade school_id/year/month, hace principle_id nullable, reescribe RLS
weekly_agendas        — grade · section · week_start · content JSONB · status
schedule_slots        — franjas horario institucional por nivel
school_calendar       — is_school_day · affects_planning
news_legacy           — LEGACY — no borrar
school_library        — Biblioteca CBF: doc_type · subjects[] · grades[] · visibility('school'|'personal')
                        RLS: library_personal_owner · library_school_read · library_admin_manage
                             library_admin_oversight (admin ve TODOS los docs personales del colegio)
                             library_shared_read · library_shared_update (recipients via shares)
                        Storage bucket: cbf-library (público) · paths:
                          inst:      {school_id}/inst/{doc_id}/{filename}
                          personal:  {school_id}/personal/{teacher_id}/{doc_id}/{filename}
                        Cuota personal: schools.features.library_quota_gb (default 2 GB)
                        Visores: PDF.js 5 (página a página) · WaveSurfer 7 (waveform) · OpenSeadragon 6 (deep zoom)
                        Carga lazy: pdfjs-dist · wavesurfer.js · openseadragon (dynamic import, no afecta bundle inicial)
library_fragments     — doc_id FK · created_by FK · page_number · region JSONB({x,y,w,h}%) · image_url (Storage)
                        extracted_text (PDF.js text layer) · ai_analysis JSONB (content_type/structured_data/suggested_smartblock)
                        assigned_subject · assigned_grade · assigned_week (ISO)
                        Storage path: cbf-library/{school_id}/fragments/{doc_id}/{id}.webp
                        RLS: fragments_owner (ALL) · fragments_school_read (SELECT)
library_shares        — doc_id FK · shared_by FK · shared_with FK · can_edit bool · UNIQUE(doc_id,shared_with)
                        RLS: shares_owner_manage · shares_admin_manage · shares_recipient_read
library_edit_log      — doc_id FK · editor_id FK · action CHECK('created','updated','restored','shared','file_replaced')
                        old_snapshot jsonb · new_snapshot jsonb · change_summary text
                        RLS: log_visible_to_doc_readers · log_insert_trigger_only
                        Triggers: fn_log_library_create (INSERT) · fn_log_library_edit (UPDATE, skip si app.library_skip_log='true')
                        RPC: library_rollback(p_log_id uuid) SECURITY DEFINER — restaura old_snapshot, registra 'restored'
error_log             — errores de cliente · level · message · stack · page · action
activity_log          — acciones de usuario · action · entity_type · entity_id · description
ai_usage              — uso de tokens IA por docente · input_tokens · output_tokens · cost_usd
error_codes           — catálogo CBF-[MOD]-[TYPE]-[NNN] con descripciones y severity
system_events         — cbf-logger Edge Fn · error_code · module · severity · payload_in/out · duration_ms
system_health_snapshots — snapshots periódicos de salud del sistema (antes llamado health_snapshots en docs)
alert_rules           — umbral-based alerting (threshold_count · threshold_minutes · notify_telegram)
system_alerts         — alertas generadas · status(open/resolved) · telegram_sent
notifications         — notificaciones in-app · school_id · to_id · type · read · data JSONB
messages              — mensajes 1-a-1 · from_id · to_id · school_id · read_at
message_rooms         — salas de mensajería grupal · name · school_id
room_messages         — mensajes de sala · room_id FK · sender_id FK · content
room_participants     — participantes de sala · room_id FK · teacher_id FK

— DEPRECATED (no crear registros nuevos) —
assessments · questions · assessment_versions · student_exam_sessions · student_submissions

— ROSTER —
school_students       — email UNIQUE(school_id,email) · grade(base) · section · student_code(auto)
                        first_name · second_name · first_lastname · second_lastname · representative_email

— EXAM PLAYER —
exam_blueprints       — config pedagógica inmutable post-publicación
                        status(draft|submitted|approved|returned|ready|archived)
                        submitted_at · approved_at · reviewer_id · archive_url
exam_sessions         — access_code · status · teacher_id
exam_instances        — generated_questions JSONB (section_name por pregunta)
                        student_email · student_id FK · student_section · version_label
                        instance_status · integrity_flags · tab_switches · started_at
exam_responses        — auto_score · ai_score · ai_feedback · ai_confidence
                        requires_human_review · ai_correction_status(not_needed|pending|done)
exam_results          — instance_id UNIQUE · colombian_grade · total_score · max_score
                        correction_status(pending|partial|complete)
exam_feedback         — blueprint_id · reviewer_id · action(approved|returned|comment) · comments
                        RLS: supervisor insert, school-wide read
exam_preflight_log · exam_offline_queue · ai_evaluation_queue
ai_evaluations        — resultados de evaluación IA por respuesta · score · feedback · confidence
ai_witness_events     — eventos de testigo durante examen (detección de violaciones)
question_criteria     — criterios por pregunta de examen · criterion_text · max_points
correction_requests   — solicitudes de corrección humana de exam_responses
human_overrides       — correcciones manuales de score y feedback

— DICTATION MODULE —
dictation_blueprints  — vocabulary[] · generated_questions JSONB · audio_urls · difficulty · voice_id
                        teacher_id FK · school_id FK · grade(combined) · subject · unit_reference
                        status(draft|ready|archived) · CHECK difficulty IN ('Basico','Intermedio','Avanzado')
dictation_sessions    — blueprint_id FK · access_code UNIQUE · status(active|closed) · teacher_id · school_id
                        duration_minutes · title · starts_at · ends_at
dictation_instances   — session_id FK · student_id FK · student_name · student_section · access_code UNIQUE
                        instance_status(pending|connected|in_progress|submitted) · violations int
                        started_at · submitted_at · generated_questions JSONB (shuffled per student)
dictation_responses   — instance_id FK · question_index · student_answer · is_correct · score · max_score
dictation_results     — instance_id UNIQUE · total_score · max_score · colombian_grade · section_scores JSONB
                        RPC: get_dictation_instance_safe(p_access_code) — strips correct_answer from questions
                        Storage bucket: dictation-audio (público read)
                        Trigger: set_dictation_instance_status — auto-update on response insert
dictation_vocab_sets  — name · vocabulary TEXT[] · grade · subject · period(1-4)
                        teacher_id FK · school_id FK · created_at · updated_at
                        RLS: vocab_sets_owner (ALL) · vocab_sets_school_read (SELECT)

— MÓDULO PSICOSOCIAL —
student_psychosocial_profiles — status · support_level · flags TEXT[]
                                teacher_notes(visible todos) · confidential_notes(solo psico/rector/admin)
student_observations          — obs_date · obs_type · description · action_taken · next_steps
student_accommodation_plans   — accommodations JSONB · status(draft|active|archived)

— ARCHIVADO (Fase 5) —
lesson_plan_versions  — snapshots inmutables de guías · plan_id FK · version_number · storage_path (HTML en Storage)
news_project_versions — snapshots inmutables de proyectos NEWS · project_id FK · version_number · storage_path
document_feedback     — feedback en guías y documentos · plan_id · from_id · type · comments · status
plan_comments         — comentarios en guías/planes · plan_id · author_id · body

— CALIFICACIÓN —
grading_sessions      — sesiones de calificación grupales · teacher_id · subject · grade · section
micro_activities      — actividades pequeñas evaluables · session_id FK · name · max_score · date
micro_activity_groups — agrupaciones de micro_activities · name · weight
student_activity_grades — notas por micro_activity · student_id FK · activity_id FK · score
qa_runs               — ejecuciones del módulo QA · school_id · run_date · results JSONB · status

— CLASSROOM (Capa 2 — pendiente) —
classroom_sessions    — sesiones de aula virtual · teacher_id · grade · section · start_at
classroom_boards      — pizarras virtuales por sesión · session_id FK · content JSONB
classroom_slides      — diapositivas de clase · session_id FK · order · content JSONB
classroom_documents   — documentos compartidos en sesión · session_id FK · file_url
livekit_rooms         — salas LiveKit para videoclase · room_name · session_id FK
livekit_participants  — participantes LiveKit · room_id FK · teacher_id FK · joined_at
presence_events       — eventos de presencia en clase (asistencia automática) · session_id FK
network_access        — control de acceso de red por estudiante · school_id · allowed bool

— OTROS —
school_levels         — niveles educativos del colegio (elementary/middle/high) · name · grade_range
announcements         — anuncios institucionales · school_id · title · body · expires_at
generated_assets      — assets generados por IA (imágenes, PDFs) · owner_id · asset_url · expires_at
submissions           — entregas de estudiantes (Capa 3 futura) · student_id FK · activity_id FK
```

---

## 📐 CBF SESSION SECTIONS — 6 MOMENTOS (ORDEN DEFINITIVO)

```
1. TOPICS          (key: subject)    ~8 min  — Temarios, contenidos, reglas de clase
2. SUBJECT TO BE WORKED (key: motivation) ~7 min  — Informa vocabulario/actividades del tópico
3. MOTIVATION      (key: activity)   ~10 min — Rompehielos, engagement, activación
4. SKILL DEVELOPMENT (key: skill)    ~25 min — Actividad principal (alumnos ya enganchados)
5. ASSIGNMENT      (key: assignment) ~3 min  — Asignación en clase (OPTATIVA, nunca tarea a casa)
6. CLOSING         (key: closing)    ~5 min  — Recap, cómo se sintieron, dificultades, reflexión bíblica
```

**Labels: SOLO INGLÉS** — sin versión bilingüe.

**REGLAS NO NEGOCIABLES:**
- **Versículo bíblico del indicador** permea TODO el día. Es el hilo conductor obligatorio:
  - MOTIVATION → recordatorio explícito del versículo
  - SKILL DEVELOPMENT → el contenido/actividad conecta con el versículo
  - CLOSING → reflexión de cierre ligada al versículo
- **Reglas de clase** se estipulan siempre en TOPICS (primer momento)
- **ASSIGNMENT** es optativo — si no hay asignación, se deja vacío. NUNCA es tarea para la casa.
- **CLOSING** es SIEMPRE el último momento — recap + sentimientos + reflexión bíblica.

**Keys en DB no cambian** (`subject`, `motivation`, `activity`, `skill`, `assignment`, `closing`) — solo cambian labels y orden visual.

**Archivos que definen secciones:**
- `src/utils/constants.js` → `SECTIONS[]` (fuente de verdad)
- `src/utils/exportDocx.js` / `exportHtml.js` / `exportLegacyDocx.js` → SECTIONS locales para export
- `src/utils/guideAI.js` → prompt IA con instrucciones por sección
- `src/components/editor/BlockEditor.jsx` → `MOMENTO_HINTS` + `SECTION_BLOCKS`

---

## 🧩 SMART BLOCKS — 16 TIPOS

`DICTATION · QUIZ · VOCAB · WORKSHOP · SPEAKING · NOTICE · READING · GRAMMAR · EXIT_TICKET · WRITING · SELF_ASSESSMENT · PEER_REVIEW · DIGITAL_RESOURCE · COLLABORATIVE_TASK · REAL_LIFE_CONNECTION · TEACHER_NOTE`

```json
{ "id": 1234, "type": "WORKSHOP", "model": "stations", "duration_minutes": 20, "data": {...} }
```

Colores, eleot® items y modelos → `src/utils/smartBlockHtml.js` · `src/components/SmartBlocks.jsx`

---

## 🤖 IA — Edge Function `claude-proxy`

**Passthrough puro** → `claude-sonnet-4-20250514`. Detalle completo → `docs/claude/ai-integration.md`.

| Función | Tokens |
|---|---|
| `suggestSectionActivity()` | 2500 |
| `analyzeGuide()` | 4000 |
| `generateGuideStructure()` | 16000 |
| `suggestSmartBlock()` | 1200 |
| `generateRubric()` | 4000 |
| `generateIndicadores()` | 1500–2000 |
| `importGuideFromDocx()` | 8000 |
| `analyzeGuideCoverage()` | 1800 |
| `generateStudentRubric()` | 3000 |
| `generateExamQuestions()` | 9000/sección |
| `analyzeTextbookFragment()` | 1500 — Claude Vision: clasifica región de documento → SmartBlock sugerido |
| `analyzeTextbookPages()` | 2000 — Claude Vision: 1-5 páginas (URLs o `{pageNum,base64}`) → `{unit_summary, key_concepts, vocabulary, grammar_points, suggested_week_plan, suggested_smartblocks}` |
| `generateGuideStructure()` | acepta `textbookFragments` — fluyen como texto + imágenes reales (`imageBlocks`) a Claude. Máx. 5 imágenes (fragmentos primero, NEWS después) |
| `analyzeBookPages()` | 2000 — syllabusAI.js: Vision batch (5 págs) → `[{page, content_type, complexity, subunit, is_workbook, summary, estimated_minutes}]` — preservado para LibraryPage |
| `deepAnalyzeBookPages()` | 3000 — syllabusAI.js: Vision enriquecido → + grammar_points[], vocabulary_topics[], exercise_types[], prerequisite_knowledge, teaching_challenges |
| `classifySubunitsAI()` | 3000 — syllabusAI.js: clasifica subunidades por dificultad (easy/moderate/dense), estimated_sessions, ai_rationale |
| `generateTeachingStrategiesAI()` | 4000 — syllabusAI.js: estrategias pedagógicas para subunidades 'dense' (scaffolding, errores comunes, apoyos visuales, flujo de sesiones) |
| `distributePagesByWeek()` | 2500 — syllabusAI.js: distribuye páginas según schedule + subunit_classification + teaching_strategies + start_unit → key_grammar[], key_vocabulary[], suggested_approach por día |
| `advisorCheckSession()` | 1200 — syllabusAI.js: valida factibilidad de tiempo por sesión; skip AI si claramente factible/sobrecargado |
| `generateDictation()` | 4000 — dictationAI.js: genera 3 secciones dictation (listen+type, listen+identify, fill_blank) desde vocabulario + dificultad → JSON con items + correct_answer + audio_text |

**Reglas de comportamiento no documentadas en ai-integration.md:**
- `generateGuideStructure` acepta `piarData?: { [category]: string[] }` — acomodaciones sin nombres de estudiantes. `GuideEditorPage` las consulta y pasa al modal; `ConversationalGuideModal` muestra aviso naranja en paso 3.
- `generateExamQuestions` acepta `sections: [{id, name, types}]` — una llamada IA por sección; preguntas etiquetadas con `section_name` client-side. `sections` toma precedencia sobre `questionTypes` plano (legacy).
- `AIGeneratorModal` gate: `(!activeIndicator && !achievementGoal)` — sin legacies. Ver Gotcha #4.
- `exam-response-corrector` Edge Fn: confianza < 0.65 → `requires_human_review=true`. Fallback Claude falla → `score=0, requires_review=true` (no bloquea al estudiante).
- `generateDictation` acepta `{ vocabulary, unitReference, grade, subject, difficulty }` — genera JSON con 3 secciones (listen_type, listen_identify, fill_blank). Items incluyen `audio_text`, `correct_answer`, `options[]` (MC), `max_score`. Dificultad controla conteo: Basico=18, Intermedio=24, Avanzado=28.
- `dictation-tts` Edge Fn: Azure Cognitive Services SSML → MP3. Input: `{ texts[], voice_id, speed, blueprint_id, school_id, section }`. Output: `{ audio_urls[] }`. Env: `AZURE_TTS_KEY`, `AZURE_TTS_REGION`.
- `dictation-corrector` Edge Fn: scoring determinístico (no IA). Levenshtein para typed words (exact=100%, lev≤1=50%), exact match para MC. Upsert `dictation_results` + Telegram al docente con nota colombiana + código anónimo (last-6 instance_id).
- `DictationPlayerPage` reusa `exam-integrity-alert` Edge Fn para anti-cheat Telegram con `event_type: 'dictation_violation'`.
- `buildManualSectionsScaffold(difficulty)` en `dictationUtils.js`: scaffold vacío según DIFFICULTY_CONFIG para modo manual. Retorna 3 secciones con items vacíos listos para llenar.
- `exportDictationHtml.js`: `buildDictationHtml({ blueprint, logoBase64, school, teacherName })` + `printDictationHtml()`. Header CBF-G AC-01 "LISTENING ASSESSMENT". Answer key en página separada. Colores: listen_type=#4BACC6, listen_identify=#8064A2, fill_blank=#F79646.

---

## 🔐 RLS — PATRÓN ESTÁNDAR

```sql
ALTER TABLE [tabla] ENABLE ROW LEVEL SECURITY;
CREATE POLICY "[tabla]_owner" ON [tabla] FOR ALL USING (teacher_id = auth.uid());
CREATE POLICY "[tabla]_school" ON [tabla] FOR SELECT USING (school_id = get_my_school_id());
```

---

## 🗂 ROLES

| Perfil | Rol DB | Capacidades |
|---|---|---|
| Docente | `teacher` | Guías, NEWS, mensajes propios |
| Dir. de grupo | `teacher` + `homeroom_grade` | + Agenda de su grupo |
| Co-teacher | `teacher` + `coteacher_grade` | + Agenda del grupo asignado |
| Psicopedagoga | `psicopedagoga` | + Calendario, horario, ver todos los planes |
| Rector | `rector` | = Admin completo + vista Director + feedback |
| Coordinador | `admin` | Gestión docentes, roles, feature flags |
| Superadmin | `superadmin` | Todo + identidad institucional + seguridad |

Helpers → `src/utils/roles.js`: `canManage · isSuperAdmin · isRector · canAccessCalendar · canReadAllPlans · canManageAgendas · canGiveFeedback · canEditOthersDocs · isCoteacherActive · canChangeRole · roleLabel · ROLE_STYLES`

---

## 🔗 CÓDIGO — ESTADO ACTUAL

### Rutas activas — DashboardPage.jsx
```
// PEDAGÓGICO (todos los roles)
/              PlannerPage              /plans         MyPlansPage
/editor/:id    GuideEditorPage          /library       GuideLibraryPage
/principles    PrinciplesPage           /achievements  AchievementsPage
/syllabus      SyllabusPage             /biblioteca    LibraryPage
/news          NewsPage                 /news/timeline NewsTimelinePage
/messages      MessagesPage             /ai-usage      AIUsagePage
/students      StudentsPage             /exams         ExamDashboardPage
/exams/create  ExamCreatorPage          /exams/review  ExamReviewPage
/exams/:id     ExamViewPage             /psicosocial   PsicosocialPage
/coverage      PeriodCoverageDashboard  /observations  ObservationLoggerPage
/player        StudentPlayerPage        /player/:studentId StudentDetailPage
/grades        GradebookPage            /grades/quick/:id  QuickGradePage
/grading       GradingHubPage           /grading/session/:id GradingSessionPage
/grading/display/:id GradingDisplayPage /grading/history    GradingHistoryPage
/dictations    DictationPage

// ROLES ESPECIALES
/agenda        AgendaPage    /director  DirectorPage
/schedule      SchedulePage  /calendar  CalendarPage

// SOLO ADMIN
/teachers      AdminTeachersPage   /notifications    NotificationsPage
/curriculum    CurriculumPage      /sala-revision    ReviewRoomPage
/subjects      SubjectManagerPage  /settings         SettingsPage
/exams/revision ExamRevisionPage   /academic-calendar AcademicCalendarPage

// SOLO SUPERADMIN → /superadmin    SuperAdminPage
// PÚBLICO (sin auth) → /eval       ExamPlayerV2Page · /eval/dictation  DictationPlayerPage
```

### Estado clave — ExamPlayerV2Page
```javascript
localStorage['cbf_exam_entry'] = { code, email, name, section } // persiste para iOS
violationAlert  // { title, message, isFullscreen } | null — banner rojo bloqueante
sections        // [{ name, indices[] }] — de q.section_name; hasMultipleSections
// Telegram: código last-6 de instance_id, nunca PII
sendTelegramNotification(eventType, extra) // sin throttle, para ciclo
```

### Estado clave — DictationPage (shell + componentes)
```javascript
// DictationPage.jsx: shell ~50 líneas con 5 tabs → componentes en src/components/dictation/
// CreateTab.jsx: wizard 3 pasos con entryMode ('ai' | 'manual')
//   - manualSections state para modo manual (ManualEntryForm.jsx)
//   - VocabSetPicker integrado en Step 1
//   - AudioExportPanel integrado en Step 2
//   - handleGenerateAudio(sourceOverride) — acepta override para evitar async setState race
// ListTab.jsx: biblioteca de dictados — filtros, detalle expandible, reusar sesión, archivar
// VocabLibraryTab.jsx: CRUD de dictation_vocab_sets (5° tab "📚 Vocabulario")
// MonitorTab.jsx: monitor Realtime extraído
// ConfigTab.jsx: configuración Telegram extraída
// exportDictationHtml.js: buildDictationHtml + printDictationHtml (header LISTENING ASSESSMENT)
```

### Estado clave — DictationPlayerPage
```javascript
localStorage['cbf_dict_entry'] = { code, name, section } // persiste para iOS
phase           // 'entry' | 'instructions' | 'dictation' | 'submitted'
violations      // int — multi-event anti-cheat detection (same 5-layer as ExamPlayerV2)
activeSection   // 0-based index into sections (listen_type, listen_identify, fill_blank)
answers         // { [globalIndex]: string } — IndexedDB autosave
correctAnswersRef // useRef — correct_answer never in React state (DevTools security)
// Telegram: reuses exam-integrity-alert Edge Fn with event_type 'dictation_*'
// TTS: Azure Cognitive Services MP3 from Supabase Storage bucket dictation-audio
// Scoring: Levenshtein fuzzy for typed words, exact match for MC — server verifies via dictation-corrector
```

### Estado clave — GuideEditorPage / PlannerPage
```javascript
linkedAchievementGoal       // achievement_goal completo + indicators[]
linkedAchievementIndicator  // indicator vinculado (indicator_id)
relinkLoading / relinkOptions
activeAchievementGoal       // PlannerPage — fetched async
plannerActiveNewsProject    // PlannerPage — fuente primaria de indicator_id
```

### Estado clave — SyllabusPage + SyllabusWizard
```javascript
// SyllabusPage: 3 viewModes — 'list' | 'plan' | 'wizard'
// SyllabusWizard v2 (src/components/SyllabusWizard.jsx): 5 fases
//   1. StepSelect   — elige libro PDF, escanea TOC, selecciona unidades.
//                     Si spread detectado (bookPages > pdfPages*1.3): renderiza thumbnails de todas
//                     las hojas del PDF, usuario clica hoja inicial y final → escanea ese rango de hojas.
//                     Si PDF normal: escanea por rango de páginas del libro directamente.
//                     Selector "Iniciar desde la Unidad N" (start_unit)
//   2. StepAnalyze  — display enriquecido: grammar_points[], vocabulary_topics[], exercise_types[],
//                     prerequisite_knowledge, teaching_challenges — cards expandibles
//   3. StepClassify — classifySubunitsAI: subunidades por dificultad (easy/moderate/dense),
//                     sesiones editables con +/−, ai_rationale expandible, barra de sesiones
//   4. StepStrategies — generateTeachingStrategiesAI: estrategias para subunidades 'dense',
//                       introduction, scaffolding[], common_mistakes[], visual_aids[], session_flow
//                       — editables inline antes de aceptar
//   5. StepDistribute — distributePagesByWeek (con classification+strategies+start_unit),
//                       key_grammar[], key_vocabulary[], suggested_approach por día;
//                       sub-tabs: Distribución | Recursos | Publicar
//
// DB: syllabus_plan.subunit_classification jsonb, teaching_strategies jsonb, start_unit int
//     (migración 20260518000002)
//
// syllabusAI.js: deepAnalyzeBookPages(), classifySubunitsAI(),
//               generateTeachingStrategiesAI(), distributePagesByWeek() (enhanced), advisorCheckSession()
//               analyzeBookPages() — preservado para LibraryPage PDF viewer (no usar en wizard)
//
// Pipeline guías: GuideEditorPage fetches syllabus_plan.teaching_strategies por subject/grade/period
//                 → pasa a ConversationalGuideModal → generateGuideStructure recibe teachingStrategies
//                 → bloque '🎓 TEACHING STRATEGIES' en prompt con instrucciones MOTIVATION+SKILL
```

### Provider pattern — CRÍTICO (no romper)
```jsx
export default function DashboardPage({ session, teacher, setTeacher }) {
  return (
    <FeaturesProvider schoolId={teacher.school_id}>
      <ToastProvider>
        <DashboardInner session={session} teacher={teacher} setTeacher={setTeacher} />
      </ToastProvider>
    </FeaturesProvider>
  )
}
// useFeatures() y useToast() SOLO en DashboardInner, nunca en DashboardPage
```

---

## 💻 COMANDOS

```bash
npm run dev          # localhost:5173/cbf-planner/ — dev DB
npm run dev:prod     # localhost:5173/cbf-planner/ — prod DB
git add . && git commit -m "feat: ..." && git push   # deploy automático ~2 min
.\supabase.exe functions deploy <fn> --no-verify-jwt
.\supabase.exe functions logs <fn>
```

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

---

*CBF Planner · ETA Platform · Edoardo Ortiz + Claude Sonnet · Barranquilla 2026*
*"Nosotros diseñamos. El docente enseña." · CLAUDE.md v6.5 — Mayo 27, 2026*
