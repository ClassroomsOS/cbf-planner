# CLAUDE.md

> **"Nosotros Diseñamos. El docente enseña."**
> El diseño del sistema no debe ser abrumador para el profesor. Nosotros somos quienes diseñamos para ellos, para que sea fácil y deseable aplicar.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ IMPORTANTE: Session Checklist

**Al INICIAR cada conversación:** Lee `.claude-session-checklist.md` y verifica si hay commits recientes sin documentar.

**Al FINALIZAR cada conversación:** Ejecuta el checklist de fin de sesión (ver `.claude-session-checklist.md`) y pregunta si CLAUDE.md necesita actualizarse con features implementadas en esta sesión.

**Rationale:** Múltiples sesiones concurrentes causan desincronización entre código y documentación. Este checklist fuerza sincronización.

## 🚨 POLÍTICA DE COMMITS OBLIGATORIA

**NUNCA salir de una sesión con cambios sin commitear.**

### Reglas:

1. **Acumulación de features relacionados:**
   - Puedes acumular varios features pequeños relacionados en un solo commit
   - Si son cambios del mismo scope (ej: varios ajustes al editor), agrúpalos
   - Features grandes o no relacionados → commits separados

2. **Cuándo commitear:**
   - ✅ Features grandes completados
   - ✅ Grupos de features pequeños relacionados
   - ✅ Refactors que pasan las pruebas básicas (npm run dev funciona)
   - ✅ Fixes de bugs verificados
   - ✅ Cambios en CLAUDE.md o documentación

3. **Formato de commits:**
   ```
   feat(scope): descripción corta
   refactor(scope): descripción
   fix(scope): descripción
   docs: descripción
   ```
   Scope ejemplos: `news`, `ai`, `editor`, `auth`, `export`, `perf`, `a11y`

4. **Antes de salir de sesión:**
   - Verificar `git status`
   - Si hay cambios sin commitear → commitear TODO
   - Si hay trabajo a medias → stash o commitear con `WIP:` prefix

**Rationale:** Múltiples sesiones concurrentes + falta de commits = pérdida de trabajo.

### Scripts de automatización:

**Commit rápido:**
```bash
./.claude/auto-commit.sh "feat(scope): descripción"
```
Este script:
- Muestra cambios pendientes
- Hace `git add -A`
- Commitea con el mensaje + co-author tag
- Muestra confirmación

**Verificación antes de salir:**
```bash
./.claude/session-end-check.sh
```
Este script:
- Verifica si hay cambios sin commitear
- Si hay cambios → muestra advertencia
- Si no hay cambios → aprueba el fin de sesión

**Claude DEBE ejecutar `.claude/session-end-check.sh` al final de CADA sesión antes de despedirse del usuario.**

## Commands

```bash
npm run dev       # Start dev server (http://localhost:5173/cbf-planner/)
npm run build     # Production build → dist/
npm run preview   # Preview production build locally
```

No test runner is configured. There are no lint scripts in `package.json`.

To deploy the Edge Function to Supabase:
```bash
supabase functions deploy claude-proxy --no-verify-jwt
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

Always deploy with `--no-verify-jwt`; without it the Supabase gateway rejects client JWTs.

Local development requires a `.env.local` file in the project root:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```
This file is gitignored. In production, GitHub Actions injects these from repository Secrets.

## Architecture

**Stack:** React 18 + Vite 5 SPA → GitHub Pages (`/cbf-planner/`). Supabase for auth, PostgreSQL, and Edge Functions.

### Auth & routing (`App.jsx`)

`App.jsx` is a state machine: `session === undefined` = loading, `null` = no session, object = logged in. After login, it fetches `teachers.*, schools(*)` and gates routing by `teacher.status` (`pending` | `approved` | `rejected`) and `teacher.role` (`teacher` | `admin`). The whole authenticated experience lives under `DashboardPage`.

### Context providers (mounted in `DashboardPage`)

- **`FeaturesContext`** — loads `schools.features` (JSONB) once per session and exposes per-school feature flags. Default flags are in `FeaturesContext.jsx`. Use `useFeatures()` to gate UI; use `updateFeature(key, value)` to persist changes (admin only).
- **`ToastContext`** — global toast notifications. Use `const { showToast } = useToast()`. Signature: `showToast(message, type?, duration?)`. Types: `'success' | 'error' | 'info' | 'warning'`.

### Real-time updates

Supabase Realtime is used for instant notifications and messages updates instead of polling. **No polling intervals exist in the codebase** — all data updates are event-driven.

**Implementation (`DashboardPage.jsx`):**
- Two Realtime subscriptions: `notifications-changes` and `messages-changes`
- Listens to `INSERT`, `UPDATE`, `DELETE` events on respective tables
- Filters applied: `school_id=eq.X` for notifications, `to_id=eq.X` for messages
- RLS policies are automatically respected by Realtime
- Subscriptions are cleaned up on component unmount

**Performance impact:**
- **Before:** 20-30 users × 2 queries/minute = 40-60 queries/minute constant load
- **After:** 2 subscriptions/user, updates only when data actually changes
- **Reduction:** ~95% fewer database queries, instant UX updates (no 60s delay)

**Auto-save in GuideEditorPage:** The only remaining `setInterval` is for auto-saving lesson plans every 30s. This is intentional and local to the editor — not polling remote data.

### AI integration

All AI calls go through a **Supabase Edge Function** (`supabase/functions/claude-proxy/index.ts`) that proxies to `claude-sonnet-4-20250514`. The API key never touches the client. The Edge Function uses `body.max_tokens` directly — there is no type-based switch, so new AI functions only need a new export in `AIAssistant.js`.

Client-side entry point is `src/utils/AIAssistant.js`, which exposes:

