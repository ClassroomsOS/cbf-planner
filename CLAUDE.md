# CBF PLANNER — v5.2
## CLAUDE.md — Documento maestro

> **Principio rector:** *"Nosotros diseñamos. El docente enseña."*
> Léelo completo antes de escribir código. · Última actualización: Abril 25, 2026

---

## 🏫 CONTEXTO

```
Institución: Colegio Boston Flexible (CBF) — Barranquilla, Colombia
             DANE: 308001800455 · Res. 09685/2019
Plataforma:  CBF Planner → ETA Platform (Experiencia Total de Aprendizaje)
Repo:        ClassroomsOS/cbf-planner  ('ClassroomsOS' con 's' — typo original, no cambiar)
Deploy:      https://classroomsos.github.io/cbf-planner/
Local:       C:\BOSTON FLEX\ClassroomOS\cbf-planner
Supabase:    vouxrqsiyoyllxgcriic
School ID:   a21e681b-5898-4647-8ad9-bdb5f9844094
Admin:       edoardoortiz@redboston.edu.co (role: admin)
Tema 2026:   "AÑO DE LA PUREZA" · Génesis 1:27-28a (TLA)
Notas:       1.0–5.0 · (puntaje/total)×4+1 · Superior≥4.6 · Alto≥4.0 · Básico≥3.0
Libros:      Uncover 4 (8°) · Evolve 4 (9°) · Cambridge One (digital)
```

---

## 🔜 SPRINT ACTUAL — SESIÓN L

**1. Sistema antitrampa NIVEL MÁXIMO — ExamPlayerV2Page (ExamPhase)**

| Capa | Qué implementar |
|---|---|
| **1 — Detección multi-evento** | `visibilitychange` + `window blur` + `fullscreenchange`/`webkitfullscreenchange` + `resize` (DevTools: `outerWidth - innerWidth > 160`) + `keydown` global (F12, Ctrl+Shift+I/J, Ctrl+U/W/T/N, Alt+F4, Cmd+W/T/N/Tab/Space) + `beforeunload` + `contextmenu` + `copy/cut/paste` + `pagehide`/iOS + `MutationObserver` en body. Cada evento → DB + Telegram + badge rojo. |
| **2 — Marca de agua canvas** | `<canvas>` `position:fixed` `z-index:9999` `pointer-events:none`. Texto: "NombreCompleto · Versión B · 22 abr · 9:14 am" diagonal -30°, grid ~200px, opacity 0.08. Redibujar en `requestAnimationFrame`. `MutationObserver` reinserta si alguien borra el nodo. Fallback iOS: div con texto en grid. |
| **3 — Fullscreen adaptativo** | Desktop: `requestFullscreen()` obligatorio al "Iniciar"; salida → modal alerta + cuenta evento. iPad iOS Safari (no soporta fullscreen) → "modo quiosco": banner rojo fijo top:0 + body scroll bloqueado + pinch-to-zoom bloqueado. Detectar iOS: `/iPad\|iPhone\|iPod/.test(navigator.userAgent) \|\| (platform==='MacIntel' && maxTouchPoints>1)` |
| **4 — Telegram en tiempo real** | Nueva Edge Function `exam-integrity-alert`. POST `{ session_id, student_name, exam_title, event_type, count, teacher_id }` → lee `teachers.telegram_chat_id` → Telegram Bot API. Primera alerta inmediata; throttle 1/60s por estudiante. Fallback sin chat_id: solo `integrity_flags` JSONB. **Migración nueva:** `teachers.telegram_chat_id text`. |
| **5 — Matriz de pruebas** | Verificar CADA combo antes de marcar completo: iPad Safari/Chrome · MacBook Air Safari/Chrome/Firefox · Mac Safari/Chrome. Verificar: fullscreen/fallback · visibilitychange · blur · marca de agua · Telegram recibido · badge en pantalla. |

**Límites honestos del navegador:** Alt+Tab del OS y botón Home físico del iPad no pueden bloquearse — solo detectarse. Screenshots del sistema tampoco — la marca de agua es la única contramedida.

