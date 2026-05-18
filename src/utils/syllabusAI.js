/**
 * syllabusAI.js
 * IA para distribución curricular del syllabus.
 * Toma la malla de unidades + slots recurrentes + semanas hábiles
 * y devuelve un cronograma día a día para todo el período.
 */
import { callClaude } from './aiClient'
import { sanitizeAIInput } from './validationSchemas'
import { getMondayOf, toISO, getWeekDays } from './dateUtils'

const DAY_LABELS = { mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes' }
const DAY_KEYS   = ['mon', 'tue', 'wed', 'thu', 'fri']

/**
 * Calcula las semanas hábiles de un período dado su start_date y end_date,
 * excluyendo las fechas sin clase de school_calendar.
 *
 * @param {string} startISO   - YYYY-MM-DD inicio del período
 * @param {string} endISO     - YYYY-MM-DD fin del período
 * @param {string[]} noClassDates - ISO dates que son no_class
 * @returns {Array<{week: number, days: string[]}>}
 *   week = número per-período (1-based), days = ISO dates de días hábiles
 */
export function computeWorkingWeeks(startISO, endISO, noClassDates = []) {
  const noClass = new Set(noClassDates)
  const start = getMondayOf(new Date(startISO + 'T12:00:00'))
  const end   = new Date(endISO + 'T23:59:59')

  const weeks = []
  let current = new Date(start)
  let weekNum = 1

  while (current <= end) {
    const days = getWeekDays(current)
      .map(d => toISO(d))
      .filter(iso => {
        const d = new Date(iso + 'T12:00:00')
        return d >= new Date(startISO + 'T00:00:00') && d <= end && !noClass.has(iso)
      })

    if (days.length > 0) {
      weeks.push({ week: weekNum, days })
      weekNum++
    }

    // Avanzar al siguiente lunes
    current = new Date(current)
    current.setDate(current.getDate() + 7)
  }

  return weeks
}

/**
 * Genera la distribución curricular con IA.
 *
 * @param {object} params
 * @param {string} params.subject
 * @param {string} params.grade
 * @param {number} params.period
 * @param {number} params.units_target        - cuántas unidades cubrir este período
 * @param {Array}  params.units               - [{number, title, description, estimated_weeks, topics:[...]}]
 * @param {Array}  params.recurring_slots     - [{day, type, label}]
 * @param {Array}  params.working_weeks       - de computeWorkingWeeks()
 * @param {string} [params.library_text]      - texto extraído de la malla (opcional)
 *
 * @returns {Promise<{distribution: Array, error: string|null}>}
 *   distribution = [{week:1, days:{mon:{unit,topic,content_type,description}, ...}}, ...]
 */
export async function distributeSyllabusAI({
  subject, grade, period,
  units_target,
  units = [],
  recurring_slots = [],
  working_weeks = [],
  library_text = '',
}) {
  const isEnglish = ['Language Arts', 'English'].includes(subject)

  // ── Construir contexto de unidades ──────────────────────────────────────────
  const unitsBlock = units.slice(0, units_target).map(u => {
    const topics = (u.topics || [])
      .map(t => `      - [${t.content_type || 'concept'}] ${sanitizeAIInput(t.title || '')}` +
                (t.estimated_classes ? ` (≈${t.estimated_classes} clases)` : '') +
                (t.description ? `\n        ${sanitizeAIInput(t.description).slice(0, 120)}` : ''))
      .join('\n')
    return `  Unidad ${u.number}: ${sanitizeAIInput(u.title || '')}\n` +
           (u.description ? `    ${sanitizeAIInput(u.description).slice(0, 150)}\n` : '') +
           (u.estimated_weeks ? `    Semanas estimadas: ${u.estimated_weeks}\n` : '') +
           (topics ? `    Temas:\n${topics}` : '')
  }).join('\n\n')

  // ── Construir contexto de slots fijos ────────────────────────────────────────
  const slotsBlock = recurring_slots.length
    ? recurring_slots.map(s =>
        `  - ${DAY_LABELS[s.day] || s.day}: ${s.label || s.type} (${s.type})`
      ).join('\n')
    : '  (ninguno)'

  // ── Construir listado de semanas disponibles ─────────────────────────────────
  const weeksBlock = working_weeks.map(w =>
    `  Semana ${w.week}: ${w.days.length} día(s) hábil(es) [${w.days.join(', ')}]`
  ).join('\n')

  // ── Slots fijos como set para referencia rápida ──────────────────────────────
  const fixedSlotsByDay = {}
  recurring_slots.forEach(s => { fixedSlotsByDay[s.day] = s })

  const prompt = `Eres un experto en planificación curricular de la metodología Boston Flex (enfoque constructivista cristiano).

Tu tarea: distribuir los temas de la malla curricular entre las semanas hábiles del período, generando un cronograma día a día.

MATERIA: ${sanitizeAIInput(subject)}
GRADO: ${sanitizeAIInput(grade)}
PERÍODO: ${period}
UNIDADES A CUBRIR ESTE PERÍODO: ${units_target}

═══ MALLA CURRICULAR ════════════════════════════════════════
${unitsBlock}

${library_text ? `TEXTO ADICIONAL DE LA MALLA:\n${sanitizeAIInput(library_text).slice(0, 1500)}\n` : ''}
═══ ACTIVIDADES FIJAS (recurring slots) ════════════════════
Estos días de la semana están reservados para actividades recurrentes.
Inclúyelas en la distribución pero conéctalas al tema de la unidad en curso:
${slotsBlock}

═══ SEMANAS HÁBILES DEL PERÍODO ═══════════════════════════
${weeksBlock}
Total: ${working_weeks.length} semana(s)

═══ INSTRUCCIONES ══════════════════════════════════════════
1. Distribuye los temas de forma PROGRESIVA: introducción → práctica → producción.
2. Para cada día, asigna UN tema principal con su tipo de contenido.
3. Los días con slot fijo (reading, skill, etc.) mantienen ese tipo pero se vinculan al tema de la unidad en curso.
4. Asegura cobertura completa de las ${units_target} unidades seleccionadas.
5. Si hay días sobrantes al final, úsalos para repaso y evaluación formativa.
6. NO dejes días vacíos sin justificación.
7. Máximo 2-3 días por subtema — no repitas exactamente el mismo topic más de 3 veces.
8. ${isEnglish ? 'Usa inglés para los títulos de temas.' : 'Usa español para los títulos de temas.'}

RESPONDE ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin \`\`\`:
{
  "distribution": [
    {
      "week": 1,
      "days": {
        "mon": {
          "unit": 1,
          "topic": "título del tema",
          "content_type": "grammar|vocabulary|skill|reading|value|concept|review",
          "type": "normal|reading|skill|vocab_review|project|review",
          "description": "descripción breve de qué trabajar en esta clase (máx 80 palabras)"
        },
        "tue": { ... },
        "wed": { ... },
        "thu": { ... },
        "fri": { ... }
      }
    },
    ...
  ]
}

Incluye solo los días que aparecen en las semanas hábiles. Omite días de la semana que no tienen clase.`

  try {
    const raw = await callClaude({
      type:      'syllabus_distribute',
      system:    'Eres un planificador curricular experto. Respondes SOLO con JSON válido, sin markdown ni explicaciones.',
      message:   prompt,
      maxTokens: 8000,
    })

    const text = (raw || '').trim()
    const jsonStr = text.startsWith('{') ? text : text.match(/\{[\s\S]*\}/)?.[0] || ''
    if (!jsonStr) return { distribution: [], error: 'La IA no devolvió un JSON válido' }

    const parsed = JSON.parse(jsonStr)
    if (!Array.isArray(parsed.distribution)) return { distribution: [], error: 'Formato de distribución incorrecto' }

    return { distribution: parsed.distribution, error: null }
  } catch (err) {
    console.error('[syllabusAI] Error:', err)
    return { distribution: [], error: err.message || 'Error al generar distribución' }
  }
}

/**
 * Parsea el texto de una malla curricular (PDF extraído) con IA,
 * devolviendo unidades + temas estructurados.
 *
 * @param {string} text - texto extraído del PDF de la malla
 * @param {string} subject
 * @param {string} grade
 * @returns {Promise<{units: Array, error: string|null}>}
 */
export async function parseCurriculumAI({ text, subject, grade }) {
  const prompt = `Analiza este texto de una malla curricular de "${subject}" para "${grade}".
Extrae las unidades didácticas con sus temas, tipos de contenido y estimación de clases.

TEXTO DE LA MALLA:
${sanitizeAIInput(text).slice(0, 4000)}

Responde SOLO con JSON válido:
{
  "units": [
    {
      "number": 1,
      "title": "nombre de la unidad",
      "description": "descripción breve",
      "estimated_weeks": 3,
      "topics": [
        {
          "title": "nombre del tema",
          "content_type": "grammar|vocabulary|skill|reading|value|concept",
          "estimated_classes": 2,
          "description": "qué se trabaja en este tema"
        }
      ]
    }
  ]
}`

  try {
    const raw = await callClaude({
      type:      'syllabus_parse',
      system:    'Eres un experto en análisis curricular. Respondes SOLO con JSON válido.',
      message:   prompt,
      maxTokens: 4000,
    })
    const text2 = (raw || '').trim()
    const jsonStr = text2.startsWith('{') ? text2 : text2.match(/\{[\s\S]*\}/)?.[0] || ''
    if (!jsonStr) return { units: [], error: 'No se pudo parsear la malla' }
    const parsed = JSON.parse(jsonStr)
    return { units: parsed.units || [], error: null }
  } catch (err) {
    return { units: [], error: err.message }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE-LEVEL SYLLABUS — Vision + Distribution + Advisor
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Deep analysis of textbook pages using Claude Vision.
 * Extracts grammar points, vocabulary, exercise types, prerequisites and teaching challenges
 * in addition to the standard page classification.
 *
 * This replaces analyzeBookPages in the new 5-phase wizard.
 * The old analyzeBookPages is kept for backward compatibility (LibraryPage PDF viewer).
 *
 * @param {Array<{pageNum: number, base64: string}>} pages - Rendered page images (max 5)
 * @param {{ subject: string, grade: string, bookTitle: string }} context
 * @returns {Promise<{analysis: Array, error: string|null}>}
 *   analysis = [{page, content_type, complexity, subunit, is_workbook, summary,
 *                estimated_minutes, grammar_points[], vocabulary_topics[],
 *                exercise_types[], prerequisite_knowledge, teaching_challenges}]
 */
export async function deepAnalyzeBookPages(pages, context = {}) {
  if (!pages?.length) return { analysis: [], error: 'No hay páginas para analizar' }

  const imageBlocks = pages
    .filter(p => p?.base64)
    .slice(0, 5)
    .map(p => ({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: p.base64 },
    }))

  if (!imageBlocks.length) return { analysis: [], error: 'No se pudieron procesar las imágenes' }

  const pageNumbers = pages.slice(0, 5).map(p => p.pageNum)

  const prompt = `You are deeply analyzing ${imageBlocks.length} pages from "${context.bookTitle || 'textbook'}" — ${context.subject || 'English'} for grade ${context.grade || '8th'}.

PAGE NUMBERS (in order): ${pageNumbers.join(', ')}

For EACH page, provide a THOROUGH analysis with these fields:
- page: the page number
- unit_number: the UNIT this page belongs to as an INTEGER (e.g. if the page is part of Unit 4, return 4). Determine this from headers, footers, or running titles visible on the page. If truly impossible to determine, use the same unit_number as the previous page.
- content_type: one of "grammar_new" | "grammar_practice" | "vocabulary" | "reading" | "listening" | "speaking" | "writing" | "workbook" | "review" | "test" | "warmup" | "project"
- complexity: 1-5 (1=simple warmup/review, 2=guided practice, 3=standard new concept, 4=complex skill/dense grammar, 5=multiple new grammar structures simultaneously)
- subunit: the sub-section label WITHIN the unit (e.g. "4A", "4B", "4C", "Review 4", "Get Started 4"). Use the format "NumberLetter" when visible. Use null if no sub-section is identifiable.
- is_workbook: true if workbook/practice book page
- summary: ONE sentence describing what this page teaches/practices
- estimated_minutes: realistic class time (grammar_new 40-50, grammar_practice 20-30, vocabulary 25-35, reading 30-40, listening 25-35, speaking 25-35, workbook 20-30, warmup 10-15, review 20-30)
- grammar_points: array of specific grammar structures on this page (e.g. ["Present Perfect", "irregular past participles"]) — empty array if none
- vocabulary_topics: array of vocabulary themes/fields (e.g. ["daily routines", "household chores"]) — empty array if none
- exercise_types: array of exercise formats visible (e.g. ["fill-in-blank", "matching", "free writing", "gap fill", "multiple choice"]) — empty array if none
- prerequisite_knowledge: what students must already know to do this page (one sentence, null if none)
- teaching_challenges: main difficulty a teacher will face with this page (one sentence, null if none)

IMPORTANT: unit_number must ALWAYS be an integer representing the textbook unit (3, 4, 5, 6, 7, 8...). Do NOT confuse page numbers with unit numbers. A page 28 that belongs to Unit 4 should have unit_number: 4.

RESPOND ONLY with valid JSON, no markdown, no explanation:
{"analysis": [{"page": N, "unit_number": N, "content_type": "...", "complexity": N, "subunit": "...", "is_workbook": false, "summary": "...", "estimated_minutes": N, "grammar_points": [], "vocabulary_topics": [], "exercise_types": [], "prerequisite_knowledge": "...", "teaching_challenges": "..."}, ...]}`

  try {
    const raw = await callClaude({
      type: 'syllabus_deep_analyze_pages',
      system: 'You are an expert ESL/EFL curriculum analyst. You deeply classify textbook pages extracting grammar structures, vocabulary themes, and teaching insights. Respond ONLY with valid JSON.',
      message: prompt,
      maxTokens: 3000,
      imageBlocks,
    })

    const text = (raw || '').trim()
    const jsonStr = text.startsWith('{') ? text : text.match(/\{[\s\S]*\}/)?.[0] || ''
    if (!jsonStr) return { analysis: [], error: 'La IA no devolvió JSON válido' }

    const parsed = JSON.parse(jsonStr)
    return { analysis: parsed.analysis || [], error: null }
  } catch (err) {
    console.error('[syllabusAI] deepAnalyzeBookPages error:', err)
    return { analysis: [], error: err.message }
  }
}

/**
 * Classify subunits by difficulty based on aggregated deep page analysis.
 * Text-only call (no Vision). Groups pages by subunit and produces a
 * difficulty classification with estimated sessions.
 *
 * @param {object} params
 * @param {Array}  params.page_analysis   - From deepAnalyzeBookPages
 * @param {Array}  params.units_config    - [{unit_number, title, start_page, end_page, subunits:[]}]
 * @param {string} params.subject
 * @param {string} params.grade
 * @returns {Promise<{classification: Array, error: string|null}>}
 *   classification = [{subunit, unit_number, difficulty, estimated_sessions, session_type,
 *                      grammar_points[], vocabulary_topics[], exercise_types[], ai_rationale}]
 */
export async function classifySubunitsAI({ page_analysis = [], units_config = [], subject = '', grade = '' }) {
  if (!page_analysis.length) return { classification: [], error: 'No hay análisis de páginas' }

  // Aggregate page data by subunit
  const bySubunit = {}
  page_analysis.forEach(p => {
    const key = p.subunit || 'misc'
    if (!bySubunit[key]) bySubunit[key] = { pages: [], unit_number: null }
    bySubunit[key].pages.push(p)
    // Try to infer unit_number from units_config
    if (!bySubunit[key].unit_number && units_config.length) {
      const unit = units_config.find(u => u.start_page <= p.page && p.page <= u.end_page)
      if (unit) bySubunit[key].unit_number = unit.unit_number
    }
  })

  const subunitBlock = Object.entries(bySubunit).map(([sub, data]) => {
    const pages = data.pages
    const avgComplexity = (pages.reduce((s, p) => s + (p.complexity || 3), 0) / pages.length).toFixed(1)
    const totalMins = pages.reduce((s, p) => s + (p.estimated_minutes || 30), 0)
    const grammarPoints = [...new Set(pages.flatMap(p => p.grammar_points || []))]
    const vocabTopics = [...new Set(pages.flatMap(p => p.vocabulary_topics || []))]
    const exerciseTypes = [...new Set(pages.flatMap(p => p.exercise_types || []))]
    const contentTypes = [...new Set(pages.map(p => p.content_type))]
    return `Subunit: ${sub}${data.unit_number ? ` (Unit ${data.unit_number})` : ''}
  Pages: ${pages.map(p => p.page).join(', ')} (${pages.length} pages)
  Avg complexity: ${avgComplexity}/5 | Total time: ${totalMins} min
  Content types: ${contentTypes.join(', ')}
  Grammar points: ${grammarPoints.join('; ') || 'none'}
  Vocabulary: ${vocabTopics.join('; ') || 'none'}
  Exercise types: ${exerciseTypes.join('; ') || 'none'}
  Teaching challenges: ${pages.filter(p => p.teaching_challenges).map(p => p.teaching_challenges).slice(0, 2).join('; ') || 'none'}`
  }).join('\n\n')

  const unitsBlock = units_config.length
    ? units_config.map(u => `  Unit ${u.unit_number}: "${u.title}" (pp. ${u.start_page}–${u.end_page})`).join('\n')
    : '  (no unit structure specified)'

  const prompt = `You are a curriculum difficulty analyst for ${sanitizeAIInput(subject)} (${sanitizeAIInput(grade)}).

Classify each subunit by difficulty and estimate how many class sessions it needs.

UNITS:
${unitsBlock}

SUBUNIT DATA (aggregated from page analysis):
${subunitBlock}

DIFFICULTY CRITERIA:
- "easy": avg complexity ≤ 2.0, mostly vocabulary/warmup/review — needs 1 session
- "moderate": avg complexity 2.1–3.5, new concepts with guided practice — needs 1-2 sessions
- "dense": avg complexity > 3.5 OR multiple new grammar structures — needs 2-4 sessions

RESPOND ONLY with valid JSON:
{
  "classification": [
    {
      "subunit": "3A",
      "unit_number": 3,
      "difficulty": "easy|moderate|dense",
      "estimated_sessions": 1,
      "session_type": "vocabulary|grammar_intro|grammar_practice|reading|mixed|review",
      "grammar_points": ["..."],
      "vocabulary_topics": ["..."],
      "exercise_types": ["..."],
      "ai_rationale": "One sentence explaining the classification"
    }
  ]
}`

  try {
    const raw = await callClaude({
      type: 'syllabus_classify_subunits',
      system: 'You are an expert curriculum analyst. Respond ONLY with valid JSON, no markdown.',
      message: prompt,
      maxTokens: 3000,
    })

    const text = (raw || '').trim()
    const jsonStr = text.startsWith('{') ? text : text.match(/\{[\s\S]*\}/)?.[0] || ''
    if (!jsonStr) return { classification: [], error: 'La IA no devolvió JSON válido' }

    const parsed = JSON.parse(jsonStr)
    return { classification: parsed.classification || [], error: null }
  } catch (err) {
    console.error('[syllabusAI] classifySubunitsAI error:', err)
    return { classification: [], error: err.message }
  }
}

/**
 * Generate teaching strategies for DENSE subunits (difficulty='dense', complexity >= 4).
 * Provides introduction approach, scaffolding techniques, common mistakes, visual aids,
 * and session flow for difficult content.
 *
 * @param {object} params
 * @param {Array}  params.subunit_classification - From classifySubunitsAI (all subunits)
 * @param {Array}  params.page_analysis         - From deepAnalyzeBookPages (for detail)
 * @param {string} params.subject
 * @param {string} params.grade
 * @returns {Promise<{strategies: Array, error: string|null}>}
 *   strategies = [{subunit, unit_number, content_focus, strategies:{
 *     introduction, scaffolding[], common_mistakes[], visual_aids[], session_flow}}]
 */
export async function generateTeachingStrategiesAI({ subunit_classification = [], page_analysis = [], subject = '', grade = '' }) {
  // Only generate for dense subunits
  const denseSubunits = subunit_classification.filter(s => s.difficulty === 'dense')
  if (!denseSubunits.length) return { strategies: [], error: null }

  const denseBlock = denseSubunits.map(s => {
    // Get detailed page data for this subunit
    const pages = page_analysis.filter(p => p.subunit === s.subunit)
    const challenges = [...new Set(pages.filter(p => p.teaching_challenges).map(p => p.teaching_challenges))]
    const prereqs = [...new Set(pages.filter(p => p.prerequisite_knowledge).map(p => p.prerequisite_knowledge))]
    return `Subunit: ${s.subunit} (Unit ${s.unit_number})
  Focus: ${s.session_type} — ${s.estimated_sessions} sessions needed
  Grammar points: ${(s.grammar_points || []).join(', ') || 'none'}
  Vocabulary: ${(s.vocabulary_topics || []).join(', ') || 'none'}
  Exercise types: ${(s.exercise_types || []).join(', ') || 'none'}
  Prerequisite knowledge: ${prereqs.join('; ') || 'none'}
  Known challenges: ${challenges.join('; ') || 'none'}
  AI rationale: ${s.ai_rationale || 'dense content'}`
  }).join('\n\n')

  const prompt = `You are an expert EFL/ESL pedagogical coach for ${sanitizeAIInput(subject)} (${sanitizeAIInput(grade)}) at a Christian school in Colombia.

Generate specific, practical teaching strategies for each DENSE subunit below. These strategies will be shown to the teacher before class and will inform how the AI generates lesson guides.

DENSE SUBUNITS REQUIRING STRATEGIES:
${denseBlock}

For each subunit, provide:
- introduction: How to open the lesson and present this content (2-3 sentences). Focus on discovery/inductive approach.
- scaffolding: 3-4 specific techniques to support student understanding (arrays of actionable items)
- common_mistakes: 2-3 typical errors students make with this content (be specific)
- visual_aids: 2-3 concrete visual tools or diagrams the teacher should prepare
- session_flow: Brief description of how to sequence the sessions (e.g. "Session 1: discovery + pattern. Session 2: controlled practice. Session 3: production.")

Use ${['Language Arts', 'English'].includes(subject) ? 'English' : 'Spanish'} in your response.

RESPOND ONLY with valid JSON:
{
  "strategies": [
    {
      "subunit": "3B",
      "unit_number": 3,
      "content_focus": "Present Perfect — introduction and practice",
      "strategies": {
        "introduction": "...",
        "scaffolding": ["...", "...", "..."],
        "common_mistakes": ["...", "...", "..."],
        "visual_aids": ["...", "...", "..."],
        "session_flow": "..."
      }
    }
  ]
}`

  try {
    const raw = await callClaude({
      type: 'syllabus_teaching_strategies',
      system: 'You are an expert EFL/ESL pedagogical coach. Provide practical, classroom-ready teaching strategies. Respond ONLY with valid JSON.',
      message: prompt,
      maxTokens: 4000,
    })

    const text = (raw || '').trim()
    const jsonStr = text.startsWith('{') ? text : text.match(/\{[\s\S]*\}/)?.[0] || ''
    if (!jsonStr) return { strategies: [], error: 'La IA no devolvió JSON válido' }

    const parsed = JSON.parse(jsonStr)
    return { strategies: parsed.strategies || [], error: null }
  } catch (err) {
    console.error('[syllabusAI] generateTeachingStrategiesAI error:', err)
    return { strategies: [], error: err.message }
  }
}

/**
 * Analyze a batch of textbook pages using Claude Vision.
 * Returns per-page classification: content_type, complexity, subunit, etc.
 * KEPT for backward compatibility (LibraryPage PDF viewer, old wizard plans).
 * New wizard uses deepAnalyzeBookPages instead.
 *
 * @param {Array<{pageNum: number, base64: string}>} pages - Rendered page images
 * @param {{ subject: string, grade: string, bookTitle: string }} context
 * @returns {Promise<{analysis: Array, error: string|null}>}
 *   analysis = [{page, content_type, complexity, subunit, is_workbook, summary, estimated_minutes}]
 */
export async function analyzeBookPages(pages, context = {}) {
  if (!pages?.length) return { analysis: [], error: 'No hay páginas para analizar' }

  const imageBlocks = pages
    .filter(p => p?.base64)
    .slice(0, 5) // Claude Vision max 5 images per call
    .map(p => ({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: p.base64 },
    }))

  if (!imageBlocks.length) return { analysis: [], error: 'No se pudieron procesar las imágenes' }

  const pageNumbers = pages.slice(0, 5).map(p => p.pageNum)

  const prompt = `You are analyzing ${imageBlocks.length} pages from a ${context.subject || 'English'} textbook "${context.bookTitle || 'textbook'}" for grade ${context.grade || '8th'}.

PAGE NUMBERS (in order): ${pageNumbers.join(', ')}

For EACH page, classify it with these fields:
- page: the page number
- content_type: one of "grammar_new" | "grammar_practice" | "vocabulary" | "reading" | "listening" | "speaking" | "writing" | "workbook" | "review" | "test" | "warmup" | "project"
- complexity: 1-5 (1=warmup/simple review, 2=guided practice, 3=new concept introduction, 4=complex skill building, 5=dense new grammar/multiple new concepts)
- subunit: the subunit label if visible (e.g., "3A", "3B", "Unit 3 Review", "WB p.28")
- is_workbook: true if this is a workbook/practice page, false if main student book
- summary: ONE sentence describing what this page teaches/practices
- estimated_minutes: how many class minutes this page would take (15-90). Grammar_new=40-50, practice=20-30, warmup=10-15, workbook=20-30

RESPOND ONLY with valid JSON, no markdown, no explanation:
{"analysis": [{"page": N, "content_type": "...", "complexity": N, "subunit": "...", "is_workbook": false, "summary": "...", "estimated_minutes": N}, ...]}`

  try {
    const raw = await callClaude({
      type: 'syllabus_analyze_pages',
      system: 'You are an expert ESL/EFL curriculum analyst. You classify textbook pages by content type, complexity, and time requirements. Respond ONLY with valid JSON.',
      message: prompt,
      maxTokens: 2000,
      imageBlocks,
    })

    const text = (raw || '').trim()
    const jsonStr = text.startsWith('{') ? text : text.match(/\{[\s\S]*\}/)?.[0] || ''
    if (!jsonStr) return { analysis: [], error: 'La IA no devolvió JSON válido' }

    const parsed = JSON.parse(jsonStr)
    return { analysis: parsed.analysis || [], error: null }
  } catch (err) {
    console.error('[syllabusAI] analyzeBookPages error:', err)
    return { analysis: [], error: err.message }
  }
}

/**
 * Distribute analyzed pages across available teaching days,
 * respecting the teacher's schedule (hours per day) and page complexity.
 *
 * @param {object} params
 * @param {Array}  params.page_analysis       - From analyzeBookPages: [{page, complexity, estimated_minutes, ...}]
 * @param {Array}  params.working_weeks       - From computeWorkingWeeks: [{week, days:['2026-05-05',...]}]
 * @param {object} params.schedule            - teacher_assignments.schedule: {mon:['1st','2nd'], tue:['3rd'], ...}
 * @param {number} params.minutes_per_period  - Minutes per class period (default 50)
 * @param {string} params.subject
 * @param {string} params.grade
 * @param {Array}  params.units_config        - [{unit_number, title, start_page, end_page}]
 *
 * @returns {Promise<{distribution: Array, error: string|null}>}
 *   distribution = [{week, days:{mon:{pages:[], focus, summary, class_hours, total_minutes}, ...}}]
 */
export async function distributePagesByWeek({
  page_analysis = [],
  working_weeks = [],
  schedule = {},
  minutes_per_period = 50,
  subject = '',
  grade = '',
  units_config = [],
  subunit_classification = [],   // difficulty-aware distribution
  teaching_strategies = [],      // strategies inform session descriptions
  start_unit = 1,               // skip units before this one
  end_unit = null,              // stop at this unit (inclusive); null = no limit
}) {
  if (!page_analysis.length) return { distribution: [], error: 'No hay análisis de páginas' }
  if (!working_weeks.length) return { distribution: [], error: 'No hay semanas hábiles' }

  // Filter pages to only include the unit range [start_unit, end_unit]
  const startUnitData = units_config.find(u => u.unit_number === start_unit)
  const endUnitData   = end_unit ? units_config.find(u => u.unit_number === end_unit) : null
  const filteredPages = page_analysis.filter(p => {
    if (startUnitData && p.page < startUnitData.start_page) return false
    if (endUnitData   && p.page > endUnitData.end_page)     return false
    return true
  })
  if (!filteredPages.length) return { distribution: [], error: 'No hay páginas en el rango de unidades seleccionado' }

  // Build schedule context: how many hours per day of the week
  const dayHoursBlock = DAY_KEYS.map(dk => {
    const periods = schedule[dk] || []
    const hours = periods.length
    const mins = hours * minutes_per_period
    return `  ${DAY_LABELS[dk]}: ${hours} hora(s) = ${mins} minutos disponibles`
  }).join('\n')

  // Build pages context with complexity (filtered to unit range)
  const pagesBlock = filteredPages.map(p =>
    `  p.${p.page} [${p.content_type}] complexity:${p.complexity} ~${p.estimated_minutes}min — ${p.summary || ''}`
  ).join('\n')

  // Units context
  const unitsBlock = units_config.length
    ? units_config.map(u => `  Unit ${u.unit_number}: "${u.title}" (pp. ${u.start_page}–${u.end_page})`).join('\n')
    : '  (units not specified — distribute sequentially)'

  // Working weeks with ISO dates mapped to day keys
  const weeksBlock = working_weeks.map(w => {
    const daysList = w.days.map(iso => {
      const d = new Date(iso + 'T12:00:00')
      const dk = DAY_KEYS[d.getDay() === 0 ? 6 : d.getDay() - 1]
      const periods = schedule[dk] || []
      return `${dk}(${periods.length}h)`
    }).join(', ')
    return `  Semana ${w.week}: ${w.days.length} días [${daysList}]`
  }).join('\n')

  // Build subunit difficulty context for smarter distribution
  const classificationBlock = subunit_classification.length
    ? subunit_classification.map(s =>
        `  ${s.subunit}: ${s.difficulty} — ${s.estimated_sessions} session(s) — ${s.session_type}` +
        (s.grammar_points?.length ? ` [Grammar: ${s.grammar_points.join(', ')}]` : '') +
        (s.ai_rationale ? ` — ${s.ai_rationale}` : '')
      ).join('\n')
    : '  (no classification available — distribute by complexity)'

  // Build relevant teaching strategy hints for dense subunits
  const strategiesHint = teaching_strategies.length
    ? teaching_strategies.map(s =>
        `  ${s.subunit}: ${s.content_focus}\n    Session flow: ${s.strategies?.session_flow || 'N/A'}`
      ).join('\n')
    : '  (none)'

  const unitRangeNote = start_unit > 1 || end_unit
    ? `UNIT RANGE: Distribute ONLY Units ${start_unit}${end_unit ? ` through ${end_unit}` : '+'} — all pages provided are within this range.`
    : 'Start from the first page in the analysis.'

  const prompt = `You are an expert curriculum planner for ${sanitizeAIInput(subject)} (${sanitizeAIInput(grade)}).

TASK: Distribute these textbook pages across the available teaching days, creating a realistic class-by-class plan. Use the subunit difficulty classification to allocate MORE sessions to dense content.

${unitRangeNote}

═══ TEACHER SCHEDULE (hours per day of the week) ═══
${dayHoursBlock}
  Minutes per period: ${minutes_per_period}

═══ UNITS ═══
${unitsBlock}

═══ SUBUNIT DIFFICULTY CLASSIFICATION ═══
(Use this to allocate sessions — dense subunits need more days)
${classificationBlock}

═══ SESSION FLOW HINTS FOR DENSE CONTENT ═══
${strategiesHint}

═══ PAGES TO DISTRIBUTE (${filteredPages.length} pages, Units ${start_unit}${end_unit ? '–' + end_unit : '+'}) ═══
${pagesBlock}

═══ AVAILABLE WEEKS ═══
${weeksBlock}
Total: ${working_weeks.length} weeks

═══ RULES ═══
1. NEVER assign more minutes of content than available in that day's class time.
   - 1 hour day (${minutes_per_period}min): max 1 complex page OR 2 simple pages
   - 2 hour day (${minutes_per_period * 2}min): max 2-3 pages depending on complexity
2. Pages with complexity 4-5 (new grammar, dense content): MAX 1 page per hour.
3. Pages with complexity 1-2 (warmup, simple practice): can group 2-3 per hour.
4. Workbook pages should be paired with their related main book page when possible.
5. Keep subunit pages together — don't split a subunit across weeks if avoidable.
6. Dense subunits (from classification above) MUST get the full estimated_sessions allocated.
7. Leave review/buffer days at the end of each unit (1 day per unit).
8. If days have 0 class hours, SKIP them entirely.
9. Each day entry MUST include: pages[], focus, total_minutes, class_hours, AND:
   - key_grammar (array of grammar points covered that session, empty if none)
   - key_vocabulary (array of vocab topics, empty if none)
   - suggested_approach (one sentence on how to approach this session, null if easy/moderate)

RESPOND ONLY with valid JSON:
{
  "distribution": [
    {
      "week": 1,
      "days": {
        "mon": {
          "pages": [24, 25],
          "focus": "Unit 3A — Present Perfect introduction",
          "total_minutes": 45,
          "class_hours": 1,
          "key_grammar": ["Present Perfect structure"],
          "key_vocabulary": [],
          "suggested_approach": "Discovery: show 5 example sentences, ask students to find the pattern."
        },
        "tue": null,
        "wed": {
          "pages": [26, 27],
          "focus": "Unit 3A — Practice + Workbook",
          "total_minutes": 85,
          "class_hours": 2,
          "key_grammar": ["Present Perfect vs Past Simple"],
          "key_vocabulary": [],
          "suggested_approach": null
        }
      }
    }
  ]
}

Use null for days with no class. Only include day keys that appear in the schedule.`

  try {
    const raw = await callClaude({
      type: 'syllabus_distribute_pages',
      system: 'You are an expert curriculum scheduler. You distribute textbook content across teaching days respecting time constraints. Respond ONLY with valid JSON.',
      message: prompt,
      maxTokens: 8000,
    })

    const text = (raw || '').trim()
    const jsonStr = text.startsWith('{') ? text : text.match(/\{[\s\S]*\}/)?.[0] || ''
    if (!jsonStr) return { distribution: [], error: 'La IA no devolvió JSON válido' }

    const parsed = JSON.parse(jsonStr)
    if (!Array.isArray(parsed.distribution)) return { distribution: [], error: 'Formato de distribución incorrecto' }

    return { distribution: parsed.distribution, error: null }
  } catch (err) {
    console.error('[syllabusAI] distributePagesByWeek error:', err)
    return { distribution: [], error: err.message }
  }
}

/**
 * AI Advisor: validates whether a day's planned resources fit within available time.
 * Returns feedback and recommendations if overloaded.
 *
 * @param {object} params
 * @param {Array}  params.resources         - Resources for this day [{title, resource_type, duration_minutes, abc_section, justification}]
 * @param {Array}  params.pages             - Pages assigned to this day [{page, content_type, complexity, estimated_minutes}]
 * @param {number} params.available_minutes - Total minutes available (periods × 50)
 * @param {string} params.subject
 * @param {string} params.day_label         - e.g., "Miércoles Semana 3"
 *
 * @returns {Promise<{feasible: boolean, feedback: string, recommendations: string[], error: string|null}>}
 */
export async function advisorCheckSession({
  resources = [],
  pages = [],
  available_minutes = 50,
  subject = '',
  day_label = '',
}) {
  // Quick math check before calling AI
  const pageMinutes = pages.reduce((sum, p) => sum + (p.estimated_minutes || 30), 0)
  const resourceMinutes = resources.reduce((sum, r) => sum + (r.duration_minutes || 10), 0)
  const totalPlanned = pageMinutes + resourceMinutes
  // ABC overhead: ~15 min (encounter 8 + motivation 7 + closing 5 - overlap with content)
  const ABC_OVERHEAD = 15
  const effectiveMinutes = available_minutes - ABC_OVERHEAD

  // If clearly feasible, skip AI call
  if (totalPlanned <= effectiveMinutes && resources.length <= 3) {
    return {
      feasible: true,
      feedback: `✅ Plan factible: ${totalPlanned} min planificados dentro de ${available_minutes} min disponibles.`,
      recommendations: [],
      error: null,
    }
  }

  // If clearly overloaded by >50%, give immediate feedback without AI
  if (totalPlanned > available_minutes * 1.5) {
    const excess = totalPlanned - effectiveMinutes
    return {
      feasible: false,
      feedback: `⚠️ Sobrecarga de ${excess} minutos. Tienes ${available_minutes} min disponibles pero planeas ${totalPlanned} min de contenido.`,
      recommendations: [
        resources.length > 2 ? `Reduce los recursos de ${resources.length} a máximo 2 para esta sesión.` : null,
        pages.length > 2 ? `Mueve ${pages.length - 1} página(s) al día siguiente.` : null,
        'Considera si algún recurso puede ser tarea asíncrona en Virtual Campus.',
      ].filter(Boolean),
      error: null,
    }
  }

  // Borderline case — ask AI for nuanced advice
  const resourcesBlock = resources.map(r =>
    `  - [${r.resource_type}] "${r.title}" ~${r.duration_minutes || '?'}min en sección ${r.abc_section || 'no asignada'}\n    Justificación: ${r.justification || 'sin justificación'}`
  ).join('\n')

  const pagesBlockStr = pages.map(p =>
    `  - p.${p.page} [${p.content_type}] complexity:${p.complexity} ~${p.estimated_minutes}min`
  ).join('\n')

  const prompt = `You are a pedagogical advisor for ${sanitizeAIInput(subject)} at Boston Flex school.

A teacher is planning a session for "${sanitizeAIInput(day_label)}".
Available time: ${available_minutes} minutes (including ABC structure: Encounter 8min + Tema 7min + Motivation 10min + Skills ~25min + Closing 5min + Assignment 3min).

PAGES ASSIGNED:
${pagesBlockStr || '  (none)'}

ADDITIONAL RESOURCES PLANNED:
${resourcesBlock || '  (none)'}

TOTAL ESTIMATED: ${totalPlanned} minutes of content for ${available_minutes} minutes of class.

Evaluate feasibility and provide:
1. Is this realistic? (yes/no)
2. Brief feedback (1-2 sentences in Spanish)
3. If NOT feasible: 2-3 specific recommendations in Spanish

RESPOND with JSON only:
{"feasible": true/false, "feedback": "...", "recommendations": ["...", "..."]}`

  try {
    const raw = await callClaude({
      type: 'syllabus_advisor',
      system: 'You are a practical pedagogical advisor. Be direct and constructive. Respond in Spanish. JSON only.',
      message: prompt,
      maxTokens: 800,
    })

    const text = (raw || '').trim()
    const jsonStr = text.startsWith('{') ? text : text.match(/\{[\s\S]*\}/)?.[0] || ''
    if (!jsonStr) return { feasible: totalPlanned <= effectiveMinutes, feedback: 'No se pudo obtener feedback de la IA', recommendations: [], error: null }

    const parsed = JSON.parse(jsonStr)
    return {
      feasible: !!parsed.feasible,
      feedback: parsed.feedback || '',
      recommendations: parsed.recommendations || [],
      error: null,
    }
  } catch (err) {
    // Fallback to simple math
    return {
      feasible: totalPlanned <= effectiveMinutes,
      feedback: totalPlanned <= effectiveMinutes
        ? `Plan estimado: ${totalPlanned}/${available_minutes} min.`
        : `⚠️ Exceso de ~${totalPlanned - effectiveMinutes} min.`,
      recommendations: [],
      error: null, // Don't surface AI errors to teacher
    }
  }
}