| Function | Purpose | `maxTokens` |
|---|---|---|
| `suggestSectionActivity()` | Suggest HTML content for a single guide section | 2000 |
| `analyzeGuide()` | Pedagogical analysis of a complete guide | 4000 |
| `generateGuideStructure()` | Generate full week structure as JSON (includes SmartBlocks) | 16000 |
| `suggestSmartBlock()` | Suggest one SmartBlock for a section based on context + taxonomy | 1200 |
| `generateRubric()` | Generate complete 5-level rubric (**exactly 8 criteria**) for NEWS project | 4000 |
| `generateIndicadores()` | Generate indicators per Temática (Modelo A) or per habilidad (Modelo B) | 1500/2000 |
| `importGuideFromDocx()` | Parse .docx text (via mammoth) into CBF lesson_plan content JSON | 8000 |

`setAIContext({ schoolId, teacherId, monthlyLimit })` — must be called on login (DashboardPage). Enables usage logging to `ai_usage` table and monthly token limit enforcement. Pricing: input $3/MTok, output $15/MTok.

`generateGuideStructure` auto-retries with a more concise prompt when the response is truncated (JSON parse failure). It also asks Claude to include an optional `smartBlock` field in `activity` and `skill` sections (max 2 per day).

**`AIGeneratorModal` — fuente de verdad del objetivo:**
El modal (`src/components/AIComponents.jsx`) nunca pide al docente que reescriba el indicador. El `objective` que se pasa a `generateGuideStructure` se deriva en `handleGenerate` en este orden de prioridad:
1. `activeIndicator.texto_en || activeIndicator.habilidad` (indicador detectado automáticamente por semana)
2. Indicador del `selectedSkill` elegido en el skill picker (Modelo B sin `activeIndicator`)
3. `learningTarget.description` (Modelo A)

**Estados del modal:**
- **Sin `learningTarget`** → muestra mensaje ámbar *"Ve al panel 1 · Indicador"* y oculta el formulario. El docente no puede generar sin contexto pedagógico.
- **Modelo B sin skill seleccionada** → skill picker visible, botón deshabilitado hasta elegir habilidad.
- **Con indicador resuelto** → card verde read-only + campo Unidad/Tema/Libro + botón activo.

`suggestSmartBlock` receives `{ sectionMeta, grade, subject, objective, unit, dayName, existingContent, existingBlocks, learningTarget, planId }` and returns `{ type, model, data }` ready to insert. It aligns the suggestion to the learning target's taxonomy level:
- `recognize` → VOCAB matching, QUIZ topic-card, READING true-false
- `apply` → DICTATION, GRAMMAR fill-blank, WORKSHOP stations, READING comprehension
- `produce` → SPEAKING rubric, WORKSHOP roles, EXIT_TICKET can-do

`generateIndicadores()` has 3 modes: **Modelo B** (`isModeloB=true`) → 4 objects `{habilidad, texto_en, principio_biblico}`; **Modelo A + tematicaNames** → N strings, one per Temática; **Modelo A fallback** → 3 generic strings. The `getIndText(ind)` helper (exported from `LearningTargetsPage.jsx`) normalizes either format to a display string — use it everywhere indicators may be objects.

`extractJSONArray(text)` — internal helper in `AIAssistant.js` that first tries `JSON.parse(text)`, then falls back to regex `/\[[\s\S]*\]/` extraction. Used in `generateIndicadores()` to handle responses where Claude wraps JSON in markdown code fences.

`callClaude()` reads the response as text first (`response.text()`), then parses JSON — this prevents cryptic "Unexpected token" errors when the Edge Function returns a non-JSON error message.

### Lesson plan data model

Plans are stored in `lesson_plans.content` as a nested JSONB object:

```
content: {
  header: { school, dane, codigo, version, proceso, logo_url },
  info: { grado, asignatura, semana, periodo, fechas, docente },
  objetivo: { general, indicadores[], principio },
  verse: { text, ref },
  days: {
    "YYYY-MM-DD": {
      active, date_label, class_periods, unit,
      sections: {
        subject | motivation | activity | skill | closing | assignment: {
          time, content (HTML), images[], audios[], videos[], smartBlocks[]
        }
      }
    }
  },
  summary: { done, next }
}
```

The six **CBF sections** per day always follow this order and default times: `subject (~8 min)`, `motivation (~8 min)`, `activity (~15 min)`, `skill (~40 min)`, `closing (~8 min)`, `assignment (~5 min)`.

`lesson_plans.grade` stores the combined label `"10.° A"` (grade + section). `teacher_assignments.grade` stores only the base `"10.°"`. In `buildDaysFromDB` (GuideEditorPage), strip the section suffix before querying: `data.grade.slice(0, -data.section.length - 1)`.

The logo is always fetched fresh from `schools.logo_url` on guide load — never rely on a cached prop.

### SmartBlocks

Each section's `smartBlocks[]` holds structured content blocks with this shape:
```
{ id: number, type: string, model: string, data: object }
```

**Available types** (`src/components/SmartBlocks.jsx`):

| Type | Color | Models | Key data fields |
|---|---|---|---|
| `DICTATION` | `4BACC6` | `word-grid`, `sentences` | `words[]`, `instructions`, `time` |
| `QUIZ` | `C0504D` | `topic-card`, `format-box` | `date`, `unit`, `topics`, `format?`, `note?` |
| `VOCAB` | `9BBB59` | `cards`, `matching` | `words[{w,d,e}]` |
| `WORKSHOP` | `F79646` | `stations`, `roles` | stations: `[{name,time,desc}]` / roles: `[{role,task}]` |
| `SPEAKING` | `8064A2` | `rubric`, `prep` | rubric: `criteria[{name,pts}]` / prep: `steps[]` |
| `NOTICE` | `1F3864` | `banner`, `alert` | `title`, `message`, `icon`, `priority?` |
| `READING` | `17375E` | `comprehension`, `true-false` | comprehension: `passage`, `questions[{q,lines}]` / true-false: `passage`, `statements[{s}]` |
| `GRAMMAR` | `375623` | `fill-blank`, `choose` | fill-blank: `grammar_point`, `sentences[{sent,answer}]` / choose: `grammar_point`, `items[{sentence,options[],answer}]` |
| `EXIT_TICKET` | `C55A11` | `can-do`, `rating` | can-do: `skills[]` / rating: `statements[]` |

