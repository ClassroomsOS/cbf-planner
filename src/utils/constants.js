// ── constants.js ──────────────────────────────────────────────────────────────
// Shared constants across CBF Planner

// ── CBF Section Configuration ─────────────────────────────────────────────────
export const SECTIONS = [
  { key: 'subject',    label: 'SYNCHRONIC CLASS · MEET', short: 'MEET',    hex: '#FF0000', time: '~8 min'  },
  { key: 'motivation', label: 'SUBJECT TO BE WORKED:',   short: 'SUBJECT', hex: '#008F00', time: '~8 min',  sublevel: 'Meeting Topic' },
  { key: 'activity',   label: 'MOTIVATION',               short: 'MOTIV.',  hex: '#1F497D', time: '~8 min',  sublevel: 'Activity' },
  { key: 'skill',      label: 'SKILLS DEVELOPMENT',       short: 'SKILLS',  hex: '#1F497D', time: '~40 min' },
  { key: 'closing',    label: 'CLOSING',                  short: 'CLOSING', hex: '#1F497D', time: '~8 min',  sublevel: 'Motivational Reflection' },
  { key: 'assignment', label: 'ASSIGNMENT',               short: 'ASSIGN.', hex: '#1F497D', time: '~5 min'  },
]

// Sections that support rich content (images, SmartBlocks, videos, AI suggestions)
export const RICH_SECTIONS = ['motivation', 'activity', 'skill']

// ── School Schedule ───────────────────────────────────────────────────────────
export const PERIODS = [
  { id: '1st', label: '1st', time: '6:45–7:40' },
  { id: '2nd', label: '2nd', time: '8:00–8:55' },
  { id: '3rd', label: '3rd', time: '8:55–9:50' },
  { id: '4th', label: '4th', time: '9:50–10:45' },
  { id: '5th', label: '5th', time: '11:15–12:15' },
  { id: '6th', label: '6th', time: '12:15–1:15' },
  { id: '7th', label: '7th', time: '1:30–2:15' },
]

export const DAYS = [
  { key: 'mon', label: 'Lun', full: 'Lunes' },
  { key: 'tue', label: 'Mar', full: 'Martes' },
  { key: 'wed', label: 'Mié', full: 'Miércoles' },
  { key: 'thu', label: 'Jue', full: 'Jueves' },
  { key: 'fri', label: 'Vie', full: 'Viernes' },
]

// ── Academic Periods ──────────────────────────────────────────────────────────
const _year = new Date().getFullYear()
export const ACADEMIC_PERIODS = [
  { value: '1', label: `1.er Período ${_year}`, short: 'P1' },
  { value: '2', label: `2.° Período ${_year}`,  short: 'P2' },
  { value: '3', label: `3.er Período ${_year}`, short: 'P3' },
  { value: '4', label: `4.° Período ${_year}`,  short: 'P4' },
]

// ── Grade helpers ─────────────────────────────────────────────────────────────
// teacher_assignments stores grade + section separately.
// All other tables (achievement_goals, syllabus_topics, lesson_plans…) use the
// combined label. Always use combinedGrade() when building a grade value for DB writes
// or dropdown options — NEVER concatenate inline or strip the section ad-hoc.
export function combinedGrade(assignment) {
  if (!assignment) return ''
  return assignment.section
    ? `${assignment.grade} ${assignment.section}`
    : assignment.grade
}

// ── Modelo B — Materias en inglés (estructura pedagógica diferente) ───────────
// Language Arts, Social Studies, Science y Lingua Skill usan competencias/habilidades/operadores
// en lugar de Logro + Temáticas del Modelo A. Úsalo para mostrar UI diferente.
export const MODELO_B_SUBJECTS = ['Language Arts', 'Social Studies', 'Science', 'Lingua Skill']

// ── Default Subject List ──────────────────────────────────────────────────────
export const DEFAULT_SUBJECTS = [
  'Language Arts',
  'Social Studies',
  'Science',
  'Lingua Skill',
  'Cosmovisión Bíblica',
  'Biblical Worldview',
  'Matemáticas',
  'Sociales',
  'Inglés',
  'Ética',
  'Ed. Física',
  'Artes',
]

// ── Lesson Plan Status ────────────────────────────────────────────────────────
export const LESSON_PLAN_STATUS = {
  draft: { label: 'Borrador', color: '#aaa', bg: '#f5f5f5', icon: '✏️' },
  complete: { label: 'Completa', color: '#4BACC6', bg: '#e8f7fb', icon: '📝' },
  submitted: { label: 'Enviada', color: '#F79646', bg: '#fff3e8', icon: '📤' },
  approved: { label: 'Aprobada', color: '#9BBB59', bg: '#eef7e0', icon: '✅' },
}

export const LESSON_PLAN_STATUS_ORDER = ['draft', 'complete', 'submitted', 'approved']

// ── NEWS Project Status ───────────────────────────────────────────────────────
export const NEWS_PROJECT_STATUS = {
  draft: { label: 'Borrador', color: '#888', bg: '#f5f5f5', icon: '✏️' },
  published: { label: 'Publicado', color: '#1A3A8F', bg: '#EEF2FB', icon: '📢' },
  in_progress: { label: 'En curso', color: '#B8860B', bg: '#FFFDF0', icon: '🔄' },
  completed: { label: 'Completado', color: '#1A6B3A', bg: '#EEFBF0', icon: '✅' },
}

