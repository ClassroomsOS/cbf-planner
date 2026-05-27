// dictationUtils.js — Utilidades puras del módulo de dictation
// Scoring, Levenshtein distance, voice options, difficulty config.

import { colombianGrade, gradeLevel, gradeColor } from './examUtils'

// Re-export para uso directo desde dictationUtils
export { colombianGrade, gradeLevel, gradeColor }

// ── Configuración de dificultad ──────────────────────────────────────────────

export const DIFFICULTY_CONFIG = {
  Basico: {
    key: 'Basico',
    label: 'Básico',
    icon: '📗',
    description: 'Oraciones cortas, vocabulario literal',
    listenType: 8,
    listenIdentify: 5,
    fillBlank: 5,
    get total() { return this.listenType + this.listenIdentify + this.fillBlank },
  },
  Intermedio: {
    key: 'Intermedio',
    label: 'Intermedio',
    icon: '📙',
    description: 'Oraciones compuestas, contexto real',
    listenType: 10,
    listenIdentify: 7,
    fillBlank: 7,
    get total() { return this.listenType + this.listenIdentify + this.fillBlank },
  },
  Avanzado: {
    key: 'Avanzado',
    label: 'Avanzado',
    icon: '📕',
    description: 'Oraciones complejas, uso inferencial',
    listenType: 12,
    listenIdentify: 8,
    fillBlank: 8,
    get total() { return this.listenType + this.listenIdentify + this.fillBlank },
  },
}

// ── Voces TTS disponibles ────────────────────────────────────────────────────

export const VOICE_OPTIONS = [
  // English
  { id: 'en-US-JennyNeural',    label: 'Jenny (US Female)',       lang: 'en', accent: 'US',      gender: 'female' },
  { id: 'en-US-GuyNeural',      label: 'Guy (US Male)',           lang: 'en', accent: 'US',      gender: 'male' },
  { id: 'en-GB-SoniaNeural',    label: 'Sonia (British Female)',  lang: 'en', accent: 'British', gender: 'female' },
  { id: 'en-GB-RyanNeural',     label: 'Ryan (British Male)',     lang: 'en', accent: 'British', gender: 'male' },
  { id: 'en-AU-NatashaNeural',  label: 'Natasha (Australian)',    lang: 'en', accent: 'AU',      gender: 'female' },
  { id: 'en-AU-WilliamNeural',  label: 'William (Australian)',    lang: 'en', accent: 'AU',      gender: 'male' },
  { id: 'en-IE-EmilyNeural',    label: 'Emily (Irish Female)',    lang: 'en', accent: 'Irish',   gender: 'female' },
  { id: 'en-IE-ConnorNeural',   label: 'Connor (Irish Male)',     lang: 'en', accent: 'Irish',   gender: 'male' },
  // Spanish (for instructions)
  { id: 'es-CO-SalomeNeural',   label: 'Salome (Colombia)',       lang: 'es', accent: 'CO',      gender: 'female' },
  { id: 'es-CO-GonzaloNeural',  label: 'Gonzalo (Colombia)',      lang: 'es', accent: 'CO',      gender: 'male' },
]

// ── Levenshtein distance ─────────────────────────────────────────────────────

/**
 * Calcula la distancia de edición entre dos strings.
 * Usada para fuzzy matching en la sección de typed words.
 */