`blockPreviewHTML(block)` generates inline-styled HTML for in-app preview and HTML export (imported by `exportHtml.js`). `buildSmartBlockDocx(block)` in `exportDocx.js` converts blocks to native DOCX tables/paragraphs.

`blockInteractiveHTML(block, blockId)` generates a self-contained `<button>` + native `<dialog>` + `<script>` for the exported HTML. Returns `null` for read-only block types. Called from `sectionContent()` in `exportHtml.js` — the interactive widget appears below the static preview of each block. The launch button is hidden in `@media print`.

**Interactive block support:**
| Block | Mechanic | Auto-check |
|---|---|---|
| `VOCAB matching` | Dropdown select per term | ✅ Score + green/red |
| `GRAMMAR fill-blank` | Text `<input>` per blank | ✅ Compares `answer` field |
| `GRAMMAR choose` | Tap option buttons | ✅ Highlights correct/wrong |
| `READING true-false` | TRUE/FALSE buttons per statement | — (no stored answers) |
| `READING comprehension` | `<textarea>` per question | — (open-ended) |
| `EXIT_TICKET can-do` | Emoji tap (😊😐😕) | — (self-assessment) |
| `EXIT_TICKET rating` | 1–5 circle tap | — (self-assessment) |
| `DICTATION`, `QUIZ`, `WORKSHOP`, `SPEAKING`, `NOTICE` | Static / read-only | — |

**Important:** `READING true-false` statements may arrive as plain strings `["text"]` or as objects `[{s:"text"}]` depending on AI generation. `blockInteractiveHTML` handles both via `typeof st === 'string' ? st : st?.s`.

`SmartBlocksList` accepts an `aiContext` prop `{ sectionMeta, grade, subject, objective, unit, dayName, existingContent, learningTarget }` which enables the "✨ Sugerir con IA" button. When `aiContext` is absent the button is hidden.

All modals in SmartBlocks use `createPortal(…, document.body)` to prevent click-outside-closes-modal bugs caused by DOM ancestor event bubbling.

#### VOCAB matching model
The `matching` model displays **3 columns**: TERMS | MEANINGS | IN CONTEXT. All words are shown (not split in half). The editor labels the 3rd column "IN CONTEXT" (stored as `wd.e`). Both `blockPreviewHTML` and `buildSmartBlockDocx` use `pct: 18/42/40` proportions.

### Image layout system

Each section can have up to **6 images** in `section.images[]` (uploaded via `ImageUploader`, compressed to max 900px / JPEG 0.82). Position is controlled by `section.image_layout: 'below' | 'right' | 'left'` (set via `LayoutSelectorModal`).

**Below layout grids by count:**
- 1 → full-width hero (16/9)
- 2 → 2 columns (4/3)
- 3 → 3 columns (4/3)
- 4 → 2×2 grid (4/3)
- 5 → row of 3 + row of 2 (3/2)
- 6 → 3×2 grid (3/2)

**Side layout (right/left):**
- 1–2 images → stacked column (4/3)
- 3–6 images → 2-column mini-grid (1/1 square)

Old field `layout_mode: 'stack' | 'side'` is normalized everywhere to the new values. Both `exportHtml.js` and `exportDocx.js` read `image_layout` and fall back gracefully.

DOCX day tables use **3 columns** `[1760, 5605, 3435]` DXA. Header and unit rows use `span: 3`. Section rows are either 2-col (below layout, `span: 2` on content) or 3-col (right/left layout, separate text and image cells).

### Export system

| File | Function | Notes |
|---|---|---|
| `src/utils/exportHtml.js` | `exportHtml()`, `exportPdf()`, `buildHtml()` | Imports `blockPreviewHTML` + `BLOCK_TYPES` from SmartBlocks.jsx for block rendering. Tabla indicadores: **full-width una columna** (se eliminó la columna "Logro" izquierda). Objetos Modelo B normalizados a texto plano. |
| `src/utils/exportDocx.js` | `exportGuideDocx()` | `buildSmartBlockDocx(block)` handles all 9 block types natively. Tabla indicadores: **full-width una columna**, header `INDICADORES DE LOGRO`. Objetos Modelo B normalizados. Solo renderiza si hay indicadores (`_indicadores.length > 0`). |
| `src/utils/exportRubricHtml.js` | `exportRubricHtml(project, principles, school)` | Genera HTML interactivo autocontenido para evaluar proyectos NEWS en tiempo real. Clickear celda de rúbrica → calcula nota (escala 1.0–5.0 Boston Flex). Incluye: banner de verso, escala visual, panel de puntaje, tabla interactiva con JS embebido, panel de resultado con override y comentarios, botón imprimir. Abre en `window.open('', '_blank')`. |

Both exports render: text content, images (with layout), videos (HTML only — iframes), and SmartBlocks. SmartBlocks appear after video content, each with a colored type-header strip.

