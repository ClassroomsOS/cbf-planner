import { useMemo } from 'react'

// ── eleot® Domain definitions ────────────────────────────────────────────────
export const ELEOT_DOMAINS = {
  A: { label: 'Equitable',    full: 'Equitable Learning',    color: '#4BACC6', bg: '#EBF7FC' },
  B: { label: 'High Expect.', full: 'High Expectations',     color: '#9BBB59', bg: '#F3F8EB' },
  C: { label: 'Supportive',   full: 'Supportive Learning',   color: '#8064A2', bg: '#F3F0F8' },
  D: { label: 'Active',       full: 'Active Learning',       color: '#F79646', bg: '#FEF5EC' },
  E: { label: 'Progress',     full: 'Progress Monitoring',   color: '#C0504D', bg: '#FDF0F0' },
  F: { label: 'Well-Managed', full: 'Well-Managed Learning', color: '#1F3864', bg: '#EEF1F8' },
  G: { label: 'Digital',      full: 'Digital Learning',      color: '#17375E', bg: '#EEF3F8' },
}

// ── Items per domain (for coverage denominator) ──────────────────────────────
const DOMAIN_ITEMS = {
  A: ['A1','A2','A3','A4'],
  B: ['B1','B2','B3','B4','B5'],
  C: ['C1','C2','C3','C4'],
  D: ['D1','D2','D3','D4'],
  E: ['E1','E2','E3','E4'],
  F: ['F1','F2','F3','F4'],
  G: ['G1','G2','G3'],
}

// ── Block type → item weights (lowercase block types) ────────────────────────
export const BLOCK_MAPPING = {
  dictation:           { D3: 1.0, E3: 0.8, F4: 0.7 },
  quiz:                { B2: 1.0, E1: 0.9, E3: 1.0, B4: 0.6 },
  vocabulary:          { D3: 0.8, B2: 0.7, E3: 0.8 },
  workshop:            { D3: 1.0, D4: 1.0, B4: 1.0, C3: 0.8 },
  speaking:            { D1: 1.0, B4: 0.9, D3: 1.0, G3: 0.7 },
  notice:              { F4: 0.8, F3: 0.7 },
  exit_ticket:         { E1: 1.0, E4: 1.0, B5: 0.7 },
  reading:             { D3: 0.9, B4: 0.8, D2: 0.7, E3: 0.8 },
  grammar:             { B2: 0.8, E3: 0.8, D3: 0.7, E1: 0.6 },
  writing:             { D3: 1.0, B4: 0.9, B3: 0.8, E2: 0.7 },
  self_assessment:     { E1: 1.0, E2: 1.0, E4: 1.0, B5: 0.9 },
  peer_review:         { C3: 1.0, E2: 0.9, D1: 0.8, C2: 0.7 },
  digital_resource:    { G1: 1.0, G2: 0.8, D3: 0.7 },
  collaborative_task:  { D4: 1.0, D1: 0.9, C3: 0.8, A2: 0.7 },
  real_life_connection:{ D2: 1.0, D3: 0.8, B4: 0.7 },
  teacher_note:        { A1: 0.8, A3: 0.7 },
}

// ── Suggestion: which block type covers each domain best ─────────────────────
const DOMAIN_SUGGESTION = {
  A: { type: 'TEACHER_NOTE',        label: 'Teacher Note',         reason: 'diferenciación + claridad instrucciones' },
  B: { type: 'QUIZ',                label: 'Quiz',                 reason: 'desafío alcanzable + pensamiento de orden superior' },
  C: { type: 'WORKSHOP',            label: 'Workshop (Roles)',      reason: 'pares como recurso + apoyo colaborativo' },
  D: { type: 'WORKSHOP',            label: 'Workshop (Estaciones)', reason: 'aprendizaje activo + colaboración' },
  E: { type: 'EXIT_TICKET',         label: 'Exit Ticket',          reason: 'automonitoreo + saber cómo los evalúan' },
  F: { type: 'NOTICE',              label: 'Notice',               reason: 'transiciones claras + tiempo sin desperdicios' },
  G: { type: 'DIGITAL_RESOURCE',    label: 'Digital Resource',     reason: 'herramientas digitales para aprender y crear' },
}

// ── Core computation ─────────────────────────────────────────────────────────
function computeCoverage(blocks) {
  // Max weight per item across all blocks
  const itemScores = {}
  for (const block of blocks) {
    const type = (block.type || '').toLowerCase()
    const mapping = BLOCK_MAPPING[type] || {}
    for (const [item, weight] of Object.entries(mapping)) {
      itemScores[item] = Math.max(itemScores[item] || 0, weight)
    }
  }

  // Per domain: sum of item scores / number of items in domain
  const coverage = {}
  for (const [domain, items] of Object.entries(DOMAIN_ITEMS)) {
    const sum = items.reduce((s, item) => s + (itemScores[item] || 0), 0)
    coverage[domain] = items.length > 0 ? sum / items.length : 0
  }

  return coverage
}

// ── Status thresholds ────────────────────────────────────────────────────────
export function domainStatus(score) {
  if (score >= 0.65) return 'covered'   // ✓ cubierto
  if (score >= 0.30) return 'partial'   // ◎ parcial
  return 'weak'                          // ⚠ débil
}

// ── useEleot ─────────────────────────────────────────────────────────────────
// Parámetros:
//   content  — lesson_plan.content JSONB (days → sections → smartBlocks)
//
// Retorna:
//   coverage      — { A: 0.0–1.0, B: …, … }
//   weakDomains   — ['C', 'G'] (coverage < 0.30)
//   partialDomains— ['A', 'F'] (0.30 ≤ coverage < 0.65)
//   blockCount    — total smart blocks in the guide
//   suggestions   — [{ domain, suggestion }] para dominios débiles
//   overallScore  — promedio de los 7 dominios (0–1)
// ─────────────────────────────────────────────────────────────────────────────
export default function useEleot(content) {
  const allBlocks = useMemo(() => {
    if (!content?.days) return []
    const blocks = []
    for (const day of Object.values(content.days)) {
      if (!day?.active === false) continue  // skip explicitly inactive days
      if (!day?.sections) continue
      for (const section of Object.values(day.sections)) {
        blocks.push(...(section.smartBlocks || []))
      }
    }
    return blocks
  }, [content?.days])

  const coverage = useMemo(() => computeCoverage(allBlocks), [allBlocks])

  const weakDomains = useMemo(() =>
    Object.keys(ELEOT_DOMAINS).filter(d => domainStatus(coverage[d]) === 'weak'),
    [coverage]
  )

  const partialDomains = useMemo(() =>
    Object.keys(ELEOT_DOMAINS).filter(d => domainStatus(coverage[d]) === 'partial'),
    [coverage]
  )

  const suggestions = useMemo(() =>
    weakDomains.map(d => ({
      domain: d,
      domainLabel: ELEOT_DOMAINS[d].label,
      suggestion: DOMAIN_SUGGESTION[d],
    })),
    [weakDomains]
  )

  const overallScore = useMemo(() => {
    const vals = Object.values(coverage)
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
  }, [coverage])

  return {
    coverage,
    weakDomains,
    partialDomains,
    blockCount: allBlocks.length,
    suggestions,
    overallScore,
  }
}