export const NEWS_STATUS_FLOW = {
  draft: 'published',
  published: 'in_progress',
  in_progress: 'completed',
}

export const NEWS_SKILL_LABELS = {
  speaking: '🎤 Speaking',
  listening: '🎧 Listening',
  reading: '📖 Reading',
  writing: '✍️ Writing',
}

// ── Teacher Status ────────────────────────────────────────────────────────────
export const TEACHER_STATUS = {
  pending: { label: 'Pendiente', color: '#F79646', bg: '#fff9f0' },
  approved: { label: 'Aprobado', color: '#9BBB59', bg: '#eef7e0' },
  rejected: { label: 'Rechazado', color: '#C0504D', bg: '#fdf0f0' },
}

// ── Learning Target Taxonomy ──────────────────────────────────────────────────
export const TAXONOMY_LEVELS = [
  { value: 'recognize', label: 'Reconocer', emoji: '👁️', desc: 'Identificar, recordar, nombrar' },
  { value: 'apply', label: 'Aplicar', emoji: '🛠️', desc: 'Usar, demostrar, resolver' },
  { value: 'produce', label: 'Producir', emoji: '✨', desc: 'Crear, diseñar, componer' },
]

// ── Grade Levels ──────────────────────────────────────────────────────────────
export const GRADES = [
  // Elementary
  '1.°', '2.°', '3.°', '4.°', '5.°',
  // Middle School
  '6.°', '7.°', '8.°', '9.°',
  // High School
  '10.°', '11.°',
]

export const SECTIONS_LIST = ['A', 'B', 'C', 'D', 'E']

// ── File Upload Limits ────────────────────────────────────────────────────────
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
export const MAX_IMAGES_PER_SECTION = 6
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']

// ── Color Palette (CBF Brand) ─────────────────────────────────────────────────
export const COLORS = {
  primary: '#2E5598',
  secondary: '#4BACC6',
  accent: '#F79646',
  success: '#9BBB59',
  error: '#C0504D',
  warning: '#F5C300',
  info: '#4F81BD',
  gray: {
    50: '#f5f5f5',
    100: '#e8e8e8',
    200: '#ccc',
    300: '#aaa',
    400: '#888',
    500: '#666',
    600: '#444',
    700: '#333',
    800: '#222',
    900: '#111',
  },
}

// ── Week / Date Helpers ───────────────────────────────────────────────────────
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

/** Returns the ISO date string (YYYY-MM-DD) of the Monday of the week containing dateStr */
export function isoMonday(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  return d.toISOString().slice(0, 10)
}

/** Returns "9–13 de Marzo" or "31 Mar – 4 Abr" for a given Monday ISO string */
export function formatWeekRange(mondayStr) {
  const monday = new Date(mondayStr + 'T12:00:00')
  const dates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
  const [, ms, md]  = dates[0].split('-').map(Number)
  const [, me, mde] = dates[4].split('-').map(Number)
  if (ms === me) return `${md}–${mde} de ${MONTHS_ES[ms - 1]}`
  return `${md} ${MONTHS_ES[ms - 1].slice(0, 3)} – ${mde} ${MONTHS_ES[me - 1].slice(0, 3)}`
}

/** Detects activity type from name keywords → { icon, color, label, tier } */
export function detectActivityType(nombre = '') {
  const n = nombre.toLowerCase()
  if (n.includes('dict'))                          return { icon: '🎤', color: '#4BACC6', label: 'Dictation',   tier: 'routine' }
  if (n.includes('quiz') || n.includes('test'))   return { icon: '📝', color: '#C0504D', label: 'Quiz/Test',   tier: 'high-stakes' }
  if (n.includes('reading') || n.includes('lectura')) return { icon: '📖', color: '#F79646', label: 'Reading', tier: 'assessment' }
  if (n.includes('speaking') || n.includes('oral'))   return { icon: '🗣', color: '#8064A2', label: 'Speaking', tier: 'assessment' }
  if (n.includes('listen'))                        return { icon: '🎧', color: '#4BACC6', label: 'Listening',   tier: 'assessment' }
  if (n.includes('writ') || n.includes('escrit'))  return { icon: '✍️', color: '#9BBB59', label: 'Writing',    tier: 'assessment' }
  if (n.includes('vocab'))                         return { icon: '🔤', color: '#9BBB59', label: 'Vocabulary', tier: 'routine' }
  if (n.includes('workshop') || n.includes('taller')) return { icon: '🔧', color: '#F79646', label: 'Workshop', tier: 'routine' }
  if (n.includes('exit') || n.includes('ticket'))  return { icon: '🚪', color: '#1F497D', label: 'Exit Ticket', tier: 'routine' }
  if (n.includes('entrega') || n.includes('due') || n.includes('submit')) return { icon: '🏁', color: '#C0504D', label: 'Entrega', tier: 'entrega' }
  return { icon: '📋', color: '#888', label: 'Actividad', tier: 'routine' }
}

// ── API Constants ─────────────────────────────────────────────────────────────
export const AI_MODEL = 'claude-sonnet-4-20250514'
export const MAX_AI_TOKENS = {
  suggest: 2000,
  analyze: 4000,
  generate: 16000,
  rubric: 4000,
  smartBlock: 1200,
  indicadores: 700,
}
