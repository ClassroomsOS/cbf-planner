// ── blockSchema.js ────────────────────────────────────────────────────────────
// Typed block system for CBF Guide Experience Engine (GXE).
//
// Philosophy:
//   A guide is not a document — it is an executable instruction program.
//   Each block carries:
//     • `data`    — the instructional content
//     • `display` — how ClassroomOS renders it (presentation metadata)
//     • `print`   — how exportDocx renders it (printable layer)
//
// Block types form a vocabulary for instructional design. Teachers don't write
// free-form text — they compose blocks of known pedagogical purpose.
//
// Backward compatibility:
//   Sections without `blocks` fall back to `content` (HTML string).
//   Migration is gradual: editing a legacy section converts it to blocks.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'

// ── Block type registry ───────────────────────────────────────────────────────
// Single source of truth for all block type identifiers.
export const BLOCK_TYPES = /** @type {const} */ ({
  // Content blocks (authoring atoms)
  EXPLANATION:   'explanation',   // Teacher explains a concept
  PROCEDURE:     'procedure',     // Step-by-step student procedure
  VOCAB:         'vocab',         // Vocabulary term(s) with definition + example
  MODEL:         'model',         // Example/model for students to observe
  IMAGE:         'image',         // Image with optional annotations
  QUESTION:      'question',      // Guiding question for discussion or reflection
  TEACHER_NOTE:  'teacher-note',  // Private instruction (not projected to students)
  MEDIA:         'media',         // Video or audio with cue points
  SCAFFOLD:      'scaffold',      // I DO → WE DO → YOU DO container
  PATTERN:       'pattern',       // Activity pattern instance (Information Gap, Jigsaw…)
  RICH_TEXT:     'rich-text',     // Free-form TipTap HTML (fallback / legacy)
  // Momento-specific blocks
  EXIT_TICKET:   'exit-ticket',   // Closing: quick comprehension check
  HOMEWORK:      'homework',      // Assignment: task + platform + parent note
  // Interactive (existing SmartBlocks — preserved for compatibility)
  SMART_BLOCK:   'smart-block',   // References a SmartBlock by id
})

// ── Display hint constants ────────────────────────────────────────────────────
export const EMPHASIS = /** @type {const} */ ({
  LOW:    'low',
  NORMAL: 'normal',
  HIGH:   'high',
})

export const REVEAL_MODE = /** @type {const} */ ({
  ALL_AT_ONCE:    'all-at-once',
  STEP_BY_STEP:   'step-by-step',
  ON_TAP:         'on-tap',
})

export const SCAFFOLD_PHASE = /** @type {const} */ ({
  I_DO:   'i-do',
  WE_DO:  'we-do',
  YOU_DO: 'you-do',
})

// ── Action icons (used in procedure steps) ───────────────────────────────────
// ClassroomOS maps these to rendered icons (headphones, pencil, etc.)
export const STEP_ACTIONS = /** @type {const} */ ([
  'listen',   // 🎧 Listen to audio / teacher
  'read',     // 📖 Read text or instructions
  'write',    // ✏️ Write in notebook / worksheet
  'speak',    // 🎤 Say / discuss out loud
  'observe',  // 👁️ Look at image / board / screen
  'think',    // 💭 Reflect / brainstorm individually
  'do',       // 🛠️ Complete a physical or digital task
  'check',    // ✅ Verify / self-correct
])

// ── Base display schema (shared by all block types) ──────────────────────────
const displaySchema = z.object({
  emphasis:    z.enum([EMPHASIS.LOW, EMPHASIS.NORMAL, EMPHASIS.HIGH]).default(EMPHASIS.NORMAL),
  reveal:      z.enum([REVEAL_MODE.ALL_AT_ONCE, REVEAL_MODE.STEP_BY_STEP, REVEAL_MODE.ON_TAP])
                 .default(REVEAL_MODE.ALL_AT_ONCE),
  timing:      z.string().optional(),   // e.g. "5 min"
  fullscreen:  z.boolean().default(false),
  hideInPrint: z.boolean().default(false),
}).default({})

// ── Block-specific data schemas ───────────────────────────────────────────────

const explanationDataSchema = z.object({
  text:           z.string().min(1),
  grammarTarget:  z.string().optional(),   // e.g. "past tense -ed ending"
  highlightTerms: z.array(z.string()).default([]),
})

const procedureStepSchema = z.object({
  action: z.enum(STEP_ACTIONS).default('do'),
  text:   z.string().min(1),
  note:   z.string().optional(),   // Teacher tip for this specific step
})

const procedureDataSchema = z.object({
  steps:   z.array(procedureStepSchema).min(1),
  context: z.string().optional(),   // Brief framing sentence shown before steps
})

const vocabTermSchema = z.object({
  word:          z.string().min(1),
  definition:    z.string().min(1),
  example:       z.string().optional(),
  imageUrl:      z.string().url().optional(),
  pronunciation: z.string().optional(),
})

