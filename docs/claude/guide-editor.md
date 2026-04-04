# Guide Editor & Planner

## Rich Text Editor (`src/components/RichEditor.jsx`)

Uses **Tiptap** with these extensions: StarterKit, Underline, TextStyle, Color, Highlight (multicolor), Link, TextAlign, FontFamily, and a custom `FontSize` extension. Font/size marks apply only to selected text — they do NOT affect AI-inserted content (which uses `setContent()`).

## Guide Editor UX (`src/pages/GuideEditorPage.jsx`)

### Section accordion
- `SECTIONS` constant includes a `short` label used by the sticky nav (e.g. `'MOTIV.'`, `'SKILL'`)
- Section bodies use CSS `grid-template-rows: 0fr → 1fr` animation for smooth open/close
- **Sticky section navigator** (`.ge-section-nav`) sits above the sections with 6 colored pills. Each pill has a dot that fills when the section has content. Click → scrolls to and opens that section.
- **Collapsed header** shows: status dot (⚪/⚫), section label, text peek (first 64 chars), and chips for SmartBlocks/images/videos count.
- **Per-section preview toggle** — each section has its own `👁 Ver preview` button (state in `sectionPreviews` object, not a global flag).
- **Word count** displayed below each RichEditor (`ge-word-count` class).

### Panel "1 · Indicador" (`activePanel === 'objetivo'`)
- **`LearningTargetSelector`** muestra el indicador de logro vinculado (`lesson_plans.target_id`). Query incluye `indicadores, news_model, tematica_names`.
- **Auto-populate en carga:** si la guía tiene `target_id` y `objetivo.indicadores` está vacío, `load()` hace un fetch del target y rellena `objetivo.indicadores` automáticamente. Objetos Modelo B se normalizan vía `getIndText()`.
- **Indicadores read-only:** se renderizan como lista verde estilizada. La fuente de verdad es `learning_targets.indicadores` — se editan en `/targets`, no en el editor.
- **Chips NEWS:** `linkedNewsProjects` muestra chips de los proyectos NEWS que comparten el mismo `target_id`. Link directo a `/news`.
- **`getIndText(ind)`** — helper inlineado en `GuideEditorPage` para normalizar string o objeto Modelo B a texto display.
- Solo queda editable: `objetivo.principio` (Principio del Indicador Institucional).

### SmartBlock injection from NEWS activities (first load)

When a guide is opened for the first time (empty `days` in DB), `load()` automatically injects SmartBlocks derived from scheduled NEWS activities:

1. Queries `news_projects` filtered by `school_id + subject`; filters by grade using `startsWith`
2. For each project's `actividades_evaluativas`, checks if `act.fecha` falls within the guide's day keys
3. Calls `guessSmartBlock(act)` to map the activity to a block type
4. Inserts the block into the appropriate section (skips if same type already exists)

**`guessSmartBlock(act)`** — file-level helper in `GuideEditorPage.jsx`:

| Keyword match | Type | Model | Section |
|---|---|---|---|
| `dict` | `DICTATION` | `word-grid` | `skill` |
| `quiz`, `test` | `QUIZ` | `topic-card` | `skill` |
| `reading`, `lectura` | `READING` | `comprehension` | `skill` |
| `speaking`, `oral` | `SPEAKING` | `rubric` | `skill` |
| `vocab` | `VOCAB` | `matching` | `activity` |
| `exit`, `ticket` | `EXIT_TICKET` | `can-do` | `closing` |
| (no match) | `null` | — | — |

Injection fires **only once** (when savedDays was empty) and de-dupes by type per section.

### Left nav panel
- **El nav abre directamente en `1 · Indicador`** — los paneles Encabezado e Información fueron removidos del nav para docentes.
- El nav tiene 2 pasos fijos (`1 · Indicador`, `2 · Versículo`) + días + `★ Resumen`.
- Day items show a mini progress bar + `filled/total` count (e.g. `3/6`).
- **Guías de 2 semanas:** When `plan.week_count === 2`, the nav renders "Semana 1" and "Semana 2" section separators. On load, if ≤5 days are saved, `buildDaysFromDB` fills in the missing week-2 days from the teacher's schedule.

### Context Banner (`.ge-context-banner`)
- Banner read-only siempre visible en la parte superior del área de contenido.
- Muestra: logo institucional, nombre del colegio, grado · asignatura · semana · fechas, docente.
- Solo admins ven botones `⚙ Encabezado` y `✏ Información`.
- El logo siempre se carga fresco desde `schools.logo_url` al abrir la guía (línea ~155 de GuideEditorPage).

### Datos institucionales
- **Fuente de verdad: `schools` table** — `name`, `dane`, `resolution`, `plan_code`, `plan_version`, `logo_url`.
- **Logo:** Supabase Storage bucket `guide-images`, path `logos/{school_id}/{timestamp}.ext`. Solo desde Panel de control.

### Save status & Top bar
- Save pill colors: green (saved), yellow (unsaved), blue (saving with pulse), red (error). `Ctrl+S` / `Cmd+S` triggers save.
- **`🖨️ Imprimir / PDF`** button (`.ge-print-btn`) — red gradient, saves then opens print dialog. Primary export action.
- **`⋯ Más opciones`** dropdown: Word (.docx), HTML, AI analyze, AI generate.

## PlannerPage UX (`src/pages/PlannerPage.jsx`)

Ruta `/planner`. Pantalla de inicio del flujo de creación de guías.

- **Header degradado** con selector de duración (1 semana / 2 semanas) — guarda `week_count` en `lesson_plans`.
- **4-field grid:** Grado, Materia, Semana, Período.
- **Callout de indicador vinculado** (`.planner-linked-target`) — aparece en cuanto se selecciona grado + materia. Muestra el indicador de logro activo con su nivel taxonómico.
- **`PlannerPeriodTimeline`** — componente al final de `PlannerPage.jsx`. Aparece entre el callout de indicador y el callout de hitos. Muestra **todas las actividades evaluativas y fechas de entrega del período** agrupadas por semana ISO. La semana seleccionada se resalta en azul navy con badge "★ Esta semana". `detectActivityType(nombre)` detecta tipos via keywords: 🎤 Dictation, 📝 Quiz/Test, 📖 Reading, 🗣 Speaking, 🎧 Listening, ✍️ Writing, 🔤 Vocab, 🔧 Workshop, 🚪 Exit Ticket. Entregas NEWS marcadas con 🏁. Helper `isoMonday(dateStr)` agrupa por semana.
- **Callout hitos NEWS** (`.planner-news-hitos`) — actividades evaluativas en el rango de la semana seleccionada. Filtra client-side por grade (`startsWith`) y fechas.
- **Period chips** (`.wc-periods`) — períodos del horario del docente por día. Días sin clase muestran `.wc-no-class`.
- **Indicador de guía existente** (`.planner-existing-plan`) — callout ámbar si ya existe una guía para esa combinación. Botón cambia a `📋 Continuar guía →`.

## Checkpoint flow

When a teacher opens `PlannerPage`, the app checks if the **previous week's plan** had a `target_id` but no matching `checkpoints` row. If so, `CheckpointModal` intercepts asking the teacher to evaluate the learning target achievement before proceeding.