**HTML export specifics:**
- `verse.text` is rendered as raw HTML (not escaped) since it comes from RichEditor
- Each section `<tr>` has `break-inside: avoid; page-break-inside: avoid` for clean PDF printing
- Each day block has class `day-block`; consecutive days force a page break (`break-before: page`)
- The exported HTML includes a **floating red "🖨️ Guardar como PDF" button** (`.pdf-fab`) that calls `window.print()` — hidden in `@media print`. This allows students/parents on the virtual campus to generate their own PDF without any app.
- `exportPdf()` opens a new window, writes the HTML, and calls `window.print()` after 900ms. It also shows a 6-second tip overlay explaining how to save as PDF.

**DOCX export specifics:**
- All section `TableRow`s have `cantSplit: true` — Word will not split a section row across pages
- Image paragraphs for 5–6 images use 2 rows of `ImageRun`s sized proportionally

### Rich Text Editor (`src/components/RichEditor.jsx`)

Uses **Tiptap** with these extensions: StarterKit, Underline, TextStyle, Color, Highlight (multicolor), Link, TextAlign, FontFamily (`@tiptap/extension-font-family`), and a custom `FontSize` extension.

**Font family options:** Por defecto, Arial, Times New Roman, Georgia, Verdana, Courier New, Calibri.
**Font size options:** 8px – 36px.

Font/size marks are applied only to selected text — they do NOT affect AI-inserted content (which uses `setContent()` and enters clean).

### Guide Editor UX (`src/pages/GuideEditorPage.jsx`)

#### Section accordion
- `SECTIONS` constant includes a `short` label used by the sticky nav (e.g. `'MOTIV.'`, `'SKILL'`)
- Section bodies use CSS `grid-template-rows: 0fr → 1fr` animation for smooth open/close
- **Sticky section navigator** (`.ge-section-nav`) sits above the sections with 6 colored pills. Each pill has a dot that fills when the section has content. Click → scrolls to and opens that section.
- **Collapsed header** shows: status dot (⚪/⚫), section label, text peek (first 64 chars), and chips for SmartBlocks/images/videos count.
- **Open header** shows: label + time only.
- **Per-section preview toggle** — each section has its own `👁 Ver preview` button (state in `sectionPreviews` object, not a global flag).
- **Word count** displayed below each RichEditor (`ge-word-count` class).

#### Panel "1 · Indicador" (`activePanel === 'objetivo'`)
- **`LearningTargetSelector`** muestra el indicador de logro vinculado (`lesson_plans.target_id`). Query incluye `indicadores, news_model, tematica_names` — el auto-fill usa los indicadores reales al vincular.
- **Auto-populate en carga:** si la guía tiene `target_id` y `objetivo.indicadores` está vacío, `load()` hace un fetch del target y rellena `objetivo.indicadores` automáticamente (strings planos — los objetos Modelo B se normalizan vía `getIndText()`).
- **Indicadores read-only:** se renderizan como lista verde estilizada, no textareas. La fuente de verdad es `learning_targets.indicadores` — se editan en `/targets`, no en el editor de guías.
- **Chips NEWS:** `linkedNewsProjects` (estado cargado via useEffect en `plan.target_id`) muestra chips de los proyectos NEWS que comparten el mismo `target_id`. Link directo a `/news`.
- **`getIndText(ind)`** — helper inlineado en `GuideEditorPage` (igual que en `LearningTargetsPage`) para normalizar string o objeto Modelo B a texto display.
- Solo queda editable: `objetivo.principio` (Principio del Indicador Institucional).

#### SmartBlock injection from NEWS activities (first load)

When a guide is opened for the first time (empty `days` in DB), `load()` automatically injects SmartBlocks derived from scheduled NEWS activities:

1. Queries `news_projects` filtered by `school_id + subject`; filters by grade using `startsWith` (e.g. `"10.° A".startsWith("10.°")`)
2. For each project's `actividades_evaluativas`, checks if `act.fecha` falls within the guide's day keys
3. Calls `guessSmartBlock(act)` to map the activity to a block type
4. Inserts the block into the appropriate section (skips if same type already exists)

**`guessSmartBlock(act)`** — file-level helper in `GuideEditorPage.jsx`. Maps activity name keywords to SmartBlock stubs:

| Keyword match | Type | Model | Section |
|---|---|---|---|
| `dict` | `DICTATION` | `word-grid` | `skill` |
| `quiz`, `test` | `QUIZ` | `topic-card` | `skill` |
| `reading`, `lectura` | `READING` | `comprehension` | `skill` |
| `speaking`, `oral` | `SPEAKING` | `rubric` | `skill` |
| `vocab` | `VOCAB` | `matching` | `activity` |
| `exit`, `ticket` | `EXIT_TICKET` | `can-do` | `closing` |
| (no match) | `null` | — | — |

Returns `{ type, model, section, data }` or `null`. The `data` stub pre-fills `instructions`/`topics`/`skills` from `act.descripcion || act.nombre`. Injection fires **only once** (when savedDays was empty) and de-dupes by type per section.

#### Left nav panel
- **El nav abre directamente en `1 · Indicador`** — los paneles Encabezado e Información fueron removidos del nav para docentes (son datos de contexto, no de trabajo diario).
- El nav tiene 2 pasos fijos (`1 · Indicador`, `2 · Versículo`) + días + `★ Resumen`.
- Day items show a mini progress bar + `filled/total` count (e.g. `3/6`) indicating how many sections have content. Bar turns white when the day is active.
- **Guías de 2 semanas:** When `plan.week_count === 2`, the nav renders "Semana 1" and "Semana 2" section separators between day items. Both weeks' days are stored in the same `lesson_plans` row. On load, if ≤5 days are saved, `buildDaysFromDB` fills in the missing week-2 days from the teacher's schedule.

#### Context Banner (`.ge-context-banner`)
- Banner read-only siempre visible en la parte superior del área de contenido.
- Muestra: logo institucional, nombre del colegio, grado · asignatura · semana · fechas, docente.
- Solo admins ven botones `⚙ Encabezado` y `✏ Información` para editar esos datos.
- El logo siempre se carga fresco desde `schools.logo_url` al abrir la guía (línea ~155 de GuideEditorPage). No depende del content JSONB guardado.

