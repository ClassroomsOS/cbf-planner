// dictationUtils.js — Utilidades puras del módulo de dictation & vocabulary assessment
// Scoring, Levenshtein distance, voice options, difficulty config, assessment modes.

import { colombianGrade, gradeLevel, gradeColor } from './examUtils'

// Re-export para uso directo desde dictationUtils
export { colombianGrade, gradeLevel, gradeColor }

// ── Assessment Modes ────────────────────────────────────────────────────────
// Tres modos de evaluación que combinan dictation (audio TTS) con
// vocabulary quiz (Linguaskill/PET text-based).

export const ASSESSMENT_MODES = {
  dictation: {
    key: 'dictation',
    label: 'Dictation',
    icon: '🎧',
    description: 'Listening assessment con audio TTS',
    color: '#4BACC6',
    types: ['listen_type', 'listen_identify', 'fill_blank'],
    requiresAudio: true,
  },
  vocab_quiz: {
    key: 'vocab_quiz',
    label: 'Vocabulary Quiz',
    icon: '📝',
    description: 'Linguaskill-style: matching + fill + writing + listening comprehension',
    color: '#9BBB59',
    types: ['matching', 'fill_blank', 'writing', 'listen_comprehension'],
    requiresAudio: true,
  },
  combined: {
    key: 'combined',
    label: 'Combined',
    icon: '🎧📝',
    description: 'Full assessment: listening + vocabulary + writing + comprehension',
    color: '#8064A2',
    types: ['listen_type', 'listen_identify', 'matching', 'fill_blank', 'writing', 'listen_comprehension'],
    requiresAudio: true,
  },
}

// ── Item counts per mode + difficulty ────────────────────────────────────────

export const ITEM_COUNTS = {
  dictation: {
    Basico:     { listen_type: 8,  listen_identify: 5, fill_blank: 5 },
    Intermedio: { listen_type: 10, listen_identify: 7, fill_blank: 7 },
    Avanzado:   { listen_type: 12, listen_identify: 8, fill_blank: 8 },
  },
  vocab_quiz: {
    Basico:     { matching: 6,  fill_blank: 5, writing: 1, listen_comprehension: 3 },
    Intermedio: { matching: 8,  fill_blank: 7, writing: 1, listen_comprehension: 3 },
    Avanzado:   { matching: 10, fill_blank: 8, writing: 1, listen_comprehension: 3 },
  },
  combined: {
    Basico:     { listen_type: 6, listen_identify: 4, matching: 5, fill_blank: 4, writing: 1, listen_comprehension: 3 },
    Intermedio: { listen_type: 7, listen_identify: 5, matching: 6, fill_blank: 5, writing: 1, listen_comprehension: 3 },
    Avanzado:   { listen_type: 8, listen_identify: 6, matching: 7, fill_blank: 6, writing: 1, listen_comprehension: 3 },
  },
}

/**
 * Returns item counts for a given mode + difficulty combination.
 * @param {string} difficulty — 'Basico' | 'Intermedio' | 'Avanzado'
 * @param {string} assessmentMode — 'dictation' | 'vocab_quiz' | 'combined'
 * @returns {{ [type]: number, total: number }}
 */
export function getQuestionCounts(difficulty, assessmentMode) {
  const modeCounts = ITEM_COUNTS[assessmentMode] || ITEM_COUNTS.dictation
  const counts = { ...(modeCounts[difficulty] || modeCounts.Intermedio) }
  counts.total = Object.values(counts).reduce((a, b) => a + b, 0)
  return counts
}

// ── Configuración de dificultad (legacy-compatible) ─────────────────────────