**2. Flujo docente → generar exámenes por roster**
- ExamDashboardPage: botón "Generar exámenes" → llama `exam-instance-generator` con grade + section (ya no `students[]` manual)
- Mostrar progreso: cuántos generados / total del roster
- Estado de cada instancia: ⏳ pendiente · ✅ listo · 🔴 sin roster

**3. Dashboard de resultados** — quién presentó, quién no, notas, alertas de integridad

**4. Panel revisión humana** — correcciones AI con confianza < 0.65

**5. Login/Auth** — "Olvidé mi contraseña" + email automático al crear docente

---

## 🏛️ VISIÓN ETA — 5 CAPAS

```
CAPA 1 — DISEÑO DOCENTE           ← activa (sprint actual)
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

- **ACHIEVEMENT INDICATORS** — dimension (cognitivo/procedimental/actitudinal) + skill_area: `speaking|listening|reading|writing|general|null`
  - Si skill_area tiene valor → NEWS hereda rubric_template automáticamente
- **NEWS PROJECT** — indicator_id FK · rubric pre-seleccionada por skill_area
- **LESSON PLAN** — indicator_id · syllabus_topic_id · smart_blocks (duration_minutes + eleot_items) · session_agenda auto-generada
- **EVALUACIÓN** — rúbrica → nota 1.0–5.0 · indicador marcado "evaluado"

---

## ✅ HISTORIAL DE SESIONES

| Sesión | Entregables principales | Estado |
|---|---|---|
| **BASE** | Auth · perfiles · dashboard · sidebar · GuideEditor · Export DOCX/HTML/PDF · IA · NEWS · Comunicación · Admin · Roles · Checkpoints | ✅ prod |
| **A** | achievement_goals + achievement_indicators (skill_area) · syllabus_topics · lesson_plans.indicator_id · useAchievements · useSyllabus · ObjectivesPage · SyllabusPage | ✅ prod |
| **B** | NewsProjectEditor: indicator_id + filtro rubric por skill_area · GuideEditorPage: pre-fill indicator + topic · CheckpointModal: dual-write | ✅ prod |
| **C** | eleot_domains/items/block_mapping (seed inmutable) · useEleot · EleotCoveragePanel | ✅ prod |
| **D** | 16 Smart Blocks + duration_minutes · guessSmartBlock() · DOCX para los 16 tipos | ✅ prod |
| **E** | AgendaGenerator · ConversationalGuideModal (wizard 5 pasos) · analyzeGuideCoverage · generateStudentRubric · DOCX 7 nuevos tipos | ✅ prod |
| **F** | Grade+Section fix sistémico · N logros por período · combinedGrade() · SyllabusPage dinámico · Duplicar para sección · NewsProjectEditor fix indicadores | ✅ prod |
| **G** | indicator_id fluye en guías · repair automático load() · botón 🔄 re-vincular · AIGeneratorModal con nuevo sistema · CheckpointModal check-then-write | ✅ prod |
| **H** | SubjectManagerPage · GuideLibraryPage · PeriodCoverageDashboard · ObservationLoggerPage · ReviewRoomPage · CurriculumPage · AgendaPage · PrinciplesPage | ✅ prod |
| **LEGACY** | learning_targets eliminado del frontend · LearningTargetsPage/Selector eliminados · isModeloB derivado de MODELO_B_SUBJECTS · checkpoints.target_id NOT NULL eliminado · learning_targets eliminado de DB | ✅ prod |
| **I** | suggestSectionActivity enriquecida (textbook + archetypes) · DOCX single-column fix · Legacy DOCX secciones+imágenes · Preview modal todos los formatos · downloadRubricHtml | ✅ prod |
| **J** | ExamDashboardPage: N versiones + rigor UI · exportExamHtml CBF-G AC-01 · seededShuffle + round-robin en ExamPlayerPage · callout examen en PlannerPage | ✅ prod |
| **K** | school_students (roster) · StudentsPage (/students) · ExamPlayerV2Page: email auth · exam-instance-generator auto-roster · Migración 20260422000004 | ✅ prod |
| **L** | ← **SPRINT ACTUAL** (ver sección arriba) | 🔜 |

> Para el roadmap detallado y backlog → `docs/claude/roadmap.md`

---

## ⚠️ REGLAS CRÍTICAS — NUNCA VIOLAR

```
1. minify: false en vite.config.js — NUNCA reactivar
2. Edge Functions: siempre deploy con --no-verify-jwt
3. RLS teachers: SIEMPRE usar get_my_school_id() SECURITY DEFINER
4. JSONB: patrón preferido para datos flexibles
5. supabase.exe: en raíz del proyecto, en .gitignore
6. Modelo IA: claude-sonnet-4-20250514 — no cambiar sin avisar
7. Migraciones: numeradas cronológicamente, nunca editar una ya ejecutada en prod
8. Nunca borrar datos de producción sin backup explícito
9. news_legacy: LEGACY — no borrar (datos históricos de proyectos)
10. NUNCA usar window.alert — usar showToast() del ToastContext
11. Grade SIEMPRE combined: ver sección GRADE+SECTION abajo
```

---

## 📐 GRADE+SECTION — CONVENCIÓN (LEY DEL SISTEMA)

`teacher_assignments` almacena `grade="8.°"` + `section="Blue"` por separado.
**En todas las demás tablas el grade es SIEMPRE combinado: `"8.° Blue"`.**

```
COMBINED →  achievement_goals · achievement_indicators · syllabus_topics · lesson_plans · checkpoints
SEPARADOS → teacher_assignments (grade + section)
            news_projects (excepción histórica: grade base + section)
