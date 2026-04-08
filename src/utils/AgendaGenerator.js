// ── AgendaGenerator.js ────────────────────────────────────────────────────────
// Generates session_agenda from lesson_plan.content (smart blocks + section data).
// Pure JS — no React, no network calls.
// Output is stored in lesson_plans.session_agenda (JSONB array).

// ── Default durations (minutes) if not set on block/section ──────────────────
const SECTION_DEFAULTS = {
  subject:    8,
  motivation: 8,
  activity:   15,
  skill:      40,
  closing:    8,
  assignment: 5,
}

const SECTION_LABELS = {
  subject:    'Subject to be Worked',
  motivation: 'Motivation',
  activity:   'Activity',
  skill:      'Skill Development',
  closing:    'Closing',
  assignment: 'Assignment',
}

const BLOCK_LABELS = {
  DICTATION:            'Dictation / Listening',
  QUIZ:                 'Quiz / Evaluación',
  VOCAB:                'Vocabulary',
  WORKSHOP:             'Workshop',
  SPEAKING:             'Speaking Project',
  NOTICE:               'Notice',
  READING:              'Reading Comprehension',
  GRAMMAR:              'Grammar Practice',
  EXIT_TICKET:          'Exit Ticket',
  WRITING:              'Writing Task',
  SELF_ASSESSMENT:      'Self-Assessment',
  PEER_REVIEW:          'Peer Review',
  DIGITAL_RESOURCE:     'Digital Resource',
  COLLABORATIVE_TASK:   'Collaborative Task',
  REAL_LIFE_CONNECTION: 'Real-Life Connection',
  TEACHER_NOTE:         'Teacher Note',
}

const BLOCK_DEFAULT_MINUTES = {
  DICTATION:            15,
  QUIZ:                 20,
  VOCAB:                12,
  WORKSHOP:             20,
  SPEAKING:             15,
  NOTICE:               3,
  READING:              20,
  GRAMMAR:              15,
  EXIT_TICKET:          8,
  WRITING:              20,
  SELF_ASSESSMENT:      8,
  PEER_REVIEW:          10,
  DIGITAL_RESOURCE:     15,
  COLLABORATIVE_TASK:   20,
  REAL_LIFE_CONNECTION: 10,
  TEACHER_NOTE:         0,  // invisible — no student time
}

// ── Core: build agenda for a single day ──────────────────────────────────────
function buildDayAgenda(dayData) {
  const SECTION_ORDER = ['subject','motivation','activity','skill','closing','assignment']
  const agenda = []

  for (const key of SECTION_ORDER) {
    const section = dayData.sections?.[key]
    if (!section) continue

    const blocks = section.smartBlocks || []
    const blockItems = blocks.map(b => ({
      type:             b.type,
      model:            b.model,
      label:            BLOCK_LABELS[b.type] || b.type,
      duration_minutes: b.duration_minutes || BLOCK_DEFAULT_MINUTES[b.type] || 10,
    }))

    // Section total: explicit section.time override, or sum of block durations, or default
    let sectionMin = SECTION_DEFAULTS[key] || 10
    if (blocks.length > 0) {
      const blockTotal = blockItems.reduce((s, b) => s + b.duration_minutes, 0)
      sectionMin = Math.max(sectionMin, blockTotal)
    }

    agenda.push({
      section:          key,
      label:            SECTION_LABELS[key],
      duration_minutes: sectionMin,
      blocks:           blockItems,
      has_content:      !!(section.content && section.content.replace(/<[^>]+>/g,'').trim()),
    })
  }

  return agenda
}

// ── Public: build full agenda from content.days ───────────────────────────────
// Returns: { 'YYYY-MM-DD': AgendaItem[], … }
export function buildSessionAgenda(content) {
  if (!content?.days) return {}
  const result = {}
  for (const [dateKey, day] of Object.entries(content.days)) {
    if (day?.active === false) continue
    result[dateKey] = buildDayAgenda(day)
  }
  return result
}

// ── Total duration for a day agenda ──────────────────────────────────────────
export function totalMinutes(dayAgenda) {
  return (dayAgenda || []).reduce((s, item) => s + item.duration_minutes, 0)
}

// ── Text summary (for DOCX / display) ────────────────────────────────────────
export function agendaToText(dayAgenda) {
  if (!dayAgenda?.length) return ''
  let time = 0
  return dayAgenda.map(item => {
    const start = time
    time += item.duration_minutes
    const pad = (n) => String(n).padStart(2,'0')
    const h = Math.floor(start / 60); const m = start % 60
    const timeStr = item.duration_minutes > 0 ? `${pad(h)}:${pad(m)} – ${item.duration_minutes} min` : ''
    const blocks = item.blocks.length
      ? ` [${item.blocks.map(b => b.label).join(', ')}]`
      : ''
    return `${item.label}${blocks}: ${timeStr}`
  }).join('\n')
}

// ── Session agenda as flat array for DB storage ───────────────────────────────
// Returns flat array suitable for lesson_plans.session_agenda jsonb column.
export function flattenAgendaForDb(agendaByDay) {
  const rows = []
  for (const [dateKey, items] of Object.entries(agendaByDay)) {
    for (const item of items) {
      rows.push({ date: dateKey, ...item })
    }
  }
  return rows
}
