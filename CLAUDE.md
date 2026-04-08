# CBF PLANNER — v4.3
## CLAUDE.md — Documento maestro

> **Principio rector:** *"Nosotros diseñamos. El docente enseña."*
> Léelo completo antes de escribir código. · Última actualización: Abril 8, 2026

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

- **SYLLABUS TOPICS** — contenidos por semana, materia, grado
- **ACHIEVEMENT GOAL** — logro de período; verbo Bloom + contenido + condición
- **ACHIEVEMENT INDICATORS** — dimension (cognitivo/procedimental/actitudinal) + skill_area
  - skill_area: `speaking|listening|reading|writing|general|null`
  - Si skill_area tiene valor → NEWS hereda rubric_template automáticamente
- **NEWS PROJECT** — indicator_id FK · rubric pre-seleccionada por skill_area
- **LESSON PLAN** — indicator_id · syllabus_topic_id · smart_blocks (duration_minutes + eleot_items) · session_agenda auto-generada
- **CHECKPOINT** — ¿Mayoría/algunos/pocos alcanzaron el indicador?
- **EVALUACIÓN** — rúbrica → nota 1.0–5.0 · indicador marcado "evaluado"

---

## ✅ ESTADO ACTUAL — PRODUCCIÓN (Sesiones A–E completas)

```
BASE ✅  Auth · perfiles · dashboard · sidebar pedagógico
        GuideEditor: 6 secciones + auto-save + Tiptap + layouts + typography
        Export DOCX/HTML/PDF: base64, logo, videos, CSS scoped
        Export Virtual Campus: buildDayHtml por jornada
        IA: generar / analizar / sugerir (claude-proxy → claude-sonnet-4-20250514)
        NEWS: news_projects + rubric_templates + NewsProjectEditor (wizard 8 pasos)
        Comunicación: mensajes + notificaciones (Realtime)
        Admin: AdminTeachersPage + SettingsPage + SuperAdminPage + DirectorPage
        Roles: teacher/co-teacher/psicopedagoga/rector/admin/superadmin
        Checkpoints: tabla + CheckpointModal + flujo semana N→N+1

SESIÓN A ✅  achievement_goals + achievement_indicators (skill_area)
             syllabus_topics · news_projects.indicator_id
             lesson_plans.(indicator_id, syllabus_topic_id, eleot_coverage, session_agenda)
             checkpoints.indicator_id · learning_targets migrados
             useAchievements.js · useSyllabus.js · useActiveNews.js
             ObjectivesPage.jsx (/objectives) · SyllabusPage.jsx (/syllabus)

SESIÓN B ✅  NewsProjectEditor: indicator_id + filtro rubric por skill_area
             GuideEditorPage: pre-fill indicator + syllabus_topic
             CheckpointModal: indicator_id + target_id legacy dual-write

SESIÓN C ✅  eleot_domains (7) + eleot_items (28) + eleot_block_mapping + eleot_observations
             useEleot.js — computeCoverage, domainStatus, suggestions
             EleotCoveragePanel.jsx — semáforo tiempo real en sidebar del editor

SESIÓN D ✅  16 Smart Blocks totales (9 existentes + 7 nuevos)
             duration_minutes en todos los bloques · step 3 del modal
             guessSmartBlock() extendido para auto-detectar los 16 tipos
             DOCX: buildSmartBlockDocx para todos los 16 tipos

SESIÓN E ✅  AgendaGenerator.js — buildSessionAgenda + auto-save session_agenda
             ConversationalGuideModal.jsx — wizard 5 pasos (reemplaza AIGeneratorModal)
             AIAssistant.js: analyzeGuideCoverage() + generateStudentRubric()
             exportDocx.js: DOCX nativo para los 7 nuevos block types

SESIÓN F ✅   Grade+Section systemic fix: combined grade viaja en todo el sistema
             — ObjectivesPage, SyllabusPage, GuideEditorPage, useAchievements, useSyllabus
             — DB migrada: achievement_goals grade base → combined grade+section
             — Constraint UNIQUE dropped: N logros por teacher+subject+grade+period
             — SyllabusPage: semanas dinámicas (Math.max(8, maxUsed+3)), períodos libres
             — Duplicar para otra sección: Logros, NEWS y Guías (Option B buttons)
             — NewsProjectEditor: fix definitivo carga indicadores (ver sección GOTCHAS)
             — combinedGrade() helper en constants.js
             — CLAUDE.md v4.3

PRÓXIMO → SESIÓN G
```

---

## 🗄️ BASE DE DATOS — TABLAS EN PRODUCCIÓN