```

**Reglas de código:**
- Dropdowns: SIEMPRE `<select>` con `assignments.map(a => \`${a.grade} ${a.section}\`)` — NUNCA `<input>` libre
- Queries: `.eq('grade', combinedGrade)` — NUNCA `.ilike` ni `.split(' ')[0]`
- NewsProjectEditor construye `gradeFull = form.grade + ' ' + form.section` para buscar en `achievement_goals`

**NUNCA hacer:**
```js
grade.replace(/\s+[A-Z]$/, '').trim()   // ❌ stripea la sección
plan.grade.split(' ')[0]                 // ❌
q.ilike('grade', gradeBase + '%')        // ❌
```

---

## 🐛 GOTCHAS — REGLAS DERIVADAS DE BUGS RESUELTOS

### 1. Editor/modal con entity por prop → siempre `key={entity.id}`
Sin `key`, React reutiliza la instancia y los `useEffect` no disparan si las deps no cambiaron.
```jsx
<NewsProjectEditor key={editingProject?.id || 'new'} project={editingProject} />
```
Deps del useEffect que carga datos secundarios deben incluir TODAS las fields del entity relevantes (incl. `form.section`, `teacher.school_id`).

### 2. `indicator_id` FK y `target_indicador` texto siempre sincronizados juntos
El botón IA verifica `form.target_indicador`. Al seleccionar indicador del nuevo sistema:
```js
updateForm('indicator_id', ind.id)
updateForm('target_indicador', ind.text || '')  // ← habilita botón IA
```
Agregar useEffect de sincronización para proyectos existentes que tengan `indicator_id` pero `target_indicador` vacío.

### 3. LEY DE LA CASCADA — fuente de indicator_id en guías
```
1. NEWS project con actividad evaluativa en la semana de la guía
2. NEWS project con due_date más cercano ≥ primer día de la guía
3. Fallback: primer indicador del achievement_goal del período
```
NUNCA usar solo el período como fuente primaria. En el repair de `load()` no filtrar por `indicator_id IS NOT NULL` — tomar el proyecto más próximo y verificar después.

### 4. Gate de IA = `activeIndicator || achievementGoal` — sin legacies
```jsx
{!activeIndicator && !achievementGoal ? <aviso> : <formulario + botón Generar>}
```
Nunca agregar un tercer gate que dependa de una tabla legacy.

### 5. `upsert(onConflict)` solo si la constraint UNIQUE existe en prod
Para operaciones críticas (checkpoints, logs) usar check-then-write:
```js
// busca existente → update si existe, insert si no
```

---

## 🗄️ BASE DE DATOS — TABLAS EN PRODUCCIÓN

```
teachers              — RLS via get_my_school_id() SECURITY DEFINER
schools               — features JSONB · year_verse · logo_url · dane · resolution
teacher_assignments   — asignaciones materia/grado/sección/horario JSONB
lesson_plans          — content JSONB · indicator_id · syllabus_topic_id
                        eleot_coverage {} · session_agenda [] · week_count · status
news_projects         — indicator_id FK → achievement_indicators · actividades_evaluativas
                        biblical_principle · indicator_verse_ref · biblical_reflection
rubric_templates      — 5 plantillas institucionales sembradas
achievement_goals     — UNIQUE(teacher_id, subject, grade, period, academic_year)
achievement_indicators— dimension + skill_area · teacher_id (denorm. para RLS)
syllabus_topics       — contenidos por semana · indicator_id FK
checkpoints           — indicator_id · target_id nullable (legacy) · plan_id
eleot_domains         — 7 dominios A–G (seed inmutable)
eleot_items           — 28 ítems A1–G3 (seed inmutable)
eleot_block_mapping   — block_type → item_id + weight (seed inmutable)
eleot_observations    — historial observaciones Cognia
school_monthly_principles — year_verse · month_verse · indicator_principle por mes
weekly_agendas        — grade · section · week_start · content JSONB · status
schedule_slots        — franjas del horario institucional por nivel
school_calendar       — días hábiles · is_school_day · affects_planning
news_legacy           — LEGACY — no borrar
error_log · activity_log · ai_usage

— MÓDULO DE EVALUACIÓN (backend completo, probado E2E) —
assessments           — title · grade · subject · access_code · status · rubric_criteria JSONB · biblical_min
questions             — question_type · stem · options JSONB · correct_answer
                        rigor_level ENUM('strict'|'flexible'|'conceptual') · points · position
question_criteria     — criterio corrección pregunta abierta · rubric_level · rigor_level
assessment_versions   — version_number · version_label ('A'/'B'/'C'/'D') · is_base
                        shuffle_questions · shuffle_options
student_exam_sessions — access_code join · started_at · submitted_at · total_score
                        integrity_flags JSONB · assessment_version_id FK
student_submissions   — answer_text · is_correct · ai_score · ai_confidence · ai_feedback
                        needs_human_review · human_score · human_reviewer_id
exam_ai_queue         — cola corrección AI · status(pending/processing/done/failed) · retry_count
cbf_error_log         — errores CBF-[MOD]-[TYPE]-[NNN] · severity · school_id
health_snapshots      — métricas de salud cada 6h · cron via pg_net

— ROSTER (Ses. K) —
school_students       — email UNIQUE(school_id,email) · grade(combined) · section
                        student_code auto (trigger: "9B-001") · teacher_id FK

— SCHEMA EXAM PLAYER —
exam_blueprints       — configuración pedagógica inmutable post-publicación
exam_sessions         — access_code · status · service_worker_payload
exam_instances        — generated_questions JSONB · student_email · student_id FK
                        student_section · version_label · instance_status · integrity_flags
exam_responses        — respuestas polimórficas · response_origin · auto/ai/human score
exam_results          — nota trigger · colombian_grade 1.0–5.0
exam_preflight_log    — checks T-24h / T-0h / T-30min
exam_offline_queue    — cola offline → sync al reconectar
```

---

## 🧩 SMART BLOCKS — 16 TIPOS ACTIVOS

| Tipo | Color | eleot® principales |
|---|---|---|
| `DICTATION` | 4BACC6 | D3, E3, F4 |
| `QUIZ` | C0504D | B2, E1, E3, B4 |
| `VOCAB` | 9BBB59 | D3, B2, E3 |
| `WORKSHOP` | F79646 | D3, D4, B4, C3 |
| `SPEAKING` | 8064A2 | D1, B4, D3, G3 |
| `NOTICE` | 1F3864 | F4, F3 |
| `READING` | 17375E | D3, B4, D2, E3 |
| `GRAMMAR` | 375623 | B2, E3, D3, E1 |
| `EXIT_TICKET` | C55A11 | E1, E4, B5 |
| `WRITING` | 70AD47 | D3, B4, B3, E2 |
| `SELF_ASSESSMENT` | E1A24A | E1, E2, E4, B5 |
| `PEER_REVIEW` | C3785B | C3, E2, D1, C2 |
| `DIGITAL_RESOURCE` | 4BACC6 | G1, G2, D3 |
| `COLLABORATIVE_TASK` | 4F81BD | D4, D1, C3, A2 |
| `REAL_LIFE_CONNECTION` | 70AD47 | D2, D3, B4 |
| `TEACHER_NOTE` | 767171 | A1, A3 |

```json
{ "id": 1234, "type": "WORKSHOP", "model": "stations", "duration_minutes": 20, "data": { "stations": [...] } }
```

**Archivos:** `src/utils/smartBlockHtml.js` (BLOCK_TYPES + preview/interactive HTML) · `src/components/SmartBlocks.jsx` (modal 3 pasos + BlockForm)

---

## 🤖 IA — Edge Function `claude-proxy`

**Passthrough puro** — prompt en `AIAssistant.js` → `claude-sonnet-4-20250514`. No cambiar modelo sin avisar.

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

**Flujo indicator_id → IA:**
```
NEWS project más próximo → indicator_id → achievement_indicator → achievement_goal
  → generateGuideStructure recibe achievementGoal { text, period, indicators[] }
  → bloque 🎯 LOGRO E INDICADORES DEL PERÍODO en el prompt
```

**`suggestSectionActivity` — contexto enriquecido:**
- Recibe `newsProject` (GuideEditorPage → DayPanel → AISuggestButton)
- Bloque `📚 TEXTBOOK & PROJECT CONTEXT`: book, units[], grammar[], vocabulary[], skill
- Lengua automática: `MODELO_B_SUBJECTS` → inglés; resto → español
- `ACTIVITY_ARCHETYPES[lang][section]` — 10-15 arquetipos; selección vía `variantSeed = Math.random()*10000`
- Botón "🔄 Otra sugerencia" llama IA directamente (no solo limpia estado)

**AIGeneratorModal gate:** `(!activeIndicator && !achievementGoal)` — sin legacies. Ver Gotcha #4.

---

## 🔐 RLS — PATRÓN ESTÁNDAR

```sql
ALTER TABLE [tabla] ENABLE ROW LEVEL SECURITY;
CREATE POLICY "[tabla]_owner" ON [tabla] FOR ALL USING (teacher_id = auth.uid());
CREATE POLICY "[tabla]_school" ON [tabla] FOR SELECT USING (school_id = get_my_school_id());
-- Tablas estáticas eleot® → lectura pública:
CREATE POLICY "eleot_read_all" ON eleot_domains FOR SELECT USING (true);
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

Helpers en `src/utils/roles.js`: `canManage` · `isSuperAdmin` · `isRector` · `canAccessCalendar` · `canReadAllPlans` · `canManageAgendas` · `canGiveFeedback` · `canEditOthersDocs` · `isCoteacherActive` · `canChangeRole` · `roleLabel` · `ROLE_STYLES`

---

## 🔗 CÓDIGO — ESTADO ACTUAL

### Rutas activas — DashboardPage.jsx
```javascript
// FLUJO PEDAGÓGICO (todos los roles)
/principles    PrinciplesPage           Versículo Año + Versículo Mes
/objectives    ObjectivesPage           CRUD achievement_goals + indicators
/syllabus      SyllabusPage             CRUD syllabus_topics por semana
/news          NewsPage                 Listado + NewsProjectEditor (wizard 8 pasos)
/              PlannerPage              Crear guía
/plans         MyPlansPage              Mis guías
/editor/:id    GuideEditorPage          Editor completo
/library       GuideLibraryPage         Biblioteca de guías aprobadas
/ai-usage      AIUsagePage              Monitor de tokens IA
/messages      MessagesPage             Mensajería 1-a-1
/students      StudentsPage             Roster de alumnos (agregar / CSV)
/coverage      PeriodCoverageDashboard  Cobertura eleot® acumulada (admin)
/observations  ObservationLoggerPage    Observaciones Cognia (admin)

// ROLES ESPECIALES
/agenda        AgendaPage               Homeroom + co-teacher + admin
/director      DirectorPage             Rector
/schedule      SchedulePage             Admin + rector + psicopedagoga
/calendar      CalendarPage             Admin + psicopedagoga

// SOLO ADMIN
/teachers      AdminTeachersPage        CRUD docentes + asignaciones
/notifications NotificationsPage        Centro de notificaciones
/curriculum    CurriculumPage           Malla curricular
/sala-revision ReviewRoomPage           Revisión de guías publicadas
/subjects      SubjectManagerPage       Gestión de materias
/settings      SettingsPage             Feature flags + horario institucional

// SOLO SUPERADMIN
/superadmin    SuperAdminPage           Identidad institucional + seguridad
```

### Hooks — src/hooks/
```javascript
useAchievements.js    // CRUD achievement_goals + indicators + getPeriodProgress()
useSyllabus.js        // CRUD syllabus_topics · byWeek Map · getTopicsForWeek(week)
useActiveNews.js      // NEWS activo · buildNewsPromptContext()
useEleot.js           // computeCoverage · domainStatus · suggestions
useNewsProjects.js    // CRUD news_projects
useRubricTemplates.js // CRUD rubric_templates (5 plantillas sembradas)
useAsync.js · useAutoSave.js · useForm.js · useFocusTrap.js · usePersistentState.js · useToggle.js
```

### Componentes clave
```javascript
// Editor:  GuideEditorPage · ConversationalGuideModal · EleotCoveragePanel · DayPanel
// Bloques: SmartBlocks.jsx · smartBlockHtml.js
// Export:  exportDocx.js · exportHtml.js · exportRubricHtml.js · AgendaGenerator.js
// NEWS:    NewsProjectEditor · NewsProjectCard · NewsTimeline · NewsWeekBadge
// System:  CheckpointModal · ProfileModal · ErrorBoundary · logger.js
//          FeedbackModal · CommentsPanel · CorrectionRequestModal · VersionHistoryModal
// AI:      AIAssistant.js · AIComponents.jsx (AISuggestButton · AIAnalyzerModal · AIGeneratorModal)
// ctx:     FeaturesContext (useFeatures) · ToastContext (useToast → createPortal)
// NOTA:    GoalCard / IndicatorList / PeriodProgress están inline en ObjectivesPage.jsx
```

### Estado clave — GuideEditorPage
```javascript
linkedAchievementGoal       // achievement_goal completo + indicators[]
linkedAchievementIndicator  // indicator vinculado (indicator_id)
relinkLoading / relinkOptions // booleano + null|indicator[] para re-vinculación inline
```

### Estado clave — PlannerPage
```javascript
activeAchievementGoal    // { id, text, period, indicators[] } — fetched async
plannerActiveNewsProject // NEWS activo — fuente primaria de indicator_id
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
cd "C:\BOSTON FLEX\ClassroomOS\cbf-planner"
npm run dev                                              # localhost:5173/cbf-planner/
git add . && git commit -m "feat: ..." && git push      # deploy automático ~2 min
.\supabase.exe functions deploy claude-proxy --no-verify-jwt
.\supabase.exe functions logs claude-proxy
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
*"Nosotros diseñamos. El docente enseña." · CLAUDE.md v5.2 — Abril 25, 2026*
