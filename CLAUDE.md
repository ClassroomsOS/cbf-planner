# CBF PLANNER — v4.6
## CLAUDE.md — Documento maestro

> **Principio rector:** *"Nosotros diseñamos. El docente enseña."*
> Léelo completo antes de escribir código. · Última actualización: Abril 9, 2026

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

## ✅ ESTADO ACTUAL — PRODUCCIÓN (Sesiones A–H completas)

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

SESIÓN F ✅  Grade+Section systemic fix: combined grade viaja en todo el sistema
             — ObjectivesPage, SyllabusPage, GuideEditorPage, useAchievements, useSyllabus
             — DB migrada: achievement_goals grade base → combined grade+section
             — Constraint UNIQUE dropped: N logros por teacher+subject+grade+period
             — SyllabusPage: semanas dinámicas (Math.max(8, maxUsed+3)), períodos libres
             — Duplicar para otra sección: Logros, NEWS y Guías (Option B buttons)
             — NewsProjectEditor: fix definitivo carga indicadores (ver sección GOTCHAS)
             — combinedGrade() helper en constants.js
             — CLAUDE.md v4.3

SESIÓN G ✅  Cascada pedagógica en guías: indicator_id fluye correctamente
             — PlannerPage: activeAchievementGoal (fetch goal+indicators por subject/grade/period)
             — PlannerPage: indicator_id faltaba en select de news_projects (fix crítico)
             — PlannerPage: callout muestra logro del nuevo sistema con chips de indicadores
             — PlannerPage: AIGeneratorModal recibe achievementGoal + activeIndicator del nuevo sistema
             — GuideEditorPage: linkedAchievementGoal — carga goal completo + todos sus indicadores
             — GuideEditorPage: repair en load() — busca NEWS project más próximo por fecha,
               hereda su indicator_id; fallback a achievement_goal del período
             — GuideEditorPage: botón 🔄 para re-vincular indicador (handleLoadRelinkOptions)
             — GuideEditorPage: "Principio del indicador" editable debajo del versículo
             — AIComponents/AIGeneratorModal: desbloqueado con activeIndicator || achievementGoal
             — AIAssistant.generateGuideStructure: bloque 🎯 LOGRO E INDICADORES DEL PERÍODO
             — CheckpointModal: reemplaza upsert(onConflict) por check-then-insert/update
             — CLAUDE.md v4.4

SESIÓN H ✅  Páginas admin/especializadas completadas:
             — SubjectManagerPage (/subjects) — gestor de materias (admin)
             — GuideLibraryPage (/library) — biblioteca de guías aprobadas
             — PeriodCoverageDashboard (/coverage) — cobertura eleot® acumulada
             — ObservationLoggerPage (/observations) — observaciones Cognia
             — ReviewRoomPage (/sala-revision) — sala de revisión de guías publicadas
             — CurriculumPage (/curriculum) — malla curricular (admin)
             — AgendaPage (/agenda) — agenda semanal (homeroom + co-teacher + admin)
             — PrinciplesPage (/principles) — principios rectores por mes

LIMPIEZA LEGACY ✅  Sistema learning_targets eliminado del frontend (Abril 8, 2026)
             — ELIMINADOS: LearningTargetsPage.jsx · LearningTargets.css · LearningTargetSelector.jsx
             — Ruta /targets eliminada del dashboard
             — Prop learningTarget removido de toda la cascada:
               DayPanel · AIComponents · AIAssistant · ConversationalGuideModal · CheckpointModal
             — isModeloB = MODELO_B_SUBJECTS.includes(subject) — sin dependencia de news_model legacy
             — NewsProjectEditor: target_id removido del form state; target_indicador se mantiene
               (es el gate del botón IA de rúbrica — sincronizado con indicator_id)
             — AIGeneratorModal gate: !activeIndicator && !achievementGoal (sin learningTarget)
             — DB: checkpoints.target_id NOT NULL constraint eliminada;
               orphaned rows (plan_id IS NULL) eliminados
             — learning_targets: ELIMINADA de DB (tabla + 3 columnas target_id)
             — news_legacy sigue en DB (datos históricos — no borrar)
             — CLAUDE.md v4.5

