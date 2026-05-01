# CBF Planner — Changelog de Sesiones

> **Propósito:** Registro cronológico de qué se hizo, por qué, y decisiones clave.
> CLAUDE.md contiene las reglas. Este documento contiene la historia.
> Agregar una entrada al final de cada sesión de trabajo.

---

## Formato de entrada

```
## [YYYY-MM-DD] Sesión / Sprint — Título corto

**Archivos clave modificados:** lista

**Qué se hizo:**
- bullet por feature/fix

**Decisiones no obvias:**
- Por qué se eligió X sobre Y

**Bugs resueltos:**
- Síntoma → causa raíz → fix
```

---

## [2026-03 / Sesiones A–C] Cascada pedagógica + ELEOT

**Archivos clave:** `useAchievements.js` · `useSyllabus.js` · `useActiveNews.js` · `ObjectivesPage.jsx` · `SyllabusPage.jsx` · `EleotCoveragePanel.jsx`

**Qué se hizo:**
- Crear `achievement_goals` + `achievement_indicators` con `skill_area` (speaking/listening/reading/writing/general)
- Crear `syllabus_topics` — contenidos por semana/materia/grado
- `news_projects.indicator_id` FK — conecta proyecto al indicador
- `lesson_plans` agrega `indicator_id` · `syllabus_topic_id` · `eleot_coverage` · `session_agenda`
- Migrar `learning_targets` → nuevo sistema de logros
- `eleot_domains` (7) + `eleot_items` (28) + `eleot_block_mapping` + `eleot_observations`
- `EleotCoveragePanel` — semáforo en tiempo real en sidebar del editor

**Decisiones no obvias:**
- `skill_area` en `achievement_indicators` pre-selecciona rubric_template automáticamente en NEWS — evita que el docente elija la rúbrica manualmente
- ELEOT seed es inmutable — los 7 dominios y 28 ítems nunca cambian, son el estándar Cognia

---

## [2026-03 / Sesión D] SmartBlocks — 16 tipos totales

**Archivos clave:** `SmartBlocks.jsx` · `exportDocx.js` · `GuideEditorPage.jsx`

**Qué se hizo:**
- Agregar 7 tipos nuevos a los 9 existentes → 16 total: DICTATION, QUIZ, VOCAB, WORKSHOP, SPEAKING, NOTICE, READING, GRAMMAR, EXIT_TICKET
- `duration_minutes` en todos los bloques (step 3 del modal)
- `guessSmartBlock()` extendido para detectar los 16 tipos desde actividades NEWS
- `buildSmartBlockDocx()` para los 16 tipos en exportación Word

**Decisiones no obvias:**
- SmartBlocks se inyectan automáticamente al abrir una guía por primera vez si hay actividades NEWS con fecha en esa semana — reduce trabajo del docente
- DOCX usa tabla single-column `[PW]` — NUNCA 2-column con columnSpan en todas las filas (causaba rows invisibles en Word)

---

## [2026-03 / Sesión E] ConversationalGuideModal + AgendaGenerator

**Archivos clave:** `ConversationalGuideModal.jsx` · `AIAssistant.js` · `exportDocx.js`

**Qué se hizo:**
- `ConversationalGuideModal` reemplaza `AIGeneratorModal` — wizard 5 pasos
- `AgendaGenerator.js` — `buildSessionAgenda()` + auto-save `session_agenda`
- `analyzeGuideCoverage()` + `generateStudentRubric()` en AIAssistant
- DOCX: soporte nativo para los 7 nuevos block types

---

## [2026-04-05 / Sesión F] Grade+Section fix sistémico

**Archivos clave:** `ObjectivesPage.jsx` · `SyllabusPage.jsx` · `GuideEditorPage.jsx` · `useAchievements.js` · `useSyllabus.js` · `constants.js`

**Qué se hizo:**
- Fix sistémico: `grade` combined `"8.° Blue"` viaja en todo el sistema
- DB migrada: `achievement_goals.grade` base → combined
- Constraint UNIQUE dropped: N logros por teacher+subject+grade+period (antes solo 1)
- SyllabusPage: semanas dinámicas (`Math.max(8, maxUsed+3)`), períodos libres
- "Duplicar para otra sección" en Logros, NEWS y Guías
- `combinedGrade()` helper en constants.js
- Roles expandidos: Rector = Coordinador en capacidades; `canManage()` cubre admin+superadmin+rector
- RLS `teacher_assignments`: policies reescritas para los 3 roles de gestión

**Decisiones no obvias:**
- NUNCA `grade.split(' ')[0]` ni `.ilike('grade', gradeBase + '%')` — hay CHECK constraints activos en DB que validan el formato `LIKE '%.° %'`
- El fix de roles fue necesario porque la policy original solo cubría `role = 'admin'`