#### Datos institucionales (Encabezado e Información)
- **Fuente de verdad: `schools` table** — `name`, `dane`, `resolution`, `plan_code`, `plan_version`, `logo_url`.
- **Gestión:** `SettingsPage` → sección "Identidad institucional" (expandible). Solo admin.
- **Logo:** Supabase Storage bucket `guide-images`, path `logos/{school_id}/{timestamp}.ext`. Se gestiona **únicamente** desde Panel de control. El editor de guías ya no permite subir logo.
- Los paneles Encabezado/Información del editor siguen accesibles para admin via el context banner, pero solo para correcciones puntuales.

#### Save status
- Displayed as a pill with color-coded background: green (saved), yellow (unsaved), blue (saving with pulse animation), red (error).
- `Ctrl+S` / `Cmd+S` triggers save.

#### Top bar
- Prominent **`🖨️ Imprimir / PDF`** button (`.ge-print-btn`) — red gradient, saves then opens print dialog. This is the primary export action for teachers.
- **`⋯ Más opciones`** dropdown contains: Word (.docx) for corrections, HTML for virtual campus upload, AI analyze, AI generate.

### Principios Rectores Institucionales

CBF es una **escuela cristiana confesional**. Los tres principios son el norte de toda planificación, IA y evaluación. Son no negociables.

| Principio | Quién lo establece | Dónde vive | Ciclo |
|---|---|---|---|
| **Versículo del Año** | Capellán (hoy: cualquier docente) | `schools.year_verse` + `year_verse_ref` | Anual |
| **Versículo del Mes** | Capellán (hoy: cualquier docente) | `school_monthly_principles.month_verse` + `month_verse_ref` | Mensual |
| **Principio del Indicador** | Docentes | `school_monthly_principles.indicator_principle` | Mensual |

**Página:** `/principles` — `PrinciplesPage.jsx`. Accesible desde el sidebar (primer ítem). Gestión por mes del año en curso.

**Flujo en IA:** Todas las funciones de `AIAssistant.js` reciben un objeto `principles: { yearVerse, monthVerse, indicatorPrinciple }` y lo inyectan via `biblicalBlock()`. En `GuideEditorPage`, los principios se cargan automáticamente según el mes de la primera jornada activa de la guía.

**Futuros roles:** Cuando exista el perfil de Capellán, podrá editar `year_verse` y `month_verse`. Los docentes siempre controlan `indicator_principle`.

### Key Supabase tables

| Table | Purpose |
|---|---|
| `teachers` | User profiles. `status`, `role`, `school_id`, `default_class/subject/period`, `ai_monthly_limit int` (0=ilimitado) |
| `schools` | Multi-tenant root. `features` JSONB, `year_verse`, `logo_url` |
| `teacher_assignments` | Admin-controlled class assignments. `grade` (base only, e.g. `"10.°"`), `section`, `subject`, `schedule` JSONB (keys: `mon/tue/wed/thu/fri`, values: period arrays), `classroom text` (salón físico) |
| `lesson_plans` | One row per guide. `content` JSONB holds all plan data. `grade` = combined label. Links to `target_id`, `news_project_id`. `week_count int` (1 or 2) — 2-week guides store both weeks in the same row. |
| `learning_targets` | **Logros del trimestre** (meta macro). `description` = el Logro (Modelo A only — empty for Modelo B). `taxonomy` enum: `recognize | apply | produce` (Modelo A global; Modelo B stores per-indicator taxonomy inside each object). `indicadores jsonb` = array of strings (Modelo A) or objects `{habilidad, taxonomy, texto_en, principio_biblico: {titulo, referencia, cita}, es_titulo, es_descripcion, es_grupo}` (Modelo B). `tematica_names jsonb` = parallel array with Temática names (Modelo A) or skill names (Modelo B). `news_model text` ('standard'\|'language', default 'standard'). |
| `school_monthly_principles` | Principios rectores por mes. `school_id, year, month, month_verse, month_verse_ref, indicator_principle`. UNIQUE(school_id, year, month) |
| `news_projects` | NEWS (project-based learning) projects. Links to `rubric_templates` via `rubric_template_id`. Links to `learning_targets` via `target_id` (UUID). Field `target_indicador` (text) stores the selected indicator from `learning_targets.indicadores[]`. `news_model text` ('standard'\|'language'). Modelo B: `competencias jsonb`, `operadores_intelectuales jsonb`, `habilidades jsonb`, `actividades_evaluativas jsonb` (array de `{nombre, descripcion, porcentaje, fecha: 'YYYY-MM-DD'}`). Para Modelo B, los 4 proyectos (uno por habilidad) se crean automáticamente al crear el Logro — ver flujo abajo. |
| `school_calendar` | Holiday/event data. `is_school_day: false` = holiday. `level` (elementary|middle|high|NULL=todos). `affects_planning boolean`. `created_by uuid` |
| `checkpoints` | Records whether a teacher evaluated a learning target at end of week |
| `weekly_agendas` | Agenda semanal por grado/sección. `grade`, `section`, `week_start date`, `devotional`, `notes`, `content jsonb` (entries[{subject,teacher_name,days:{date:text}}]), `status` (draft/ready/sent) |
| `schedule_slots` | Franjas del horario institucional (DEVOCIONAL, BREAK, HOMEROOM, etc.). `school_id`, `name`, `start_time time`, `end_time time`, `level` (elementary\|middle\|high\|NULL=todos), `color text`. Gestionado desde SettingsPage por admin. |
| `notifications` / `messages` | In-app communication. Polled every 60s in `DashboardPage` |
| `error_log` / `activity_log` | Observability. Written by `src/utils/logger.js` |

