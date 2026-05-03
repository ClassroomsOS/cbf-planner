// examUtils.js — Utilidades puras del módulo de evaluación
// Extraídas de ExamDashboardPage y ExamPlayerPage para permitir testing y evitar duplicación.

/**
 * Shuffle determinístico usando LCG (Linear Congruential Generator).
 * Dado el mismo array y la misma seed, siempre produce el mismo orden.
 * Seed recomendada: (version_number + 1) * 31337
 */
export function seededShuffle(arr, seed) {
  const a = [...arr]
  let s = Math.abs(seed | 0) || 1
  for (let i = a.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Reordena las opciones de una pregunta MCQ usando seededShuffle
 * y actualiza correct_answer para que apunte a la opción correcta reordenada.
 *
 * @param {Array} options - Array de strings con las opciones
 * @param {string} correctAnswer - Texto de la respuesta correcta
 * @param {number} seed - Seed para el shuffle
 * @returns {{ options: string[], correct_answer: string }}
 */
export function shuffleMCOptions(options, correctAnswer, seed) {
  const shuffled = seededShuffle(options, seed)
  return { options: shuffled, correct_answer: correctAnswer }
}

/**
 * Escala de evaluación Boston Flex — fuente de verdad única.
 * Superior 4.50–5.00 | Alto 4.00–4.49 | Básico 3.50–3.99 | Bajo 1.00–3.49
 */
export const GRADE_SCALE = [
  { min: 4.50, label: 'Superior', color: '#15803D', bg: '#DCFCE7', icon: '⭐' },
  { min: 4.00, label: 'Alto',     color: '#1D4ED8', bg: '#DBEAFE', icon: '✅' },
  { min: 3.50, label: 'Básico',   color: '#D97706', bg: '#FEF3C7', icon: '📘' },
  { min: 0,    label: 'Bajo',     color: '#DC2626', bg: '#FEE2E2', icon: '❗' },
]

/**
 * Devuelve el nivel de desempeño para una nota colombiana.
 * @param {number|null} g - Nota 1.0–5.0
 * @returns {{ label, color, bg, icon } | null}
 */
export function gradeLevel(g) {
  if (g == null) return null
  for (const level of GRADE_SCALE) {
    if (g >= level.min) return level
  }
  return GRADE_SCALE[GRADE_SCALE.length - 1]
}

/**
 * Color rápido para una nota colombiana (para badges inline).
 * @param {number|null} g
 * @returns {string} hex color
 */
export function gradeColor(g) {
  if (g == null) return '#9CA3AF'
  const level = gradeLevel(g)
  return level ? level.color : '#9CA3AF'
}

/**
 * Calcula la nota colombiana (escala 1.0–5.0) a partir de un puntaje.
 * Fórmula CBF: (puntaje / total) × 4 + 1
 *
 * @param {number} score - Puntaje obtenido
 * @param {number} max   - Puntaje máximo posible
 * @returns {string} Nota con 1 decimal (ej. "3.8"), o null si max === 0
 */
export function colombianGrade(score, max) {
  if (!max || max === 0) return null
  const grade = (score / max) * 4 + 1
  return Math.min(5, Math.max(1, grade)).toFixed(1)
}

// ── Presets de examen (Quiz vs Final) ──────────────────────────────────────────

/**
 * Presets según el protocolo institucional de evaluación.
 * - Quiz: 12–15 preguntas, sin Extra Points
 * - Final (1°–8°): 20 base + 5 Extra Points listening
 * - Final (9°–11°): 35 base + 5 Extra Points listening, componentes requeridos
 */
export const EXAM_PRESETS = {
  quiz: {
    key: 'quiz',
    label: 'Quiz (Parcial)',
    icon: '📝',
    description: '12–15 preguntas · Evaluación parcial de temas específicos',
    totalRange: [12, 15],
    biblicalMin: 1,
    hasExtraPoints: false,
    defaultTypes: {
      multiple_choice: 5,
      short_answer: 3,
      fill_blank: 2,
      biblical_reflection: 1,
    },
  },
  final_lower: {
    key: 'final_lower',
    label: 'Examen Final (1°–8°)',
    icon: '📋',
    description: '20 preguntas + 5 Extra Points · Comprehensivo del período',
    baseQuestions: 20,
    extraPoints: 5,
    biblicalMin: 3,
    hasExtraPoints: true,
    pointValue: 0.25,
    extraPointValue: 0.1,
    defaultTypes: {
      multiple_choice: 6,
      true_false: 3,
      fill_blank: 2,
      matching: 1,
      short_answer: 3,
      open_development: 2,
      biblical_reflection: 2,
      verse_analysis: 1,
    },
  },
  final_upper: {
    key: 'final_upper',
    label: 'Examen Final (9°–11°)',
    icon: '📋',
    description: '35 preguntas + 5 Extra Points · Comprehensivo del período',
    baseQuestions: 35,
    extraPoints: 5,
    biblicalMin: 3,
    hasExtraPoints: true,
    extraPointValue: 0.1,
    requiredComponents: ['cloze', 'picture description', 'matching', 'reading', '5 open questions'],
    defaultTypes: {
      multiple_choice: 8,
      true_false: 4,
      fill_blank: 3,
      matching: 2,
      short_answer: 4,
      error_correction: 2,
      open_development: 5,
      sequencing: 2,
      reading_comprehension: 2,
      biblical_reflection: 2,
      verse_analysis: 1,
    },
  },
}

/**
 * Extrae el número de grado de un string como "8.° Blue" → 8, "10.° Red" → 10.
 * @param {string} gradeStr
 * @returns {number|null}
 */
export function extractGradeNumber(gradeStr) {
  if (!gradeStr) return null
  const m = gradeStr.match(/^(\d+)/)
  return m ? parseInt(m[1], 10) : null
}

// Materias que usan el formato upper (35+5+components) en grados 9°+
const UPPER_EXAM_SUBJECTS = ['Language Arts', 'Lingua Skill']

/**
 * Determina el preset de examen correcto según tipo, grado y materia.
 * final_upper (35 base + 5 EP + components) solo aplica a Language Arts / Lingua Skill en 9°+.
 * Todas las demás materias usan final_lower (20 base + 5 EP) sin importar el grado.
 * @param {'quiz'|'final'} examType
 * @param {string} gradeStr - ej. "8.° Blue" o "10.°"
 * @param {string} [subject] - ej. "Language Arts", "Science"
 * @returns {object} preset from EXAM_PRESETS
 */
export function getExamPreset(examType, gradeStr, subject) {
  if (examType !== 'final') return EXAM_PRESETS.quiz
  const num = extractGradeNumber(gradeStr)
  if (num && num >= 9 && UPPER_EXAM_SUBJECTS.includes(subject)) return EXAM_PRESETS.final_upper
  return EXAM_PRESETS.final_lower
}

/**
 * Calcula la nota de un examen final con Extra Points.
 * Fórmula: nota_base = (correctas_base / total_base) × 4 + 1
 *          bonus = extra_correctas × 0.1 (máx +0.5)
 *          nota_final = min(5.0, nota_base + bonus)
 *
 * @param {number} baseCorrect  - Preguntas base respondidas correctamente
 * @param {number} baseTotal    - Total de preguntas base (20 o 35)
 * @param {number} extraCorrect - Extra Points respondidos correctamente (0–5)
 * @returns {string} Nota con 1 decimal, ej. "4.3"
 */
export function finalExamGrade(baseCorrect, baseTotal, extraCorrect) {
  if (!baseTotal || baseTotal === 0) return null
  const baseGrade = (baseCorrect / baseTotal) * 4 + 1
  const extraBonus = Math.min((extraCorrect || 0) * 0.1, 0.5)
  return Math.min(5.0, Math.max(1.0, baseGrade + extraBonus)).toFixed(1)
}