export const DIFFICULTY_CONFIG = {
  Basico: {
    key: 'Basico',
    label: 'Básico',
    icon: '📗',
    description: 'Oraciones cortas, vocabulario literal',
    listenType: 8,
    listenIdentify: 5,
    fillBlank: 5,
    matching: 6,
    writing: 1,
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
    matching: 8,
    writing: 1,
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
    matching: 10,
    writing: 1,
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

// ── Section labels & colors ─────────────────────────────────────────────────

export const SECTION_META = {
  listen_type:          { label: 'Listen & Type',          icon: '🎧', color: '#4BACC6' },
  listen_identify:      { label: 'Listen & Identify',      icon: '🔊', color: '#4BACC6' },
  matching:             { label: 'Matching',               icon: '🔗', color: '#9BBB59' },
  fill_blank:           { label: 'Fill the Blank',         icon: '📝', color: '#F79646' },
  writing:              { label: 'Writing',                icon: '✍️', color: '#8064A2' },
  listen_comprehension: { label: 'Listening Comprehension',icon: '🎙️', color: '#2563EB' },
}

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

// ── Scoring de writing composition ──────────────────────────────────────────

/**
 * Evalúa una respuesta de tipo "writing".
 * Auto-score: cuenta cuántas palabras requeridas aparecen en la respuesta.
 * Score = (wordsFound / totalRequired) * maxScore, rounded.
 */
export function scoreWriting(answer, requiredWords, maxScore = 5) {
  if (!answer || !answer.trim()) return { score: 0, isCorrect: false, isPartial: false, wordsFound: 0 }

  const text = answer.trim().toLowerCase()
  const found = (requiredWords || []).filter(w => text.includes(w.toLowerCase()))
  const ratio = requiredWords.length > 0 ? found.length / requiredWords.length : 0
  const score = Math.round(ratio * maxScore * 10) / 10

  return {
    score,
    isCorrect: ratio >= 0.8,
    isPartial: ratio > 0 && ratio < 0.8,
    wordsFound: found.length,
    wordsTotal: requiredWords.length,
  }
}

// ── Scoring completo del dictation ───────────────────────────────────────────

/**
 * Calcula el puntaje total de un dictation/vocabulary assessment.
 * Soporta los 5 tipos: listen_type, listen_identify, matching, fill_blank, writing.
 */
export function scoreDictation(questions, answers) {
  const perSection = {}

  const results = questions.map((q, i) => {
    const answer = answers[i] || ''
    const type = q.question_type
    const maxPts = q.max_score || 1

    if (!perSection[type]) perSection[type] = { score: 0, max: 0, correct: 0, total: 0 }
    perSection[type].max += maxPts
    perSection[type].total += 1

    // listen_type: Levenshtein fuzzy matching
    if (type === 'listen_type') {
      const result = scoreTypedWord(answer, q.correct_answer, maxPts)
      perSection[type].score += result.score
      if (result.isCorrect) perSection[type].correct += 1
      return { ...result, questionIndex: i, type }
    }

    // writing: count required vocabulary words used
    if (type === 'writing') {
      const reqWords = q.required_words || (q.correct_answer ? q.correct_answer.split(',').map(w => w.trim()) : [])
      const result = scoreWriting(answer, reqWords, maxPts)
      perSection[type].score += result.score
      if (result.isCorrect) perSection[type].correct += 1
      return { ...result, questionIndex: i, type }
    }

    // MC questions (listen_identify, matching, fill_blank, listen_comprehension): exact match
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

export function generateDictationCode(prefix, studentCode) {
  return `DICT-${prefix}-${studentCode}`
}

export function randomPrefix() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 4; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

// ── Puntos por tipo de pregunta ──────────────────────────────────────────────

export const QUESTION_POINTS = {
  listen_type: 2,           // escribir la palabra correcta vale más
  listen_identify: 1,       // identificar en oración (MC)
  matching: 1,              // conectar palabra con definición (MC)
  fill_blank: 1,            // fill the blank (MC)
  writing: 5,               // composición escrita (auto-score por vocab usage)
  listen_comprehension: 3,  // comprensión de audio ~30s (4 opciones MC)
}

// ── Manual entry scaffold ────────────────────────────────────────────────────

/**
 * Creates empty section scaffolds for manual entry.
 * assessmentMode controls which sections are included.
 */
export function buildManualSectionsScaffold(difficulty, assessmentMode = 'dictation') {
  const counts = getQuestionCounts(difficulty, assessmentMode)

  const makeItems = (count, type) => Array.from({ length: count }, () => {
    const base = { max_score: QUESTION_POINTS[type] || 1 }
    if (type === 'listen_type') {
      return { ...base, audio_text: '', correct_answer: '' }
    }
    if (type === 'listen_identify') {
      return { ...base, audio_text: '', options: ['', '', ''], correct_answer: '' }
    }
    if (type === 'matching') {
      return { ...base, word: '', options: ['', '', '', ''], correct_answer: '' }
    }
    if (type === 'writing') {
      return { ...base, prompt: '', required_words: [], correct_answer: '' }
    }
    if (type === 'listen_comprehension') {
      return { ...base, audio_text: '', options: ['', '', '', ''], correct_answer: '' }
    }
    // fill_blank
    return { ...base, sentence: '', options: ['', '', ''], correct_answer: '' }
  })

  const SECTION_DEFS = {
    listen_type: {
      type: 'listen_type',
      title: 'Section: Listen and Type',
      instructions: 'Listen carefully and write down the correct words. USE CAPITAL LETTERS.',
    },
    listen_identify: {
      type: 'listen_identify',
      title: 'Section: Listen and Identify',
      instructions: 'Listen to the sentence and choose the correct word you hear.',
    },
    matching: {
      type: 'matching',
      title: 'Part A: Matching',
      instructions: 'Match each word with its correct definition.',
    },
    fill_blank: {
      type: 'fill_blank',
      title: 'Section: Fill the Blank',
      instructions: 'Read the sentence and choose the correct word to fill the blank.',
    },
    writing: {
      type: 'writing',
      title: 'Part C: Writing Composition',
      instructions: 'Write a short paragraph using the required vocabulary words.',
    },
    listen_comprehension: {
      type: 'listen_comprehension',
      title: 'Section: Listening Comprehension',
      instructions: 'Listen to the audio and choose the best answer to the question.',
    },
  }

  const mode = ASSESSMENT_MODES[assessmentMode] || ASSESSMENT_MODES.dictation
  return mode.types
    .filter(t => (counts[t] || 0) > 0)
    .map(t => ({
      ...SECTION_DEFS[t],
      items: makeItems(counts[t], t),
    }))
}
