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

`generateGuideStructure` auto-retries with a more concise prompt when the response is truncated (JSON parse failure). It also asks Claude to include an optional `smartBlock` field in `activity` and `skill` sections (max 2 per day).

`suggestSmartBlock` receives `{ sectionMeta, grade, subject, objective, unit, dayName, existingContent, existingBlocks, learningTarget, planId }` and returns `{ type, model, data }` ready to insert. It aligns the suggestion to the learning target's taxonomy level:
- `recognize` → VOCAB matching, QUIZ topic-card, READING true-false
- `apply` → DICTATION, GRAMMAR fill-blank, WORKSHOP stations, READING comprehension
- `produce` → SPEAKING rubric, WORKSHOP roles, EXIT_TICKET can-do

`generateIndicadores()` has 3 modes: **Modelo B** (`isModeloB=true`) → 4 objects `{habilidad, texto_en, texto_es, principio_biblico}`; **Modelo A + tematicaNames** → N strings, one per Temática; **Modelo A fallback** → 3 generic strings. The `getIndText(ind)` helper (exported from `LearningTargetsPage.jsx`) normalizes either format to a display string — use it everywhere indicators may be objects.

`callClaude()` reads the response as text first (`response.text()`), then parses JSON — this prevents cryptic "Unexpected token" errors when the Edge Function returns a non-JSON error message.

### Lesson plan data model

Plans are stored in `lesson_plans.content` as a nested JSONB object:

```
content: {
  header: { school, dane, codigo, version, proceso, logo_url },
  info: { grado, asignatura, semana, periodo, fechas, docente },
  objetivo: { general, indicador, principio },
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
| `src/utils/exportHtml.js` | `exportHtml()`, `exportPdf()`, `buildHtml()` | Imports `blockPreviewHTML` + `BLOCK_TYPES` from SmartBlocks.jsx for block rendering |
| `src/utils/exportDocx.js` | `exportGuideDocx()` | `buildSmartBlockDocx(block)` handles all 9 block types natively |

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

#### Left nav panel
- **El nav abre directamente en `1 · Logro`** — los paneles Encabezado e Información fueron removidos del nav para docentes (son datos de contexto, no de trabajo diario).
- El nav tiene 2 pasos fijos (`1 · Logro`, `2 · Versículo`) + días + `★ Resumen`.
- Day items show a mini progress bar + `filled/total` count (e.g. `3/6`) indicating how many sections have content. Bar turns white when the day is active.

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
| `teachers` | User profiles. `status`, `role`, `school_id`, `default_class/subject/period` |
| `schools` | Multi-tenant root. `features` JSONB, `year_verse`, `logo_url` |
| `teacher_assignments` | Admin-controlled class assignments. `grade` (base only, e.g. `"10.°"`), `section`, `subject`, `schedule` JSONB (keys: `mon/tue/wed/thu/fri`, values: period arrays) |
| `lesson_plans` | One row per guide. `content` JSONB holds all plan data. `grade` = combined label. Links to `target_id`, `news_project_id` |
| `learning_targets` | **Logros del trimestre** (meta macro). `description` = el Logro. `taxonomy` enum: `recognize | apply | produce`. `indicadores jsonb` = array de strings (uno por Temática). `tematica_names jsonb` = array paralelo con el nombre de cada Temática. `trimestre smallint` (1/2/3, nullable). `news_model text` ('standard'\|'language', default 'standard'). |
| `school_monthly_principles` | Principios rectores por mes. `school_id, year, month, month_verse, month_verse_ref, indicator_principle`. UNIQUE(school_id, year, month) |
| `news_projects` | NEWS (project-based learning) projects. Links to `rubric_templates` via `rubric_template_id`. Links to `learning_targets` via `target_id` (UUID). Field `target_indicador` (text) stores the selected indicator from `learning_targets.indicadores[]`. `news_model text` ('standard'\|'language'). Modelo B: `competencias jsonb`, `operadores_intelectuales jsonb`, `habilidades jsonb`. |
| `school_calendar` | Holiday/event data. `is_school_day: false` = holiday |
| `checkpoints` | Records whether a teacher evaluated a learning target at end of week |
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

2. **Feature flags** — toggles por grupo (Comunicación, IA, Editor). Lee y escribe `schools.features` JSONB via `FeaturesContext`.

### Logging

Use `logError(err, { page, action, entityId })` and `logActivity(action, entityType, entityId, description)` from `src/utils/logger.js`. For Supabase calls that might fail, use the `safeAsync()` wrapper which returns `{ data, error }` and auto-logs.

### Checkpoint flow

When a teacher opens `PlannerPage` to create a new guide, the app checks if the **previous week's plan** had a `target_id` but no matching `checkpoints` row. If so, it intercepts with `CheckpointModal` asking the teacher to evaluate the learning target achievement before proceeding.

### Multi-tenancy

Every table uses `school_id` to scope data. The `teacher` object (passed as prop through the entire component tree) carries `school_id` and is the primary source of truth for scoping all queries.

### SPA routing on GitHub Pages

`public/404.html` encodes the path as `/?//path` and redirects to `index.html`. A script in `index.html` restores the real URL via `history.replaceState`. `pathSegmentsToKeep = 1` preserves the `/cbf-planner/` base.

### Modal rules