### Panel de Control (`src/pages/SettingsPage.jsx`)

Ruta `/settings`. Solo accesible para admin. Contiene:

1. **Gestión del colegio** — card con acceso rápido a:
   - `👥 Docentes y materias` → navega a `/teachers` (AdminTeachersPage)
   - `🏫 Identidad institucional` → panel expandible con:
     - Upload/cambio/quitar del logo (→ `schools.logo_url` + Supabase Storage)
     - Campos editables: nombre, DANE, resolución, código del documento, versión
     - Guarda directo en `schools` table. Aplica a TODAS las guías y NEWS.
   - `🕐 Franjas del Horario` → panel expandible con:
     - CRUD de franjas institucionales (DEVOCIONAL, BREAK, HOMEROOM, etc.)
     - Campos: nombre, hora inicio, hora fin, nivel (elementary/middle/high/todos), color
     - Guarda en tabla `schedule_slots`. Se renderizan en `SchedulePage` intercaladas con los períodos académicos según hora.
     - `SchedulePage` usa `parseTimeMin()` para ordenar. Heurística PM: hora < 6 → sumar 12 (cubre 1:30 PM, 2:15 PM sin romper format 24h de la DB).
     - Vista "Por Docente": celdas de período sin clase muestran **"Admin Hours"** en gris itálico.

2. **Feature flags** — toggles por grupo (Comunicación, IA, Editor). Lee y escribe `schools.features` JSONB via `FeaturesContext`.

### Logging

Use `logError(err, { page, action, entityId })` and `logActivity(action, entityType, entityId, description)` from `src/utils/logger.js`. For Supabase calls that might fail, use the `safeAsync()` wrapper which returns `{ data, error }` and auto-logs.

### PlannerPage UX (`src/pages/PlannerPage.jsx`)

Ruta `/planner`. Pantalla de inicio del flujo de creación de guías.

- **Header degradado** con selector de duración (1 semana / 2 semanas) integrado — guarda `week_count` en `lesson_plans`.
- **4-field grid:** Grado, Materia, Semana, Período (sin Duration — está en el header).
- **Callout de indicador vinculado** (`.planner-linked-target`) — aparece en cuanto se selecciona grado + materia. Muestra el indicador de logro activo del período con su nivel taxonómico.
- **Callout hitos NEWS** (`.planner-news-hitos`) — aparece cuando hay actividades evaluativas de `news_projects` programadas en el rango de fechas de la semana seleccionada. Consulta `news_projects` por `school_id+subject`, filtra client-side por grade (`startsWith`) y por fechas en el rango semanal. Muestra: fecha formateada, nombre, descripción, skill con color, % peso. Estado: `weeklyNewsHitos[]`.
- **Period chips** (`.wc-periods`) — cada día de clase muestra los períodos del horario del docente (ej: `2do · 3ro`). Días sin clase muestran `.wc-no-class`.
- **Indicador de guía existente** (`.planner-existing-plan`) — callout ámbar que aparece si ya existe una guía para esa combinación grado+materia+semana. Muestra el progreso (cuántas secciones completadas). Botón cambia a `📋 Continuar guía →` en vez de `✏️ Crear guía →`. No bloquea ni sobreescribe — solo avisa.

### Checkpoint flow

When a teacher opens `PlannerPage` to create a new guide, the app checks if the **previous week's plan** had a `target_id` but no matching `checkpoints` row. If so, it intercepts with `CheckpointModal` asking the teacher to evaluate the learning target achievement before proceeding.

### Multi-tenancy

Every table uses `school_id` to scope data. The `teacher` object (passed as prop through the entire component tree) carries `school_id` and is the primary source of truth for scoping all queries.

### SPA routing on GitHub Pages

`public/404.html` encodes the path as `/?//path` and redirects to `index.html`. A script in `index.html` restores the real URL via `history.replaceState`. `pathSegmentsToKeep = 1` preserves the `/cbf-planner/` base.

### Modal rules

**No modal should close on outside click.** All modal overlays must NOT have `onClick` on the overlay div. Use `createPortal(…, document.body)` for any modal rendered inside a component that lives inside a clickable parent (e.g. section headers with `onClick` for accordion). The SmartBlocks modal already uses this pattern.

**Convención de color de headers de modales principales:**
| Modal | Header color | Significado semántico |
|---|---|---|
| Logros de Desempeño (`lt-modal-header`) | Navy `#1F3864 → #2E5598` | Meta curricular formal, institucional |
| Proyecto NEWS (`NewsProjectEditor`) | Verde `#1A6B3A → #2D8A50` | Proyecto vivencial, experiencia, crecimiento |

Ambos headers usan texto blanco, badge de tipo (`lt-modal-type-tag` para Logros, span inline para NEWS) y botón cierre traslúcido. El sidebar nav de NEWS usa el mismo verde `#1A6B3A` para bordes activos, dots y hover.

### Deploy

Push to `main` triggers GitHub Actions → `npm run build` → GitHub Pages. The build injects `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from GitHub Secrets (the Edge Function URL is derived from `VITE_SUPABASE_URL` at runtime in `AIAssistant.js`).

---

## State Management & Custom Hooks

### Zustand Store

**`src/stores/useUIStore.js`** - Global UI state management
```js
import useUIStore from '../stores/useUIStore'

