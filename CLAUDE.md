# CBF PLANNER — v5.9
## CLAUDE.md — Documento maestro

> **Principio rector:** *"Nosotros diseñamos. El docente enseña."*
> Léelo completo antes de escribir código. · Última actualización: Abril 26, 2026

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

## 🔜 PRÓXIMA SESIÓN

- **Google OAuth** — configurar en Supabase Dashboard → Auth → Providers + validar dominio `@redboston.edu.co` post-OAuth en `App.jsx:onAuthStateChange`
- **Email al representante** — corrección IA termina → nota final + feedback a `representative_email`
- **DB horizonte** (no urgente): DROP tablas DEPRECATED · normalizar `grade`/`section` a `school_grades` · validación JSONB con triggers

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

### 6. ExamPlayerV2 — `section_name` en `exam_instances.generated_questions`
Si `section_name === ''` → preguntas sin tabs. Si hay valores distintos → tabs automáticos. **NUNCA hardcodear `section_name: ''`** — usar `q.section_name || ''`.

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
syllabus_topics       — contenidos por semana · indicator_id FK
checkpoints           — indicator_id · target_id nullable (legacy) · plan_id
eleot_domains/items/block_mapping — seed inmutable (7 dominios · 28 ítems)
eleot_observations    — historial observaciones Cognia
school_monthly_principles — year_verse · month_verse · indicator_principle por mes
weekly_agendas        — grade · section · week_start · content JSONB · status
schedule_slots        — franjas horario institucional por nivel
school_calendar       — is_school_day · affects_planning
news_legacy           — LEGACY — no borrar
error_log · activity_log · ai_usage · cbf_error_log · health_snapshots

— DEPRECATED (no crear registros nuevos) —
assessments · questions · assessment_versions · student_exam_sessions · student_submissions

— ROSTER —
school_students       — email UNIQUE(school_id,email) · grade(base) · section · student_code(auto)
                        first_name · second_name · first_lastname · second_lastname · representative_email

— EXAM PLAYER —
exam_blueprints       — config pedagógica inmutable post-publicación
exam_sessions         — access_code · status · teacher_id
exam_instances        — generated_questions JSONB (section_name por pregunta)
                        student_email · student_id FK · student_section · version_label
                        instance_status · integrity_flags · tab_switches · started_at
exam_responses        — auto_score · ai_score · ai_feedback · ai_confidence
                        requires_human_review · ai_correction_status(not_needed|pending|done)
exam_results          — instance_id UNIQUE · colombian_grade · total_score · max_score
                        correction_status(pending|partial|complete)
exam_preflight_log · exam_offline_queue · exam_ai_queue

— MÓDULO PSICOSOCIAL —
student_psychosocial_profiles — status · support_level · flags TEXT[]
                                teacher_notes(visible todos) · confidential_notes(solo psico/rector/admin)
student_observations          — obs_date · obs_type · description · action_taken · next_steps
student_accommodation_plans   — accommodations JSONB · status(draft|active|archived)
```

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

**Reglas de comportamiento no documentadas en ai-integration.md:**
- `generateGuideStructure` acepta `piarData?: { [category]: string[] }` — acomodaciones sin nombres de estudiantes. `GuideEditorPage` las consulta y pasa al modal; `ConversationalGuideModal` muestra aviso naranja en paso 3.
- `generateExamQuestions` acepta `sections: [{id, name, types}]` — una llamada IA por sección; preguntas etiquetadas con `section_name` client-side. `sections` toma precedencia sobre `questionTypes` plano (legacy).
- `AIGeneratorModal` gate: `(!activeIndicator && !achievementGoal)` — sin legacies. Ver Gotcha #4.
- `exam-response-corrector` Edge Fn: confianza < 0.65 → `requires_human_review=true`. Fallback Claude falla → `score=0, requires_review=true` (no bloquea al estudiante).

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
/principles    PrinciplesPage           /objectives    ObjectivesPage
/syllabus      SyllabusPage             /news          NewsPage
/messages      MessagesPage             /ai-usage      AIUsagePage
/students      StudentsPage             /exams         ExamDashboardPage
/exams/review  ExamReviewPage           /psicosocial   PsicosocialPage
/coverage      PeriodCoverageDashboard  /observations  ObservationLoggerPage

// ROLES ESPECIALES
/agenda        AgendaPage    /director  DirectorPage
/schedule      SchedulePage  /calendar  CalendarPage

// SOLO ADMIN
/teachers      AdminTeachersPage   /notifications  NotificationsPage
/curriculum    CurriculumPage      /sala-revision  ReviewRoomPage
/subjects      SubjectManagerPage  /settings       SettingsPage

// SOLO SUPERADMIN → /superadmin    SuperAdminPage
// PÚBLICO (sin auth) → /eval       ExamPlayerV2Page
```

### Estado clave — ExamPlayerV2Page
```javascript
localStorage['cbf_exam_entry'] = { code, email, name, section } // persiste para iOS
violationAlert  // { title, message, isFullscreen } | null — banner rojo bloqueante
sections        // [{ name, indices[] }] — de q.section_name; hasMultipleSections
// Telegram: código last-6 de instance_id, nunca PII
sendTelegramNotification(eventType, extra) // sin throttle, para ciclo
```

### Estado clave — GuideEditorPage / PlannerPage
```javascript
linkedAchievementGoal       // achievement_goal completo + indicators[]
linkedAchievementIndicator  // indicator vinculado (indicator_id)
relinkLoading / relinkOptions
activeAchievementGoal       // PlannerPage — fetched async
plannerActiveNewsProject    // PlannerPage — fuente primaria de indicator_id
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
*"Nosotros diseñamos. El docente enseña." · CLAUDE.md v5.9 — Abril 26, 2026*
