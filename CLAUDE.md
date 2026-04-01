# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Architecture

**Stack:** React 18 + Vite 5 SPA → GitHub Pages (`/cbf-planner/`). Supabase for auth, PostgreSQL, and Edge Functions.

### Auth & routing (`App.jsx`)

`App.jsx` is a state machine: `session === undefined` = loading, `null` = no session, object = logged in. After login, it fetches `teachers.*, schools(*)` and gates routing by `teacher.status` (`pending` | `approved` | `rejected`) and `teacher.role` (`teacher` | `admin`). The whole authenticated experience lives under `DashboardPage`.

### Context providers (mounted in `DashboardPage`)

- **`FeaturesContext`** — loads `schools.features` (JSONB) once per session and exposes per-school feature flags. Default flags are in `FeaturesContext.jsx`. Use `useFeatures()` to gate UI; use `updateFeature(key, value)` to persist changes (admin only).
- **`ToastContext`** — global toast notifications. Use `const { showToast } = useToast()`. Signature: `showToast(message, type?, duration?)`. Types: `'success' | 'error' | 'info' | 'warning'`.

### AI integration

All AI calls go through a **Supabase Edge Function** (`supabase/functions/claude-proxy/index.ts`) that proxies to `claude-sonnet-4-20250514`. The API key never touches the client. The Edge Function uses `body.max_tokens` directly — there is no type-based switch, so new AI functions only need a new export in `AIAssistant.js`.

Client-side entry point is `src/utils/AIAssistant.js`, which exposes:

| Function | Purpose | `maxTokens` |
|---|---|---|
| `suggestSectionActivity()` | Suggest HTML content for a single guide section | 2000 |
| `analyzeGuide()` | Pedagogical analysis of a complete guide | 4000 |
| `generateGuideStructure()` | Generate full week structure as JSON (includes SmartBlocks) | 16000 |
| `suggestSmartBlock()` | Suggest one SmartBlock for a section based on context + taxonomy | 1200 |

`generateGuideStructure` auto-retries with a more concise prompt when the response is truncated (JSON parse failure). It also asks Claude to include an optional `smartBlock` field in `activity` and `skill` sections (max 2 per day).

`suggestSmartBlock` receives `{ sectionMeta, grade, subject, objective, unit, dayName, existingContent, existingBlocks, learningTarget, planId }` and returns `{ type, model, data }` ready to insert. It aligns the suggestion to the learning target's taxonomy level:
- `recognize` → VOCAB matching, QUIZ topic-card, READING true-false
- `apply` → DICTATION, GRAMMAR fill-blank, WORKSHOP stations, READING comprehension
- `produce` → SPEAKING rubric, WORKSHOP roles, EXIT_TICKET can-do

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

`SmartBlocksList` accepts an `aiContext` prop `{ sectionMeta, grade, subject, objective, unit, dayName, existingContent, learningTarget }` which enables the "✨ Sugerir con IA" button. When `aiContext` is absent the button is hidden.

All modals in SmartBlocks use `createPortal(…, document.body)` to prevent click-outside-closes-modal bugs caused by DOM ancestor event bubbling.

### Image layout system

Each section can have up to 4 images in `section.images[]` (uploaded via `ImageUploader`, compressed to max 900px / JPEG 0.82). Position is controlled by `section.image_layout: 'below' | 'right' | 'left'` (set via `LayoutSelectorModal`).

- `below` — images in a grid below the text (1→full-width, 2→2col, 3→3col, 4→2×2)
- `right` / `left` — text + images side by side in a table/flex layout

Old field `layout_mode: 'stack' | 'side'` is normalized everywhere to the new values. Both `exportHtml.js` and `exportDocx.js` read `image_layout` and fall back gracefully.

DOCX day tables use **3 columns** `[1760, 5605, 3435]` DXA. Header and unit rows use `span: 3`. Section rows are either 2-col (below layout, `span: 2` on content) or 3-col (right/left layout, separate text and image cells).

### Export system

| File | Function | Notes |
|---|---|---|
| `src/utils/exportHtml.js` | `exportHtml()`, `exportPdf()`, `buildHtml()` | Imports `blockPreviewHTML` + `BLOCK_TYPES` from SmartBlocks.jsx for block rendering |
| `src/utils/exportDocx.js` | `exportGuideDocx()` | `buildSmartBlockDocx(block)` handles all 9 block types natively |

Both exports render: text content, images (with layout), videos (HTML only — iframes), and SmartBlocks. SmartBlocks appear after video content, each with a colored type-header strip.

### Key Supabase tables

| Table | Purpose |
|---|---|
| `teachers` | User profiles. `status`, `role`, `school_id`, `default_class/subject/period` |
| `schools` | Multi-tenant root. `features` JSONB, `year_verse`, `logo_url` |
| `teacher_assignments` | Admin-controlled class assignments. `grade` (base only, e.g. `"10.°"`), `section`, `subject`, `schedule` JSONB (keys: `mon/tue/wed/thu/fri`, values: period arrays) |
| `lesson_plans` | One row per guide. `content` JSONB holds all plan data. `grade` = combined label. Links to `target_id`, `news_project_id` |
| `learning_targets` | Desempeños observables. `taxonomy` enum: `recognize | apply | produce`. Matched to plans by `school_id + subject + grade` |
| `news_projects` | NEWS (project-based learning) projects. Links to `rubric_templates` |
| `school_calendar` | Holiday/event data. `is_school_day: false` = holiday |
| `checkpoints` | Records whether a teacher evaluated a learning target at end of week |
| `notifications` / `messages` | In-app communication. Polled every 60s in `DashboardPage` |
| `error_log` / `activity_log` | Observability. Written by `src/utils/logger.js` |

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