export function levenshtein(a, b) {
  const an = a.length
  const bn = b.length
  if (an === 0) return bn
  if (bn === 0) return an

  const matrix = Array.from({ length: an + 1 }, (_, i) =>
    Array.from({ length: bn + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )

  for (let i = 1; i <= an; i++) {
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }

  return matrix[an][bn]
}

// ── Scoring de palabra escrita ───────────────────────────────────────────────

/**
 * Evalúa una respuesta de tipo "listen & type".
 * - Exact match (case-insensitive): 100% del puntaje
 * - Levenshtein ≤ 1: 50% del puntaje
 * - Levenshtein > 1: 0%
 *
 * @param {string} answer   — lo que escribió el estudiante
 * @param {string} correct  — la respuesta correcta
 * @param {number} maxScore — puntaje máximo de la pregunta
 * @returns {{ score: number, isCorrect: boolean, isPartial: boolean }}
 */
export function scoreTypedWord(answer, correct, maxScore = 1) {
  if (!answer || !answer.trim()) return { score: 0, isCorrect: false, isPartial: false }

  const a = answer.trim().toLowerCase()
  const c = correct.trim().toLowerCase()

  if (a === c) return { score: maxScore, isCorrect: true, isPartial: false }

  const dist = levenshtein(a, c)
  if (dist <= 1) return { score: maxScore * 0.5, isCorrect: false, isPartial: true }

  return { score: 0, isCorrect: false, isPartial: false }
}

// ── Scoring completo del dictation ───────────────────────────────────────────

/**
 * Calcula el puntaje total de un dictation.
 *
 * @param {Array} questions — generated_questions con correct_answer
 * @param {Object} answers  — { [questionIndex]: answerValue }
 * @returns {{ total, max, perSection, colombianGrade, gradeLevel }}
 */
export function scoreDictation(questions, answers) {
  const perSection = {
    listen_type: { score: 0, max: 0, correct: 0, total: 0 },
    listen_identify: { score: 0, max: 0, correct: 0, total: 0 },
    fill_blank: { score: 0, max: 0, correct: 0, total: 0 },
  }

  const results = questions.map((q, i) => {
    const answer = answers[i] || ''
    const type = q.question_type
    const maxPts = q.max_score || 1

    if (!perSection[type]) perSection[type] = { score: 0, max: 0, correct: 0, total: 0 }
    perSection[type].max += maxPts
    perSection[type].total += 1

    if (type === 'listen_type') {
      const result = scoreTypedWord(answer, q.correct_answer, maxPts)
      perSection[type].score += result.score
      if (result.isCorrect) perSection[type].correct += 1
      return { ...result, questionIndex: i, type }
    }

    // MC questions: exact match (case-insensitive)
    const isCorrect = answer.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()
    const score = isCorrect ? maxPts : 0
    perSection[type].score += score
    if (isCorrect) perSection[type].correct += 1
    return { score, isCorrect, isPartial: false, questionIndex: i, type }
  })

  const total = results.reduce((sum, r) => sum + r.score, 0)
  const max = questions.reduce((sum, q) => sum + (q.max_score || 1), 0)
  const grade = colombianGrade(total, max)
  const level = gradeLevel(grade ? parseFloat(grade) : null)

  return {
    total,
    max,
    perSection,
    colombianGrade: grade,
    gradeLevel: level,
    details: results,
  }
}

// ── Generador de códigos de acceso ───────────────────────────────────────────

/**
 * Genera un código de acceso único para un estudiante.
 * Formato: DICT-{random4}-{studentCode}
 * Ejemplo: DICT-A3B2-9B001
 *
 * @param {string} prefix      — prefijo de la sesión (4 chars random)
 * @param {string} studentCode — código del estudiante del roster
 * @returns {string}
 */
export function generateDictationCode(prefix, studentCode) {
  return `DICT-${prefix}-${studentCode}`
}

/**
 * Genera un prefijo aleatorio de 4 caracteres alfanuméricos (mayúsculas).
 * @returns {string}
 */
export function randomPrefix() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sin 0/O/1/I para evitar confusión
  let result = ''
  for (let i = 0; i < 4; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

// ── Puntos por tipo de pregunta ──────────────────────────────────────────────

export const QUESTION_POINTS = {
  listen_type: 2,      // escribir la palabra correcta vale más
  listen_identify: 1,  // identificar en oración (MC)
  fill_blank: 1,       // fill the blank (MC)
}

// ── Manual entry scaffold ────────────────────────────────────────────────────

/**
 * Creates empty section scaffolds for manual dictation entry.
 * Returns the same structure as AI-generated sections, but with empty items.
 */
export function buildManualSectionsScaffold(difficulty) {
  const cfg = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.Intermedio
  const makeItems = (count, type) => Array.from({ length: count }, (_, i) => {
    const base = { max_score: QUESTION_POINTS[type] || 1 }
    if (type === 'listen_type') {
      return { ...base, audio_text: '', correct_answer: '' }
    }
    if (type === 'listen_identify') {
      return { ...base, audio_text: '', options: ['', '', ''], correct_answer: '' }
    }
    // fill_blank
    return { ...base, sentence: '', options: ['', '', ''], correct_answer: '' }
  })

  return [
    {
      type: 'listen_type',
      title: 'Section 1: Listen and Type',
      instructions: 'Listen carefully and write down the correct words.',
      items: makeItems(cfg.listenType, 'listen_type'),
    },
    {
      type: 'listen_identify',
      title: 'Section 2: Listen and Identify',
      instructions: 'Listen to the sentence and choose the correct word you hear.',
      items: makeItems(cfg.listenIdentify, 'listen_identify'),
    },
    {
      type: 'fill_blank',
      title: 'Section 3: Fill the Blank',
      instructions: 'Read the sentence and choose the correct word to fill the blank.',
      items: makeItems(cfg.fillBlank, 'fill_blank'),
    },
  ]
}
