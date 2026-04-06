// ── Guide Editor shared utilities ─────────────────────────────────────────────
// Used by GuideEditorPage.jsx and DayPanel.jsx.

import { SECTIONS } from './constants'
import { formatDateEN } from './dateUtils'

export function buildEmptySection(time) {
  return { time, content: '', images: [], audios: [], videos: [], smartBlocks: [] }
}

export function buildEmptyDay(isoDate) {
  const sections = {}
  SECTIONS.forEach(s => { sections[s.key] = buildEmptySection(s.time) })
  return { active: true, date_label: formatDateEN(isoDate), class_periods: '', unit: '', sections }
}