SESIÓN I (parcial) ✅  IA de sugerencias por sección enriquecida + export DOCX rediseñado
             — suggestSectionActivity: contexto del libro inyectado (textbook_reference: book,
               units[], grammar[], vocabulary[]) + título y skill del proyecto NEWS activo
             — Lengua automática: Modelo B → prompt y respuesta en inglés; resto en español
             — ACTIVITY_ARCHETYPES: 10-15 tipos por sección (MOTIVATION/ACTIVITY/SKILL
               DEVELOPMENT/CLOSING/ASSIGNMENT) — cada llamada selecciona uno vía variantSeed
               aleatorio; nunca genera el mismo tipo de actividad dos veces seguidas
             — "🔄 Regenerar" → "🔄 Otra sugerencia": llama la IA de nuevo (antes solo
               borraba el estado sin regenerar)
             — maxTokens 2000 → 2500 para respuestas más ricas
             — Cadena de props: GuideEditorPage → DayPanel → AISuggestButton → suggestSectionActivity
             — Export DOCX: secciones como banners completos (2 filas por sección)
               · Row 1: banner ancho completo, fondo color de sección, label 12pt negrita blanca
               · Row 2: contenido a todo el ancho (o split texto|imagen para side layout)
               · Elimina la columna lateral estrecha (1760 DXA, ilegible) del diseño anterior
               · Tabla 2 columnas [7200, 3600] — header y unit subheader con span=2
               · Imágenes "below" redimensionadas: 1→640px, 2→310px, 3-6→202px
               · Imágenes "side": columna 240px, 1-2→220px apiladas, 3+→106px en pares
             — CLAUDE.md v4.6

PRÓXIMO → SESIÓN I (continuación)
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
                        biblical_principle (texto principio) · indicator_verse_ref (ref bíblica)
                        biblical_reflection (reflexión estudiante)
rubric_templates      — 5 plantillas institucionales sembradas
achievement_goals     — UNIQUE(teacher_id, subject, grade, period, academic_year)
achievement_indicators— dimension + skill_area · teacher_id (denorm. para RLS)
syllabus_topics       — contenidos por semana · indicator_id FK
checkpoints           — indicator_id (nuevo) · target_id nullable (legacy) · plan_id
eleot_domains         — 7 dominios A–G (seed inmutable)
eleot_items           — 28 ítems A1–G3 (seed inmutable)
eleot_block_mapping   — block_type → item_id + weight (seed inmutable)
eleot_observations    — historial observaciones Cognia (teacher_id + school_id RLS)
school_monthly_principles — year_verse · month_verse · indicator_principle por mes
weekly_agendas        — grade · section · week_start · content JSONB · status
schedule_slots        — franjas del horario institucional por nivel
school_calendar       — días hábiles · is_school_day · affects_planning
news_legacy           — LEGACY (era tabla news — no borrar)
error_log · activity_log · ai_usage
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
| `suggestSectionActivity()` | AIAssistant.js | 2500 |
| `analyzeGuide()` | AIAssistant.js | 4000 |
| `generateGuideStructure()` | AIAssistant.js | 16000 |
| `suggestSmartBlock()` | AIAssistant.js | 1200 |
| `generateRubric()` | AIAssistant.js | 4000 |
| `generateIndicadores()` | AIAssistant.js | 1500–2000 |
| `importGuideFromDocx()` | AIAssistant.js | 8000 |
| `analyzeGuideCoverage()` ✅ Ses. E | AIAssistant.js | 1800 |
| `generateStudentRubric()` ✅ Ses. E | AIAssistant.js | 3000 |

**ConversationalGuideModal** (Ses. E) — wizard 5 pasos que llama `generateGuideStructure()` con contexto de dominios eleot® débiles + skill focus + block types preferidos + `achievementGoal` completo (Ses. G).

