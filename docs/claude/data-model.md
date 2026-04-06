# Data Model

## Lesson plan content JSONB

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

## SmartBlocks

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

`blockInteractiveHTML(block, blockId)` generates a self-contained `<button>` + native `<dialog>` + `<script>` for the exported HTML. Returns `null` for read-only block types. Called from `sectionContent()` in `exportHtml.js`. The launch button is hidden in `@media print`.

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

All modals in SmartBlocks use `createPortal(…, document.body)` to prevent click-outside-closes-modal bugs.

## Image layout system

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

## Export system

| File | Function | Notes |
|---|---|---|
| `src/utils/exportHtml.js` | `exportHtml(content, newsProject?)`, `exportPdf(content, newsProject?)`, `buildHtml(content, newsProject?)` | Imports `blockPreviewHTML` + `BLOCK_TYPES` from SmartBlocks.jsx. Tabla indicadores: **full-width una columna**. Objetos Modelo B normalizados. Bloque `📋 Proyecto NEWS` entre indicadores y versículo. |
| `src/utils/exportDocx.js` | `exportGuideDocx()` | `buildSmartBlockDocx(block)` handles all 9 block types. Tabla indicadores: **full-width una columna**, header `INDICADORES DE LOGRO`. Solo renderiza si hay indicadores. |
| `src/utils/exportRubricHtml.js` | `exportRubricHtml(project, principles, school)` | HTML interactivo para evaluar proyectos NEWS. Clickear celda → calcula nota (1.0–5.0 Boston Flex). Abre en `window.open('', '_blank')`. |

Both exports render: text content, images (with layout), videos (HTML only — iframes), and SmartBlocks.

**HTML export specifics:**
- `verse.text` is rendered as raw HTML (not escaped) since it comes from RichEditor
- Each section `<tr>` has `break-inside: avoid; page-break-inside: avoid` for clean PDF printing
- Each day block has class `day-block`; consecutive days force a page break (`break-before: page`)
- The exported HTML includes a **floating red "🖨️ Guardar como PDF" button** (`.pdf-fab`) that calls `window.print()` — hidden in `@media print`.
- `exportPdf()` opens a new window, writes the HTML, and calls `window.print()` after 900ms.

**DOCX export specifics:**
- All section `TableRow`s have `cantSplit: true` — Word will not split a section row across pages

## Key Supabase tables

| Table | Purpose |
|---|---|
| `teachers` | User profiles. `status`, `role`, `school_id`, `default_class/subject/period`, `ai_monthly_limit int` (0=ilimitado) |
| `schools` | Multi-tenant root. `features` JSONB, `year_verse`, `logo_url`, `document_code`, `doc_version`, `dane`, `resolution`, `process_name` |
| `teacher_assignments` | Admin-controlled class assignments. `grade` (base only, e.g. `"10.°"`), `section`, `subject`, `schedule` JSONB (keys: `mon/tue/wed/thu/fri`, values: period arrays), `classroom text` |
| `lesson_plans` | One row per guide. `content` JSONB holds all plan data. `grade` = combined label. Links to `target_id`, `news_project_id`. `week_count int` (1 or 2). |
| `learning_targets` | **Logros del trimestre** (meta macro). `description` = el Logro (Modelo A only). `taxonomy` enum: `recognize | apply | produce`. `indicadores jsonb` = array of strings (Modelo A) or objects `{habilidad, taxonomy, texto_en, principio_biblico: {titulo, referencia, cita}, es_titulo, es_descripcion, es_grupo}` (Modelo B). `tematica_names jsonb`. `news_model text` ('standard'\|'language'). |
| `school_monthly_principles` | Principios rectores por mes. `school_id, year, month, month_verse, month_verse_ref, indicator_principle`. UNIQUE(school_id, year, month) |
| `news_projects` | NEWS projects. Links to `learning_targets` via `target_id`. `target_indicador` (text) stores the selected indicator. `news_model text` ('standard'\|'language'). Modelo B: `competencias jsonb`, `operadores_intelectuales jsonb`, `habilidades jsonb`, `actividades_evaluativas jsonb` (array de `{nombre, descripcion, porcentaje, fecha: 'YYYY-MM-DD'}`). |
| `school_calendar` | Holiday/event data. `is_school_day: false` = holiday. `level` (elementary|middle|high|NULL). `affects_planning boolean`. |
| `checkpoints` | Records whether a teacher evaluated a learning target at end of week |
| `weekly_agendas` | Agenda semanal por grado/sección. `grade`, `section`, `week_start date`, `content jsonb`, `status` (draft/ready/sent) |
| `schedule_slots` | Franjas del horario institucional. `school_id`, `name`, `start_time`, `end_time`, `level`, `color text`. |
| `notifications` / `messages` | In-app communication. Event-driven via Realtime. |
| `error_log` / `activity_log` | Observability. Written by `src/utils/logger.js` |