const vocabDataSchema = z.object({
  terms:   z.array(vocabTermSchema).min(1),
  heading: z.string().optional(),
})

const modelDataSchema = z.object({
  text:          z.string().min(1),
  label:         z.string().default('Model'),    // Badge text shown in ClassroomOS
  grammarTarget: z.string().optional(),
  source:        z.string().optional(),           // Attribution if from a book/text
})

const annotationSchema = z.object({
  id:    z.string(),
  type:  z.enum(['label', 'arrow', 'zone', 'number']),
  x:     z.number().min(0).max(100),  // % of image width
  y:     z.number().min(0).max(100),  // % of image height
  text:  z.string(),
  color: z.string().default('#2563eb'),
})

const imageDataSchema = z.object({
  url:         z.string().url(),
  path:        z.string().optional(),
  caption:     z.string().optional(),
  annotations: z.array(annotationSchema).default([]),
  link:        z.string().url().optional(),
})

const questionDataSchema = z.object({
  text:     z.string().min(1),
  subtype:  z.enum(['discussion', 'think-pair-share', 'individual', 'rhetorical'])
              .default('discussion'),
  guidance: z.string().optional(),   // Teacher note: what a good answer looks like
})

const teacherNoteDataSchema = z.object({
  text:     z.string().min(1),
  priority: z.enum(['normal', 'important', 'warning']).default('normal'),
})

const cuePointSchema = z.object({
  timeSeconds: z.number().min(0),
  label:       z.string(),
  action:      z.string().optional(),   // What the teacher should do at this cue
})

const mediaDataSchema = z.object({
  url:        z.string().min(1),
  mediaType:  z.enum(['video', 'audio']),
  label:      z.string().optional(),
  cuePoints:  z.array(cuePointSchema).default([]),
  purpose:    z.string().optional(),   // "Pre-listening task", "Model text", etc.
})

// Scaffold (container for I DO / WE DO / YOU DO)
const scaffoldPhaseSchema = z.object({
  phase:       z.enum([SCAFFOLD_PHASE.I_DO, SCAFFOLD_PHASE.WE_DO, SCAFFOLD_PHASE.YOU_DO]),
  label:       z.object({ es: z.string(), en: z.string() }).optional(),
  blocks:      z.array(z.any()).default([]),   // Nested blocks — validated recursively
})

const scaffoldDataSchema = z.object({
  phases: z.array(scaffoldPhaseSchema).min(1).max(3),
})

// Pattern block — an activity pattern instance
const patternDataSchema = z.object({
  patternId:  z.string().min(1),     // Reference to activityPatterns.js
  context:    z.string().optional(), // Lesson context / framing for the activity
  inputs:     z.record(z.any()),     // Pattern-specific inputs (validated by activityPatterns.js)
  duration:   z.number().int().positive().optional(),   // Minutes
})

const richTextDataSchema = z.object({
  html: z.string(),   // TipTap-generated HTML — intentionally unvalidated
})

// Exit ticket — quick comprehension check at the end of class
const exitTicketDataSchema = z.object({
  question:      z.string().min(1),
  responseType:  z.enum(['written', 'thumbs', 'scale', 'quick-choice']).default('written'),
  options:       z.array(z.string()).default([]),   // For 'quick-choice' type
  collectMethod: z.enum(['notebook', 'platform', 'verbal', 'whiteboard']).default('notebook'),
})

// Homework — concrete, achievable assignment
const homeworkDataSchema = z.object({
  instruction:   z.string().min(1),
  platform:      z.string().optional(),    // "Google Classroom", "Raz-Kids", etc.
  platformUrl:   z.string().optional(),    // Validated at form level, permissive here
  timeEstimate:  z.number().int().positive().optional(),
  dueLabel:      z.string().optional(),    // "Para mañana", "Viernes 23 mayo", etc.
  parentNote:    z.string().optional(),    // Shown in weekly parent report
})

const smartBlockRefSchema = z.object({
  smartBlockId: z.coerce.string().min(1),
})

// ── Block type → data schema mapping ─────────────────────────────────────────
const DATA_SCHEMAS = {
  [BLOCK_TYPES.EXPLANATION]:  explanationDataSchema,
  [BLOCK_TYPES.PROCEDURE]:    procedureDataSchema,
  [BLOCK_TYPES.VOCAB]:        vocabDataSchema,
  [BLOCK_TYPES.MODEL]:        modelDataSchema,
  [BLOCK_TYPES.IMAGE]:        imageDataSchema,
  [BLOCK_TYPES.QUESTION]:     questionDataSchema,
  [BLOCK_TYPES.TEACHER_NOTE]: teacherNoteDataSchema,
  [BLOCK_TYPES.MEDIA]:        mediaDataSchema,
  [BLOCK_TYPES.SCAFFOLD]:     scaffoldDataSchema,
  [BLOCK_TYPES.PATTERN]:      patternDataSchema,
  [BLOCK_TYPES.RICH_TEXT]:    richTextDataSchema,
  [BLOCK_TYPES.EXIT_TICKET]:  exitTicketDataSchema,
  [BLOCK_TYPES.HOMEWORK]:     homeworkDataSchema,
  [BLOCK_TYPES.SMART_BLOCK]:  smartBlockRefSchema,
}