**Flujo de contexto IA para generación de guía (Ses. G):**
```
NEWS project más próximo → indicator_id → achievement_indicator → achievement_goal
  → generateGuideStructure recibe achievementGoal { text, period, indicators[] }
  → bloque 🎯 LOGRO E INDICADORES DEL PERÍODO en el prompt
  → IA genera contenido alineado a todos los indicadores del período
```

**`suggestSectionActivity` — enriquecida (Ses. I):**
- Recibe `newsProject` (desde GuideEditorPage → DayPanel → AISuggestButton)
- Bloque `📚 TEXTBOOK & PROJECT CONTEXT` con: book, units[], grammar[], vocabulary[], skill
- Lengua automática: `MODELO_B_SUBJECTS` → respuesta en inglés; demás materias → español
- `ACTIVITY_ARCHETYPES[lang][section.label]` — lista de 10-15 arquetipos por sección
- `variantSeed = Math.random() * 10000` en cada click → siempre un arquetipo distinto
- El prompt le dice a Claude exactamente QUÉ tipo de actividad generar: *"Design as: a hot seat roleplay"*
- Botón "🔄 Otra sugerencia" llama a la IA directamente (antes solo limpiaba el estado)

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
9. news_legacy: LEGACY — no borrar (datos históricos de proyectos)
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

### indicator_id no se guardaba al crear guías (resuelto Ses. G — Abril 2026)

**Síntoma:** Las guías creadas desde PlannerPage tenían `indicator_id = null` aunque existieran `achievement_goals` e `achievement_indicators` en DB. El editor no mostraba indicador vinculado.

**Causa raíz (triple):**

1. **`indicator_id` faltaba en el select de `news_projects`** en PlannerPage. El campo se leía como `undefined` → `null` al guardar la guía.

2. **Sin fallback a `achievement_goals`** cuando el NEWS project no tiene `indicator_id` (proyectos creados en el sistema antiguo). No había ninguna búsqueda directa en `achievement_goals` + `achievement_indicators`.

3. **Guías existentes sin vínculo** — el repair en `load()` solo corría si AMBOS `indicator_id` y `target_id` eran null, y buscaba NEWS projects solo con `indicator_id IS NOT NULL`, excluyendo los proyectos legacy.

**Fix:**
```js
// PlannerPage: indicator_id ya en el select
.select('id, title, skill, ..., indicator_id')   // ← campo faltante

// PlannerPage: activeAchievementGoal como fallback
indicator_id: plannerActiveNewsProject?.indicator_id
              || activeAchievementGoal?.indicators?.[0]?.id
              || null

// GuideEditorPage load(): repair busca por fecha, sin filtro indicator_id
const { data: newsProjects } = await supabase
  .from('news_projects').select('id, indicator_id, due_date, ...')
  // sin .not('indicator_id', 'is', null) — toma el más próximo y verifica después
```

**Regla derivada — LEY DE LA CASCADA:**
> El `indicator_id` de una guía viene del **NEWS project más próximo al futuro** tomando como base las fechas de la guía:
> 1. Proyecto con actividad evaluativa en la semana de la guía
> 2. Proyecto con `due_date` más cercano ≥ primer día de la guía
> 3. Fallback: primer indicador del `achievement_goal` del período
>
> **NUNCA** usar solo el filtro de período (`achievement_goals.period`) como fuente primaria. El período es solo el fallback.

### AIGeneratorModal bloqueado con sistema nuevo (resuelto Ses. G — Abril 2026)

**Síntoma:** Al presionar "Generar con IA" en PlannerPage o en el editor, el formulario no aparecía — solo el mensaje "⚠️ No hay un Indicador de Logro vinculado". El botón Generar tampoco se renderizaba.

**Causa:** Todo el formulario del modal estaba dentro de `{learningTarget && <>...</>}`. Si el docente usa solo el nuevo sistema (`achievement_goals`/`achievement_indicators`) sin legacy `learning_targets`, `learningTarget = null` → formulario invisible.

