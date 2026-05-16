// ── Guide Editor shared utilities ─────────────────────────────────────────────
// Used by GuideEditorPage.jsx and DayPanel.jsx.

import { SECTIONS } from './constants'
import { formatDateEN } from './dateUtils'

/**
 * Builds an empty section object.
 *
 * The section supports two content systems — both coexist for backward compat:
 *   • Legacy:  `content` (HTML string from TipTap) + `smartBlocks[]`
 *   • GXE:     `blocks[]` (typed block objects from blockSchema.js)
 *
 * ClassroomOS and exportDocx check `blocks.length > 0` first.
 * If empty, they fall back to `content` (legacy behavior).
 */
export function buildEmptySection(time) {
  return {
    time,
    // ── Legacy fields (backward compatible) ──────────────────────────
    content:     '',
    images:      [],
    audios:      [],
    videos:      [],
    smartBlocks: [],
    // ── GXE block system ─────────────────────────────────────────────
    blocks:      [],
  }
}

/**
 * Returns true if this section has GXE blocks (vs. legacy HTML content).
 * Used by DayPanel to decide which editor mode to show.
 */
export function sectionHasBlocks(section) {
  return Array.isArray(section?.blocks) && section.blocks.length > 0
}

export function buildEmptyDay(isoDate) {
  const sections = {}
  SECTIONS.forEach(s => { sections[s.key] = buildEmptySection(s.time) })
  return { active: true, date_label: formatDateEN(isoDate), class_periods: '', unit: '', sections }
}