// ── Block print layout options per type ──────────────────────────────────────
// Tells exportDocx.js how to render each block type.
export const PRINT_LAYOUTS = /** @type {const} */ ({
  explanation:   ['paragraph', 'callout'],
  procedure:     ['numbered-list', 'timeline-table'],
  vocab:         ['table-3col', 'table-2col'],
  model:         ['blockquote', 'framed-box'],
  image:         ['inline', 'full-width'],
  question:      ['bold-italic', 'callout'],
  'teacher-note': ['gray-italic', 'hidden'],
  media:         ['link', 'qr-code'],
  scaffold:      ['sections-with-headers', 'table-3col'],
  pattern:       ['instructions-table', 'student-handout'],
  'rich-text':   ['html-passthrough'],
  'exit-ticket': ['callout', 'gray-italic'],
  'homework':    ['callout', 'paragraph'],
  'smart-block': ['exercise-table'],
})

// ── Block schema (full, with id, type, data, display, print) ─────────────────
export const blockSchema = z.object({
  id:      z.string().min(1),
  type:    z.enum(Object.values(BLOCK_TYPES)),
  data:    z.record(z.any()),   // Validated per-type by DATA_SCHEMAS
  display: displaySchema,
  print:   z.object({
    layout:      z.string().optional(),
    hideInPrint: z.boolean().default(false),
  }).default({}),
})

// ── Factory: create a new block ──────────────────────────────────────────────
/**
 * Creates a well-formed block object ready to be stored in a section's `blocks` array.
 *
 * @param {string} type         - One of BLOCK_TYPES values
 * @param {object} data         - Block-specific data (validated against DATA_SCHEMAS[type])
 * @param {object} [display]    - Optional display overrides
 * @param {object} [print]      - Optional print overrides
 * @returns {{ id, type, data, display, print }}
 * @throws {Error} if type is unknown or data fails schema validation
 */
export function createBlock(type, data, display = {}, print = {}) {
  if (!DATA_SCHEMAS[type]) {
    throw new Error(`Unknown block type: "${type}". Valid types: ${Object.values(BLOCK_TYPES).join(', ')}`)
  }

  const validatedData = DATA_SCHEMAS[type].parse(data)
  const validatedDisplay = displaySchema.parse(display)

  return {
    id:      crypto.randomUUID(),
    type,
    data:    validatedData,
    display: validatedDisplay,
    print:   { layout: PRINT_LAYOUTS[type]?.[0] ?? null, hideInPrint: false, ...print },
  }
}

// ── Validator: validate an existing block (e.g., loaded from DB) ─────────────
/**
 * Validates a block object. Returns { ok: true, block } or { ok: false, error }.
 * Used to detect stale/corrupt data before rendering.
 */
export function validateBlock(block) {
  const baseResult = blockSchema.safeParse(block)
  if (!baseResult.success) {
    return { ok: false, error: baseResult.error.issues }
  }
  const dataSchema = DATA_SCHEMAS[block.type]
  if (!dataSchema) {
    return { ok: false, error: `Unknown block type: "${block.type}"` }
  }
  const dataResult = dataSchema.safeParse(block.data)
  if (!dataResult.success) {
    return { ok: false, error: dataResult.error.issues }
  }
  return { ok: true, block: baseResult.data }
}

// ── Helper: detect if a section uses the new block system ────────────────────
/**
 * Returns true if the section has been authored with the new block system.
 * Returns false if it only has legacy `content` HTML (backward compat).
 */
export function sectionHasBlocks(section) {
  return Array.isArray(section?.blocks) && section.blocks.length > 0
}

// ── Helper: build an empty scaffold block (I DO / WE DO / YOU DO) ────────────
export function createScaffoldBlock(display = {}) {
  return createBlock(
    BLOCK_TYPES.SCAFFOLD,
    {
      phases: [
        { phase: SCAFFOLD_PHASE.I_DO,   blocks: [] },
        { phase: SCAFFOLD_PHASE.WE_DO,  blocks: [] },
        { phase: SCAFFOLD_PHASE.YOU_DO, blocks: [] },
      ],
    },
    { emphasis: EMPHASIS.NORMAL, ...display }
  )
}

// ── Helper: extract all blocks flat (including nested inside scaffolds) ───────
/**
 * Returns a flat array of all blocks in a section, recursing into scaffold phases.
 * Useful for analytics and search.
 */
export function flattenBlocks(blocks = []) {
  return blocks.flatMap(block => {
    if (block.type !== BLOCK_TYPES.SCAFFOLD) return [block]
    const nested = (block.data?.phases ?? []).flatMap(p => flattenBlocks(p.blocks ?? []))
    return [block, ...nested]
  })
}