**Fix (estado actual tras Limpieza Legacy):**
```jsx
// Sistema unificado — solo dos fuentes válidas:
{!activeIndicator && !achievementGoal ? <blocking> : <info>}
{(activeIndicator || achievementGoal) && <> ...formulario + botón Generar... </>}
```

**Regla derivada:** El gate de UI para IA acepta dos fuentes: `activeIndicator` (indicador específico del nuevo sistema) o `achievementGoal` (logro completo del período). `learningTarget` fue eliminado en la Limpieza Legacy. Nunca agregar un tercer gate que dependa de una tabla legacy.

### CheckpointModal: error al guardar con nuevo sistema (resuelto Ses. G — Abril 2026)

**Síntoma:** "Error al guardar el checkpoint" al intentar registrar el avance al final de una semana.

**Causa:** El `upsert` usaba `onConflict: 'plan_id'` que requiere `UNIQUE(plan_id)` en la tabla `checkpoints`. La migración `20260407_checkpoints_plan_unique.sql` existe en el repo pero **nunca fue aplicada en producción**.

**Fix:** Reemplazado por check-then-insert/update sin dependencia de constraints:
```js
// Busca existente por plan_id, luego por target_id+teacher_id+week_number (legacy)
// → update si existe, insert si no
```

**Regla derivada:** No confiar en `upsert(onConflict: 'columna')` a menos que la constraint UNIQUE esté confirmada en prod. Para operaciones críticas (checkpoints, logs), usar check-then-write.

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
// ── FLUJO PEDAGÓGICO (todos los roles) ──
/principles       PrinciplesPage           Versículo del Año + Versículo del Mes (solo estos dos)
/objectives       ObjectivesPage           CRUD achievement_goals + indicators
/syllabus         SyllabusPage             CRUD syllabus_topics por semana
/news             NewsPage                 Listado + wizard 8 pasos NewsProjectEditor
/                 PlannerPage              Crear guía (punto de entrada del flujo)
/plans            MyPlansPage              Mis guías
/editor/:id       GuideEditorPage          Editor completo
/library          GuideLibraryPage         Biblioteca de guías aprobadas
/ai-usage         AIUsagePage              Monitor de tokens IA
/messages         MessagesPage             Mensajería 1-a-1
/coverage         PeriodCoverageDashboard  Cobertura eleot® acumulada (admin)
/observations     ObservationLoggerPage    Observaciones Cognia (admin)

// ── ROLES ESPECIALES ──
/agenda           AgendaPage               Homeroom + co-teacher + admin
/director         DirectorPage             Rector (guías · NEWS · agendas · feedback)
/schedule         SchedulePage             Admin + rector + psicopedagoga
/calendar         CalendarPage             Admin + psicopedagoga

// ── SOLO ADMIN ──
/teachers         AdminTeachersPage        CRUD docentes + asignaciones
/notifications    NotificationsPage        Centro de notificaciones
/curriculum       CurriculumPage           Malla curricular
/sala-revision    ReviewRoomPage           Revisión de guías publicadas
/subjects         SubjectManagerPage       Gestión de materias
/settings         SettingsPage             Feature flags + horario institucional