**Bugs resueltos:**
- NewsProjectEditor no cargaba indicadores → `key={editingProject?.id || 'new'}` es crítico — sin él React reutiliza la instancia y los useEffect no disparan

---

## [2026-04-07 / Sesión G] Cascada pedagógica en guías

**Archivos clave:** `PlannerPage.jsx` · `GuideEditorPage.jsx` · `AIComponents.jsx` · `CheckpointModal.jsx`

**Qué se hizo:**
- PlannerPage: `activeAchievementGoal` — fetch goal+indicators por subject/grade/period
- GuideEditorPage: `repair()` en load — hereda `indicator_id` del NEWS más próximo por fecha; fallback a achievement_goal del período
- GuideEditorPage: botón 🔄 para re-vincular indicador
- AIGeneratorModal desbloqueado con `activeIndicator || achievementGoal` (sin learningTarget)
- CheckpointModal: reemplaza `upsert(onConflict)` por check-then-insert/update

**Bugs resueltos:**
- `indicator_id null` en guías → LEY DE LA CASCADA: fuente 1 = NEWS con actividad en la semana, fuente 2 = due_date más cercano, fuente 3 = goal fallback — NUNCA solo el período
- AIGeneratorModal bloqueado → el gate era `learningTarget` (legacy) — reemplazado por `activeIndicator || achievementGoal`
- CheckpointModal error → `upsert(onConflict)` sin confirmar constraint en prod — fix: check-then-write

---

## [2026-04-08 / Sesión H] Páginas admin + limpieza legacy

**Archivos clave:** Múltiples páginas nuevas · `DashboardPage.jsx`

**Qué se hizo:**
- Nuevas páginas: SubjectManagerPage · GuideLibraryPage · PeriodCoverageDashboard · ObservationLoggerPage · ReviewRoomPage · CurriculumPage · AgendaPage · PrinciplesPage
- **Limpieza legacy completa:** LearningTargetsPage · LearningTargetSelector · LearningTargets.css eliminados
- `learning_targets` eliminada de DB (tabla + 3 columnas `target_id`)
- `isModeloB = MODELO_B_SUBJECTS.includes(subject)` — sin dependencia de `news_model` legacy
- `news_legacy` permanece en DB — datos históricos, no borrar

**Decisiones no obvias:**
- `news_legacy` no se borra aunque el sistema nuevo la reemplaza — hay datos históricos de proyectos que no se migraron

---

## [2026-04-09 / Sesión I] IA enriquecida + export DOCX rediseñado

**Archivos clave:** `AIAssistant.js` · `exportDocx.js` · `exportHtml.js` · `GuideEditorPage.jsx`

**Qué se hizo:**
- `suggestSectionActivity`: contexto del libro inyectado (`textbook_reference: book, units[], grammar[], vocabulary[]`) + título y skill del proyecto NEWS
- `ACTIVITY_ARCHETYPES` por sección: 10-15 tipos, selección vía `variantSeed` → variedad garantizada en cada click
- Botón "🔄 Otra sugerencia" llama `handleSuggest()` directamente (antes solo limpiaba estado)
- Export DOCX: tabla single-column, sección banner + contenido por fila, `cantSplit: true`
- Preview modal antes de descargar — `openExportPreview()` con iframe srcDoc
- `inlineImages()` — base64 para exportaciones fully self-contained

---

## [2026-04-14 / Sprint 6 DB] Campos unit_number y subunit

**Archivos clave:** Migración `20260425160000_syllabus_unit_fields.sql`

**Qué se hizo:**
- `syllabus_topics.unit_number integer nullable` — Language Arts y Science
- `syllabus_topics.subunit text nullable` — solo Language Arts (Cambridge 1.1–1.5)
- Regla de 2 semanas por unidad: `validateUnitWeekRule()` en `useSyllabus.js`

---

## [2026-04-15 a 2026-04-26 / Sprints mayores] Módulos grandes

**Archivos clave:** `ExamCreatorPage.jsx` · `ExamDashboardPage.jsx` · `ExamPlayerV2Page.jsx` · `ExamReviewPage.jsx` · `StudentsPage.jsx` · `PsicosocialPage.jsx` · `AchievementsPage.jsx` · `ReviewRoomPage.jsx` · Edge Functions exam-*

**Qué se hizo:**