```
teachers              — RLS via get_my_school_id() SECURITY DEFINER
schools               — features JSONB · year_verse · logo_url · dane · resolution
teacher_assignments   — asignaciones materia/grado/sección/horario JSONB
lesson_plans          — content JSONB · indicator_id · syllabus_topic_id
                        eleot_coverage {} · session_agenda [] · week_count
news_projects         — indicator_id FK → achievement_indicators · actividades_evaluativas
rubric_templates      — 5 plantillas institucionales sembradas
achievement_goals     — UNIQUE(teacher_id, subject, grade, period, academic_year)
achievement_indicators— dimension + skill_area · teacher_id (denorm. para RLS)
syllabus_topics       — contenidos por semana · indicator_id FK
checkpoints           — target_id (legacy) + indicator_id (nuevo) · plan_id UNIQUE
eleot_domains         — 7 dominios A–G (seed inmutable)
eleot_items           — 28 ítems A1–G3 (seed inmutable)
eleot_block_mapping   — block_type → item_id + weight (seed inmutable)
eleot_observations    — historial observaciones Cognia (teacher_id + school_id RLS)
school_monthly_principles — year_verse · month_verse · indicator_principle por mes
learning_targets      — LEGACY (migrado — no borrar aún)
news_legacy           — LEGACY (era tabla news — no borrar)
error_log · activity_log · ai_usage · schedule_slots · school_calendar
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

**Estructura JSON de un bloque:**
```json
{ "id": 1234, "type": "WORKSHOP", "model": "stations",
  "duration_minutes": 20, "data": { "stations": [...] } }
```

**Archivos:** `src/utils/smartBlockHtml.js` (BLOCK_TYPES + preview/interactive HTML) · `src/components/SmartBlocks.jsx` (modal 3 pasos + BlockForm)

---

## 🤖 IA — Edge Function `claude-proxy`

**Passthrough puro** — construye el prompt en `AIAssistant.js`, envía a `claude-sonnet-4-20250514`.
**Modelo:** `claude-sonnet-4-20250514` — no cambiar sin avisar.

| Función | Archivo | Tokens |
|---|---|---|
| `suggestSectionActivity()` | AIAssistant.js | 2000 |
| `analyzeGuide()` | AIAssistant.js | 4000 |
| `generateGuideStructure()` | AIAssistant.js | 16000 |
| `suggestSmartBlock()` | AIAssistant.js | 1200 |
| `generateRubric()` | AIAssistant.js | 4000 |
| `generateIndicadores()` | AIAssistant.js | 1500–2000 |
| `importGuideFromDocx()` | AIAssistant.js | 8000 |
| `analyzeGuideCoverage()` ✅ Ses. E | AIAssistant.js | 1800 |
| `generateStudentRubric()` ✅ Ses. E | AIAssistant.js | 3000 |

**ConversationalGuideModal** (Ses. E) — wizard 5 pasos que llama `generateGuideStructure()` con contexto de dominios eleot® débiles + skill focus + block types preferidos.

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
9. learning_targets y news_legacy: LEGACY — no borrar hasta confirmar todo migrado
10. NUNCA usar window.alert — usar showToast() del ToastContext
11. Grade SIEMPRE combined: ver sección "GRADE+SECTION — CONVENCIÓN" abajo
```

---

## 📐 GRADE+SECTION — CONVENCIÓN (LEY DEL SISTEMA)

`teacher_assignments` almacena `grade="8.°"` + `section="Blue"` por separado.
**En todas las demás tablas el grade es SIEMPRE combinado: `"8.° Blue"`.**

```
COMBINED grade  →  achievement_goals.grade
                   achievement_indicators.grade (denorm.)
                   syllabus_topics.grade
                   lesson_plans.grade
                   checkpoints.grade

SEPARADOS       →  teacher_assignments: grade + section
                   news_projects: grade (base) + section  ← excepción histórica
```

**Reglas de código:**
- Dropdowns de grado: SIEMPRE `<select>` con opciones `assignments.map(a => a.section ? \`${a.grade} ${a.section}\` : a.grade)` — **NUNCA** `<input>` libre
- Queries a achievement_goals / syllabus_topics: `.eq('grade', combinedGrade)` — NUNCA `.ilike` ni `.split(' ')[0]`
- NewsProjectEditor es la única excepción: construye `gradeFull` desde `form.grade + form.section` para buscar en achievement_goals, porque news_projects guarda los dos campos separados

**NUNCA hacer:**
```js
// ❌ stripea la sección
grade.replace(/\s+[A-Z]$/, '').trim()
plan.grade.split(' ')[0]
q.ilike('grade', gradeBase + '%')
```

