// ── constants.js ──────────────────────────────────────────────────────────────
// Shared constants across CBF Planner

// ── CBF Section Configuration ─────────────────────────────────────────────────
export const SECTIONS = [
  { key: 'subject',    label: 'SUBJECT TO BE WORKED', short: 'SUBJECT',  hex: '#4F81BD', time: '~8 min'  },
  { key: 'motivation', label: 'MOTIVATION',            short: 'MOTIV.',   hex: '#4BACC6', time: '~8 min'  },
  { key: 'activity',   label: 'ACTIVITY',              short: 'ACTIVITY', hex: '#F79646', time: '~15 min' },
  { key: 'skill',      label: 'SKILL DEVELOPMENT',     short: 'SKILL',    hex: '#8064A2', time: '~40 min' },
  { key: 'closing',    label: 'CLOSING',               short: 'CLOSING',  hex: '#9BBB59', time: '~8 min'  },
  { key: 'assignment', label: 'ASSIGNMENT',            short: 'ASSIGN.',  hex: '#4E84A2', time: '~5 min'  },
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
export const ACADEMIC_PERIODS = [
  { value: '1', label: '1.er Período 2026', short: 'P1' },
  { value: '2', label: '2.° Período 2026',  short: 'P2' },
  { value: '3', label: '3.er Período 2026', short: 'P3' },
  { value: '4', label: '4.° Período 2026',  short: 'P4' },
]

// ── Modelo B — Materias en inglés (estructura pedagógica diferente) ───────────
// Language Arts, Social Studies y Science usan competencias/habilidades/operadores
// en lugar de Logro + Temáticas del Modelo A. Úsalo para mostrar UI diferente.
export const MODELO_B_SUBJECTS = ['Language Arts', 'Social Studies', 'Science']

// ── Default Subject List ──────────────────────────────────────────────────────
export const DEFAULT_SUBJECTS = [
  'Language Arts',
  'Science',
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