### Módulo de Evaluación (Backend + Frontend)
- 10 tablas: `exam_blueprints`, `exam_instances`, `exam_sessions`, `exam_responses`, `exam_results`, + colas AI
- Edge Functions: `exam-preflight`, `exam-instance-generator`, `exam-ai-corrector`, `exam-response-corrector`, `exam-integrity-alert`, `exam-pdf-generator`
- `ExamCreatorPage` — wizard creación con IA: tema+grado → examen en <2 min
- `ExamPlayerV2Page` — email-auth, antitrampa 5 capas (fullscreen, canvas watermark, visibilitychange, Telegram alerts, keystroke blocking)
- `ExamDashboardPage` — resultados + monitor en vivo
- `ExamReviewPage` — revisión humana de respuestas IA
- N versiones anti-copia con shuffle determinístico (`seededShuffle` en `examUtils.js`)
- Impresión institucional CBF-G AC-01
- `EXAM_PRESETS`: quiz / final_lower / final_upper

### Roster de Estudiantes
- `school_students` table + `StudentsPage` — import CSV, display apellido-nombre, eliminación por lotes
- `exam-instance-generator` auto-query roster al generar instancias

### Módulo Psicosocial
- 3 tablas: perfiles, seguimientos, planes
- `PsicosocialPage` — semáforo · perfil · seguimiento · plan docente · notas confidenciales ocultas
- PIAR: acomodaciones inyectadas en `generateGuideStructure` sin PII

### Módulo Logros — Rediseño
- `ObjectivesPage` → `AchievementsPage` (ruta `/achievements`)
- GoalCard con borde coloreado · WeightBar · CompletenessChecklist · CascadePanel

### Sala de Revisión
- Cola `submitted` + acordeón por grado + stats
- Aprobar / Devolver / Publicar con IntentModal + justificación obligatoria
- Snapshot HTML inmutable a Supabase Storage al publicar

### CBF Observability Layer
- 16 códigos error `CBF-[MOD]-[TYPE]-[NNN]`
- Edge Function `cbf-logger` + alertas Telegram + health snapshots
- `CBF-Quality-Standard-v1.0.md` — Definition of Done

**Decisiones no obvias:**
- `seededShuffle` en `examUtils.js` es canónico — NUNCA duplicar en componentes
- `helpers de estudiantes` en `studentUtils.js` — no duplicar inline
- Privacidad Telegram: código anónimo = last-6 chars del `instance_id` — nunca nombre real
- Antitrampa iOS Safari: no soporta fullscreen → "modo quiosco" con banner rojo fijo + scroll bloqueado
- `IA` migrada de `AIAssistant.js` monolítico → `guideAI.js` + `examAI.js` + `aiClient.js`

---

## [2026-05-01 / Sesión actual] Pull + Sprint 6 PASO 1 + fix build

**Archivos clave:** `src/utils/constants.js` · `src/components/editor/DayPanel.jsx` · `src/utils/guideAI.js`

**Qué se hizo:**
- Pull de 72 commits desde GitHub (trabajo hecho en otra máquina/sesión)
- Aplicar Sprint 6 PASO 1 del stash: renombrar secciones al sistema institucional final
- `constants.js`: nuevos labels (`SYNCHRONIC CLASS · MEET`, `SUBJECT TO BE WORKED:`, `MOTIVATION`, `SKILLS DEVELOPMENT`) + colores institucionales + campo `sublevel`
- `DayPanel.jsx`: render visual de sublevels con indent y borde izquierdo gris
- `guideAI.js`: actualizar `ACTIVITY_ARCHETYPES` y `SECTION_LIMITS` para coincidir con nuevos labels
- Fix build CI: `detectActivityType`, `isoMonday`, `formatWeekRange` no estaban exportadas desde `constants.js` aunque eran importadas por `PlannerPage` y `NewsPeriodTimeline`

**Bugs resueltos:**
- Build CI roto → `detectActivityType` importada de `constants.js` pero nunca definida ahí — bug latente del refactoring de sesiones anteriores que el pull expuso

**Pendiente de esta sesión:**
- Creación de este changelog
- Sprint 6 PASO 2 (AIAssistant prompt) ya estaba en `guideAI.js` con versión más avanzada — no requirió cambios
- Sprint 6 PASO 3 (Export Legacy DOCX) — pendiente
- Sprint 6 PASO 4 (SyllabusPage validateUnitWeekRule) — pendiente verificar si ya está aplicado

---

## Próxima sesión — pendientes conocidos

Ver `docs/claude/roadmap.md` para el estado completo. Items de alta prioridad:

- **Google OAuth** — configurar en Supabase Dashboard + validar dominio post-OAuth en `App.jsx`
- **Email al representante** — nota final al completar corrección IA
- **ExamPlayerV2** — UI de puntos extra (scoring base vs. extra points separado)
- **Sprint 6 PASO 3** — Export Legacy DOCX (`exportLegacyGuide.js` + botón en `GuideEditorPage`)
- **Sprint 6 PASO 4** — Verificar `validateUnitWeekRule` en `SyllabusPage`