---

## 🐛 GOTCHAS — BUGS RESUELTOS (referencia para no repetirlos)

### NewsProjectEditor: indicadores de logro no cargan (resuelto Ses. F — Abril 2026)

**Síntoma:** El paso "Indicador" del wizard NEWS aparece vacío aunque existan `achievement_goals` e `achievement_indicators` en la DB.

**Causa raíz (triple):**

1. **`form.section` faltaba en deps del `useEffect`** que carga `achievement_indicators`.
   El efecto tenía `[form.subject, form.grade, form.period]`. Si el usuario abre proyecto A (8.° Blue) y luego proyecto B (8.° Red) con el mismo subject+grade+period, el efecto **no se re-ejecutaba** porque ninguna dep cambió, aunque la sección sí cambió. El `gradeFull` construido en el closure seguía siendo "8.° Blue".

2. **Sin `key` prop en `<NewsProjectEditor>`** dentro de `NewsPage.jsx`.
   Sin `key={editingProject?.id}`, React reutiliza la misma instancia del componente al cambiar de proyecto. Todo el estado (`form`, `achievementIndicators`, etc.) queda del proyecto anterior. Con la `key`, React desmonta y remonta desde cero garantizando estado limpio.

3. **Query sin filtro `school_id` explícito** (solo dependía de RLS).
   En producción el RLS funciona, pero el filtro explícito es más robusto y facilita el diagnóstico.

**Fix aplicado (`a6eb3aa`):**
```jsx
// NewsPage.jsx — fuerza remount al cambiar proyecto
<NewsProjectEditor
  key={editingProject?.id || 'new'}   // ← CRÍTICO
  project={editingProject}
  ...
/>
```
```js
// NewsProjectEditor.jsx — deps completas + filtro explícito
useEffect(() => {
  // ...
  const { data, error } = await supabase
    .from('achievement_goals')
    .select('id, text')
    .eq('school_id', teacher.school_id)   // ← explícito
    .eq('subject', form.subject)
    .eq('grade', g)
    .eq('period', form.period)
  // ...
}, [form.subject, form.grade, form.section, form.period, teacher.school_id])
//                             ^^^^^^^^^^^                ^^^^^^^^^^^^^^^^
//                             dep faltante               dep faltante
```

**Regla general derivada:** Cualquier modal/editor que recibe una entidad por prop y carga datos secundarios basados en esa entidad **DEBE tener `key={entity.id}`** para garantizar remount limpio. Sin `key`, el ciclo de vida de React reutiliza la instancia y los `useEffect` solo disparan si sus deps cambian — lo que puede no ocurrir si el nuevo item tiene los mismos valores en esas deps.

### NewsProjectEditor: indicadores agrupados por logro + botón IA deshabilitado (resuelto Ses. F — Abril 2026)

**Síntoma 1:** El paso "Indicador" mostraba lista plana sin agrupar por logro; si había varios logros para el mismo subject+grade+period solo se veía el texto del primer logro como contexto.

**Fix:** Los indicadores ahora se agrupan por `goal_id` con cabecera por logro ("Logro 1:", "Logro 2:"…). El render agrupado se usa tanto en modo selector como en modo read-only (cuando ya hay `indicator_id` vinculado). Se agregó botón **"Desvincular"** para poder cambiar el indicador.

**Síntoma 2:** El botón "✨ Generar con IA" permanecía deshabilitado aunque el docente hubiera seleccionado un indicador.

**Causa:** El botón verifica `form.target_indicador` (campo texto legacy). Al seleccionar un indicador del nuevo sistema (`achievement_indicators`) solo se actualizaba `form.indicator_id` — `target_indicador` quedaba vacío.

**Fix (`763d20e`):**
```js
// Click en indicador → batch-actualiza ambos campos
() => {
  updateForm('indicator_id', ind.id)
  updateForm('target_indicador', ind.text || '')   // ← habilita el botón IA
}

// useEffect de sincronización — cubre proyectos existentes con indicator_id pero target_indicador vacío
useEffect(() => {
  if (!form.indicator_id || achievementIndicators.length === 0) return
  const ind = achievementIndicators.find(i => i.id === form.indicator_id)
  if (!ind) return
  if (!form.target_indicador && ind.text) updateForm('target_indicador', ind.text)
  // también auto-carga la plantilla de rúbrica por skill_area si rubric está vacío
}, [form.indicator_id, achievementIndicators])
```