// In component
const { globalLoading, setGlobalLoading } = useUIStore()
const { sidebarOpen, toggleSidebar } = useUIStore()
const { saveStatus, setSaveStatus } = useUIStore()
```

**Available state:**
- `globalLoading` - Global loading indicator
- `toasts` - Toast notification queue
- `sidebarOpen` - Sidebar visibility
- `activeModal` - Current active modal name
- `saveStatus` - Save status indicator ('saved' | 'saving' | 'unsaved' | 'error')

### Custom Hooks

All hooks available via: `import { useForm, useToggle, ... } from '../hooks'`

#### **`useForm(initialValues, onSubmit, validationSchema?)`**
Form state management with Zod validation
```js
const form = useForm(
  { name: '', email: '' },
  async (values) => { await saveData(values) },
  myZodSchema
)

<input {...form.handleChange} name="name" value={form.values.name} />
{form.errors.name && <span>{form.errors.name}</span>}
<button onClick={form.handleSubmit}>Submit</button>
```

**Returns:** `{ values, errors, touched, isSubmitting, handleChange, handleBlur, handleSubmit, reset, isValid, isDirty }`

#### **`useAutoSave(data, onSave, options?)`**
Debounced auto-save with optional delay
```js
const { saveNow } = useAutoSave(
  content,
  async (data) => { await supabase.from('plans').update(data) },
  { delay: 2000, enabled: true }
)
```

**Options:** `{ delay: 2000, enabled: true, dependencies: [] }`

#### **`usePersistentState(key, initialValue, options?)`**
useState with localStorage persistence
```js
const [theme, setTheme, clearTheme] = usePersistentState('theme', 'light')
// Automatically syncs to localStorage
```

**Options:** `{ serialize: true, debounce: 0 }`

#### **`useToggle(initialValue?)`**
Boolean toggle state management
```js
const [isOpen, toggle, setTrue, setFalse] = useToggle(false)

<button onClick={toggle}>Toggle</button>
<button onClick={setTrue}>Open</button>
```

#### **`useAsync(asyncFunction, immediate?)`**
Async operations with loading/error states
```js
const { execute, loading, data, error } = useAsync(
  async (id) => { return await fetchData(id) }
)

<button onClick={() => execute(123)} disabled={loading}>
  {loading ? 'Loading...' : 'Fetch Data'}
</button>
```

**Returns:** `{ execute, loading, data, error, reset, isSuccess, isError, isIdle }`

---

## Vocabulario UI — Convención de Términos

**"Logro"** fue eliminado del vocabulario visible. El término correcto en toda la UI es **"Indicador de Logro"** (singular) / **"Indicadores de Logro"** (plural). Lo medible y observable es el indicador — no el logro macro.

- La tabla `learning_targets` sigue llamándose igual en DB, pero en UI = "Indicador de Logro"
- El sidebar nav muestra "🎯 Indicadores de Logro" (antes "Logros")
- El panel del editor muestra "1 · Indicador" (antes "1 · Logro")
- Los indicadores en la guía son **read-only** — se editan en `/targets`, no en el editor

---

## Marco Pedagógico: Dos Modelos de NEWS

**Referencia completa:** `theoric mark/CBF_Marco_Teorico_Sistema_Educativo.md`
**Análisis de implementación:** `theoric mark/CBF_Analisis_Implementacion_Sistema.md`

El sistema CBF opera con **dos modelos estructuralmente distintos**:

### Modelo A — Estándar
Materias en español: Español, Matemáticas, Cosmovisión Bíblica, etc.
```
LOGRO (1 por trimestre/área)
  ├── TEMÁTICA 1 → INDICADOR 1 → Actividades Evaluativas
  ├── TEMÁTICA 2 → INDICADOR 2 → Actividades Evaluativas
  └── EXPERIENCIA SIGNIFICATIVA (1 sola, al final, integradora)
        └── RÚBRICA (8 criterios × 5 niveles)
```

### Modelo B — Lengua
Materias en inglés: **Language Arts, Social Studies, Science, Lingua Skill**
```
COMPETENCIAS (Sociolingüística / Lingüística / Pragmática)
OPERADORES INTELECTUALES (Deducir / Generalizar / Sintetizar / Retener / Evaluar)
  ├── INDICADOR 1 — Speaking
  │     ├── PRINCIPIO BÍBLICO PROPIO (versículo específico del indicador)
  │     ├── ENUNCIADO: solo en inglés (texto_en)
  │     ├── ES EMBEBIDA (proyecto + tamaño de grupo + criterios)
  │     └── ACTIVIDADES ESTÁNDAR (Dictados, Quiz, Cambridge One, Plan Lector, PET Prep)
  ├── INDICADOR 2 — Listening / 3 — Reading / 4 — Writing (misma estructura)
  └── RÚBRICA FINAL (organizada por habilidad)
```

**UI del modal Logros — Modelo B:** El campo "Logro del Período" NO aparece (no aplica). En su lugar, 4 pestañas fijas con color propio:
- 🎤 **Speaking** — púrpura `#8064A2`
- 🎧 **Listening** — teal `#4BACC6`
- 📖 **Reading** — naranja `#F79646`
- ✍️ **Writing** — verde `#9BBB59`

Cada pestaña tiene: selector taxonómico propio + campo EN (indicador en inglés) + principio bíblico (título, referencia, cita) + ES embebida (título, descripción, grupo). **No hay generación por IA** — los docentes llenan los indicadores que ya tienen definidos. La traducción al español fue eliminada (`texto_es` no se captura en la UI, aunque el campo persiste en DB por compatibilidad).

**Auto-creación de proyectos NEWS al crear Logro Modelo B:**
Al presionar "Crear Logro" para una materia Modelo B (`handleSave` en `LearningTargetsPage.jsx`), el sistema:
> ⚠️ **Gotcha:** La validación `if (!form.description.trim()) return` debe ejecutarse **después** de calcular `isModeloB`, no antes — en Modelo B `description` siempre está vacío porque el campo no se muestra en la UI.