**No modal should close on outside click.** All modal overlays must NOT have `onClick` on the overlay div. Use `createPortal(…, document.body)` for any modal rendered inside a component that lives inside a clickable parent (e.g. section headers with `onClick` for accordion). The SmartBlocks modal already uses this pattern.

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
Materias en inglés: **Language Arts, Social Studies, Science**
```
COMPETENCIAS (Sociolingüística / Lingüística / Pragmática)
OPERADORES INTELECTUALES (Deducir / Generalizar / Sintetizar / Retener / Evaluar)
  ├── INDICADOR 1 — Speaking
  │     ├── PRINCIPIO BÍBLICO PROPIO (versículo específico del indicador)
  │     ├── ENUNCIADO: inglés + traducción al español
  │     ├── ES EMBEBIDA (proyecto + tamaño de grupo + criterios)
  │     └── ACTIVIDADES ESTÁNDAR (Dictados, Quiz, Cambridge One, Plan Lector, PET Prep)
  ├── INDICADOR 2 — Listening / 3 — Reading / 4 — Writing (misma estructura)
  └── RÚBRICA FINAL (organizada por habilidad)
```

### Estado actual vs. pendiente

| Elemento | Estado | Fase |
|----------|--------|------|
| `learning_targets.description` = Logro | ✅ Correcto | — |
| `learning_targets.indicadores[]` = Indicadores por Temática | ✅ Existe (string[]) | — |
| `learning_targets.tematica_names[]` = Nombres de Temáticas | ✅ Implementado Sprint 1 | — |
| `learning_targets.trimestre` | ✅ Implementado Sprint 1 | — |
| `news_projects.news_model` ('standard'\|'language') | ✅ Implementado Sprint 1 | — |
| `news_projects.competencias/operadores/habilidades` (Modelo B) | ✅ Implementado Sprint 1 | — |
| Indicadores Modelo B como objetos `{habilidad, texto_en, texto_es, principio_biblico, es_embebida}` | ✅ Implementado Sprint 2 | — |
| `generateRubric()` → exactamente 8 criterios (prompt + validación) | ✅ Implementado Sprint 1 | — |
| `MODELO_B_SUBJECTS` en constants.js | ✅ Implementado Sprint 1 | — |

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

### 🟡 NEWS: Subir imágenes del textbook
En la pestaña Textbook del NEWS, permitir subir fotos/scans del scope & sequence del libro.
- Guardar en Supabase Storage (bucket `guide-images` ya existe)
- La AI puede leerlas para contextualizar contenidos por unidad

---

### ✅ Modelo Pedagógico — Sprint 1 (COMPLETADO)
Implementación de la estructura Modelo A + Modelo B según el Marco Teórico.

**Migraciones aplicadas** (`supabase/migrations/20260403_fase2_modelo_b.sql`):
- `learning_targets`: `trimestre smallint`, `tematica_names jsonb[]`, `news_model text`
- `news_projects`: `news_model text`, `competencias jsonb[]`, `operadores_intelectuales jsonb[]`, `habilidades jsonb[]`

**UI implementada:**
- `LearningTargetsPage`: Temáticas + Indicadores en pares; badge Modelo B; selector Trimestre
- `NewsProjectEditor`: sección "Modelo B — Lengua" con toggles de Competencias, Operadores, Habilidades; auto-detecta `news_model` desde el subject

**IA + constantes:**
- `generateRubric()`: exactamente 8 criterios × 5 niveles (prompt forzado + validación post-parse)
- `MODELO_B_SUBJECTS = ['Language Arts', 'Social Studies', 'Science']` en constants.js

**Sprint 2 completado:**
- Indicadores Modelo B: objetos `{habilidad, texto_en, texto_es, principio_biblico, es_titulo, es_descripcion, es_grupo}`
- `generateIndicadores()`: Modelo A = 1 por Temática | Modelo B = 4 objetos por habilidad
- `LearningTargetSelector`: badge T1/T2/T3, ordena targets del trimestre actual primero
- `getIndText(ind)` helper exportado desde LearningTargetsPage para normalizar string|objeto

---

## Roadmap futuro (Sprints 2–7)

### Sprint 2 — Roles y estructura
- **Superusuario** (`superadmin`): bypass total de RLS, solo asignable por otro superusuario
- **Coordinador**: gestión académica completa por nivel (reemplaza rol `admin` actual)
- **Director de grupo**: vista de su grado/sección, recibe agenda semanal consolidada
- **Psicopedagoga**: crear eventos institucionales que impactan planificaciones
- Migrar `teachers.role` a sistema multi-rol. Agregar campo `level` (elementary/middle/high)

### Sprint 3 — Calendario institucional
- Mejorar `school_calendar`: agregar `level`, `affects_planning`, `event_type`, `created_by`
- Eventos por nivel (Elementary / Middle / High)
- Notificación en cascada a docentes cuando un evento afecta sus guías
- Flujo de reprogramación asistido por AI

### Sprint 4 — Constructor de horarios
- Tabla `schedule_blocks` con validación de solapamiento
- Vista de grilla por grado/sección y por profesor
- Campo `classroom` para detectar conflictos de espacio

### Sprint 5 — Agenda semanal automática
- Cada jueves: consolidar guías de todos los docentes de un grado/sección
- El director de grupo recibe agenda lista para enviar a padres
- Tabla `weekly_agendas` con campo `devotional` y `notes`

### Sprint 6 — AI avanzado
- Consumo de tokens por docente con límites configurables por coordinador
- Importar guías .docx existentes (AI parsea y mapea al sistema)
- Malla curricular integrada: tracking de cobertura por período

### Sprint 7 — Responsive / PWA
- Mobile-first para NewsPage, GuideEditor y Agenda
- Evaluar PWA para uso offline básico