**Regla derivada:** Cuando coexisten un sistema nuevo (`indicator_id` FK) y un campo legacy de texto (`target_indicador`), siempre sincronizarlos juntos. El botón de IA y la generación de rúbrica dependen de `target_indicador`; no asumir que `indicator_id` es suficiente.

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

**Seguridad pendiente:** Google OAuth con validación dominio · "Olvidé mi contraseña" · email automático al crear docente.

---

## 🔗 CÓDIGO — ESTADO ACTUAL

### DashboardPage.jsx — rutas activas
```javascript
import PlannerPage         from './PlannerPage'        // /
import MyPlansPage         from './MyPlansPage'         // /plans
import GuideEditorPage     from './GuideEditorPage'     // /editor/:id
import NewsPage            from './NewsPage'             // /news
import LearningTargetsPage from './LearningTargetsPage' // /targets (legacy — mantener)
import ObjectivesPage      from './ObjectivesPage'      // /objectives ✅
import SyllabusPage        from './SyllabusPage'        // /syllabus  ✅
import AIUsagePage         from './AIUsagePage'         // /ai-usage
import MessagesPage        from './MessagesPage'        // /messages
// Admin: CalendarPage · NotificationsPage · AdminTeachersPage · SettingsPage · SuperAdminPage
// Pendiente Ses. F: SubjectManagerPage (/subjects) · GuideLibraryPage (/library)
```

### Hooks — src/hooks/
```javascript
useAchievements.js    // CRUD achievement_goals + indicators + getPeriodProgress()
useSyllabus.js        // CRUD syllabus_topics · byWeek Map · getTopicsForWeek(week)
useActiveNews.js      // NEWS activo desde news_projects · buildNewsPromptContext()
useEleot.js           // computeCoverage, domainStatus, suggestions — eleot® ✅ Ses. C
useNewsProjects.js    // CRUD news_projects
useRubricTemplates.js // CRUD rubric_templates (5 plantillas sembradas)
```

### Componentes clave
```javascript
// Editor:  GuideEditorPage · ConversationalGuideModal (✅ Ses. E) · EleotCoveragePanel (✅ Ses. C)
// Bloques: SmartBlocks.jsx (modal + BlockForm) · smartBlockHtml.js (preview + export HTML)
// Export:  exportDocx.js · exportHtml.js · exportRubricHtml.js · AgendaGenerator.js (✅ Ses. E)
// NEWS:    NewsProjectEditor (wizard 8 pasos) · NewsProjectCard · NewsTimeline
// System:  CheckpointModal · ProfileModal · ErrorBoundary · logger.js
// AI:      AIAssistant.js · AIComponents.jsx (AISuggestButton · AIAnalyzerModal)
// ctx:     FeaturesContext · ToastContext

// NOTA: GoalCard / IndicatorList / PeriodProgress están inline en ObjectivesPage.jsx
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

## 🗺️ ROADMAP — ESTADO

```
✅ SESIÓN A — Cascada pedagógica en DB (achievement_goals/indicators, syllabus, news FK)
✅ SESIÓN B — Conexión indicator_id en NewsProjectEditor + GuideEditor + CheckpointModal
✅ SESIÓN C — eleot® Engine (tablas + seed + useEleot + EleotCoveragePanel)
✅ SESIÓN D — 16 Smart Blocks + duration_minutes + DOCX para nuevos tipos
✅ SESIÓN E — AgendaGenerator + ConversationalGuideModal + analyzeGuideCoverage + studentRubric
✅ SESIÓN F — Grade+Section fix sistémico · N logros por período · Duplicar para sección · SyllabusPage dinámico · NewsProjectEditor fix definitivo de indicadores

🔜 SESIÓN G — Pendientes
  22. SubjectManagerPage — gestor de materias (admin) → /subjects
  23. GuideLibraryPage — biblioteca de guías aprobadas → /library
  24. PeriodCoverageDashboard — cobertura eleot® acumulada por período
  25. ObservationLogger — registrar observaciones Cognia reales (eleot_observations)

⏳ FASE 2 — Login/Auth completo
  Google OAuth + validación dominio post-OAuth en App.jsx:onAuthStateChange
  "Olvidé mi contraseña" → resetPasswordForEmail() → SetPasswordPage (ya existe)
  Email automático al crear docente desde admin-create-teacher Edge Fn

⏳ FASE 3 — Refactoring (deuda técnica — no agravar)
  GuideEditorPage.jsx (~1500+ lns) · NewsProjectEditor.jsx · SmartBlocks.jsx
  CSS modular · TeacherContext (props drilling) · TypeScript gradual
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
*"Nosotros diseñamos. El docente enseña." · CLAUDE.md v4.5 — Abril 8, 2026*