1. Inserta el `learning_targets` row y obtiene su `id`
2. Auto-inserta 4 `news_projects` rows — uno por habilidad (Speaking / Listening / Reading / Writing)
3. Cada proyecto pre-cargado con: `es_titulo` (o nombre de habilidad), `es_descripcion`, `es_grupo` → `conditions`, principio bíblico (`biblical_principle` / `biblical_reflection`), `skill` (lowercase), `target_id`, `habilidades`, `news_model: 'language'`, `status: 'draft'`
4. `due_date` queda null — el docente la completa al abrir el proyecto en NEWS. `NewsProjectCard` maneja null gracefully (muestra "Sin fecha").

**Flujo docente Modelo B:**
- Crear Logro → 4 proyectos NEWS nacen automáticamente vinculados
- Abrir NEWS → ver los 4 proyectos organizados por habilidad
- Editar cada proyecto → completar: textbook reference, **actividades evaluativas**, rúbrica

**`NewsProjectEditor` — step "Actividades" (Modelo B únicamente):**
- Aparece entre Textbook y Rúbrica en el nav sidebar
- UI: formulario para agregar actividades `{nombre, descripcion, porcentaje}` + lista con eliminar
- Indicador de total % con validación (verde = 100%, rojo = excede 100%, amarillo = incompleto)
- Estado en `form.actividades_evaluativas[]`, persistido en `news_projects.actividades_evaluativas` (JSONB)
- `NewsProjectCard` muestra chip "📋 N actividades" cuando el proyecto tiene actividades
- Estructura de cada actividad: `{ nombre, descripcion, porcentaje, fecha: 'YYYY-MM-DD' | null }`
- Lista ordenada cronológicamente por `fecha`; items sin fecha marcados en gris

**Nuevo step "📅 Línea de Tiempo"** (después de Actividades):
- Agrupa actividades por semana ISO (lunes–viernes)
- Dot de color en línea vertical: color de habilidad para Modelo B, verde para Modelo A
- `SKILL_COLOR: { Speaking: '#8064A2', Listening: '#4BACC6', Reading: '#F79646', Writing: '#9BBB59' }`
- `due_date` del proyecto aparece como hito 🏁 rojo en su semana
- Panel ámbar para actividades sin fecha + botón "Asignar fechas" → vuelve al step Actividades
- Empty state si no hay fechas ni due_date

**Paso "Actividades" abierto para ambos modelos** (antes solo Modelo B).

**Migración SQL requerida:**
```sql
ALTER TABLE news_projects
ADD COLUMN IF NOT EXISTS actividades_evaluativas jsonb DEFAULT '[]'::jsonb;
```
No se requiere migración para `fecha` — es un campo dentro del JSONB existente.

### Rúbrica CBF (especificación obligatoria)
**Siempre 8 criterios × 5 niveles** (Superior/Alto/Básico/Bajo/Muy Bajo):
- 3 Cognitivos (comprensión, aplicación, análisis)
- 2 Comunicativos (claridad, organización/presentación)
- 1 Actitudinal (responsabilidad, participación)
- 1 Bíblico/Valorativo (conexión con versículo/principio)
- 1 Técnico específico de la ES

Escalas: Boston Flex → 1.0–5.0 | Boston International → 0–100

### Taxonomía (mapping)
`taxonomy` field (3 niveles, para SmartBlocks — NO cambiar):
- `recognize` ≈ Bloom: Recordar / Comprender
- `apply` ≈ Bloom: Aplicar / Analizar
- `produce` ≈ Bloom: Evaluar / Crear

Los prompts de IA para Logros e Indicadores deben usar los 6 verbos de Bloom completos.

---

## Roadmap — Pendiente

### 🔴 Capa 2 — Tracking de completitud (REQUIERE INFRAESTRUCTURA)
Que el profesor vea quién completó cada SmartBlock interactivo.

**Opción A (simple):** Botón "Enviar resultados" en el modal → estudiante escribe su nombre → POST a un Supabase Edge Function abierto → profesor ve dashboard. Sin cuentas de estudiantes.

**Opción B (robusta):** Cuentas de estudiantes en el sistema → resultados vinculados a identidad. Requiere nuevo rol `student` en `teachers` o tabla `students` nueva.

**Decisión pendiente:** Evaluar si el virtual campus (plataforma del colegio) ya trackea completitud de archivos HTML — en ese caso Capa 2 puede no ser necesaria.

---

### 🟢 Capa 3 — Integración con Virtual Campus (LARGO PLAZO)
Si el colegio usa Moodle u otra plataforma LMS que soporte SCORM/xAPI, exportar paquetes SCORM desde CBF Planner para tracking nativo de la plataforma. Proyecto separado.

---

### 🟡 NEWS: Marco pedagógico Modelo A — pendiente de UX educativa
El modal de NEWS para materias estándar (Matemáticas, Química, Física, Ciencias Naturales, Competencias Ciudadanas, Christian Life, Español, etc.) no tiene ninguna sección explicativa equivalente al marco pedagógico de Modelo B. El docente nuevo no sabe qué es un Logro, una Temática ni un Indicador, ni qué impacto tienen en la IA.
- Crear sección educativa en `NewsProjectEditor` para `news_model === 'standard'`
- Explicar: Logro → Temáticas → Indicadores → cómo la IA los usa
- Mostrar consecuencia dinámica similar al contador de Modelo B

### 🟡 NEWS: Subir imágenes del textbook
En la pestaña Textbook del NEWS, permitir subir fotos/scans del scope & sequence del libro.
- Guardar en Supabase Storage (bucket `guide-images` ya existe)
- La AI puede leerlas para contextualizar contenidos por unidad

### 🟡 Calendario: Flujo de reprogramación asistido por AI (pospuesto)
Cuando un evento con `affects_planning=true` se crea, ofrecer al docente una sugerencia automática de cómo redistribuir las guías afectadas.
