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