// ── SOLO SUPERADMIN ──
/superadmin       SuperAdminPage           Identidad institucional + seguridad
```

### Hooks — src/hooks/
```javascript
useAchievements.js    // CRUD achievement_goals + indicators + getPeriodProgress()
useSyllabus.js        // CRUD syllabus_topics · byWeek Map · getTopicsForWeek(week)
useActiveNews.js      // NEWS activo desde news_projects · buildNewsPromptContext()
useEleot.js           // computeCoverage, domainStatus, suggestions
useNewsProjects.js    // CRUD news_projects
useRubricTemplates.js // CRUD rubric_templates (5 plantillas sembradas)
useAsync.js           // Wrapper async con loading/error state
useAutoSave.js        // Auto-save con debounce
useForm.js            // Form state helper
useFocusTrap.js       // Trap foco en modales (a11y)
usePersistentState.js // Estado persistente en localStorage
useToggle.js          // Toggle boolean
```

### Componentes clave
```javascript
// Editor:  GuideEditorPage · ConversationalGuideModal · EleotCoveragePanel
//          DayPanel (editor/DayPanel.jsx) — secciones accordion por día
// Bloques: SmartBlocks.jsx (modal 3 pasos + BlockForm) · smartBlockHtml.js (preview + export)
// Export:  exportDocx.js · exportHtml.js · exportRubricHtml.js · AgendaGenerator.js
// NEWS:    news/NewsProjectEditor (wizard 8 pasos) · NewsProjectCard · NewsTimeline · NewsWeekBadge
// System:  CheckpointModal · ProfileModal · ErrorBoundary · logger.js
//          FeedbackModal · CommentsPanel · CorrectionRequestModal · VersionHistoryModal
// AI:      AIAssistant.js · AIComponents.jsx (AISuggestButton · AIAnalyzerModal · AIGeneratorModal)
// ctx:     FeaturesContext (useFeatures) · ToastContext (useToast → createPortal)

// NOTA: GoalCard / IndicatorList / PeriodProgress están inline en ObjectivesPage.jsx
```

### Estado clave en GuideEditorPage
```javascript
linkedAchievementGoal    // achievement_goal completo + indicators[] — fuente del panel Indicador
linkedAchievementIndicator // indicator vinculado (indicator_id)
relinkLoading            // booleano para el botón 🔄
relinkOptions            // null | indicator[] — dropdown de re-vinculación inline
```

### Estado clave en PlannerPage
```javascript
activeAchievementGoal    // { id, text, period, indicators[] } — goal activo para subject/grade/period
                         // fetched async; se muestra en callout y se pasa a AIGeneratorModal
plannerActiveNewsProject // NEWS project activo — fuente primaria de indicator_id
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
✅ SESIÓN G — Cascada indicator_id funcional en guías · repair automático al abrir · botón 🔄 re-vincular · AIGeneratorModal desbloqueado con nuevo sistema · achievementGoal en prompt IA · Principio del indicador · CheckpointModal check-then-write
✅ SESIÓN H — SubjectManagerPage · GuideLibraryPage · PeriodCoverageDashboard · ObservationLoggerPage · ReviewRoomPage · CurriculumPage · AgendaPage · PrinciplesPage
✅ LIMPIEZA LEGACY — Sistema learning_targets eliminado del frontend · LearningTargetsPage/LearningTargetSelector/learningTarget prop eliminados · isModeloB derivado de MODELO_B_SUBJECTS · checkpoints.target_id NOT NULL eliminado
✅ SESIÓN I (parcial) — suggestSectionActivity enriquecida (contexto libro, lengua, arquetipos, variantSeed) · botón "Otra sugerencia" regenera de verdad · DOCX secciones como banners completos

🔜 SESIÓN I — Pendientes de profundización
  26. SubjectManagerPage — completar funcionalidad CRUD real de materias
  27. GuideLibraryPage — implementar búsqueda, filtros y aprobación de guías
  28. ReviewRoomPage — interfaz de corrección con justificación + notificación al docente
  29. PeriodCoverageDashboard — datos reales desde eleot_observations + lesson_plans
  30. ObservationLoggerPage — CRUD real de eleot_observations (hoy es scaffold)
  31. CurriculumPage — malla curricular completa con indicadores por grado/período
  32. Pipeline de imágenes del libro → IA: subir fotos textbook en NEWS → Storage →
      URLs firmadas → generateGuideStructure() como bloque "📖 PÁGINAS DEL LIBRO"
      (Claude multimodal las lee y genera actividades alineadas al contenido real)
      Arquitectura: guide-images/textbook/{school_id}/{news_id}/page_n.webp
      compressImage() ya existe · ImageUploader ya existe · claude-proxy ya es passthrough

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
*"Nosotros diseñamos. El docente enseña." · CLAUDE.md v4.6 — Abril 9, 2026*
