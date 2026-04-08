// ── PeriodCoverageDashboard.jsx ───────────────────────────────────────────────
// Aggregates eleot® domain coverage across all lesson plans for a period.
// Computes coverage client-side from smart block types (static mapping).
// Admin sees all teachers; teacher sees own plans only.

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { canReadAllPlans } from '../utils/roles'

// ── Static eleot® definitions (mirrors CLAUDE.md seed — Sesión C tables) ──────
const DOMAINS = {
  A: { label: 'Learning Environment',    color: '#2E5598' },
  B: { label: 'Student Engagement',      color: '#9BBB59' },
  C: { label: 'Collaborative Learning',  color: '#F79646' },
  D: { label: 'Cognitive Complexity',    color: '#8064A2' },
  E: { label: 'Assessment',              color: '#C0504D' },
  F: { label: 'Communication',           color: '#4BACC6' },
  G: { label: 'Technology Integration',  color: '#1A6B3A' },
}

const BLOCK_ELEOT = {
  DICTATION:            ['D3', 'E3', 'F4'],
  QUIZ:                 ['B2', 'E1', 'E3'],
  VOCAB:                ['D3', 'B2', 'E3'],
  WORKSHOP:             ['D3', 'D4', 'B4', 'C3'],
  SPEAKING:             ['D1', 'B4', 'G3'],
  NOTICE:               ['F4', 'F3'],
  READING:              ['D3', 'B4', 'D2', 'E3'],
  GRAMMAR:              ['D3', 'B2', 'E3'],
  EXIT_TICKET:          ['E1', 'E2', 'E4'],
  WRITING:              ['D3', 'B4', 'B3', 'E2'],
  SELF_ASSESSMENT:      ['E1', 'E2', 'E4', 'B5'],
  PEER_REVIEW:          ['C3', 'E2', 'D1', 'C2'],
  DIGITAL_RESOURCE:     ['G1', 'G2', 'D3'],
  COLLABORATIVE_TASK:   ['D4', 'D1', 'C3', 'A2'],
  REAL_LIFE_CONNECTION: ['D2', 'D3', 'B4'],
  TEACHER_NOTE:         ['A1', 'A3'],
}

// Extract all block types used in a plan's content
function extractBlockTypes(content) {
  const types = new Set()
  if (!content?.days) return types
  for (const day of Object.values(content.days)) {
    if (!day?.sections) continue
    for (const section of Object.values(day.sections)) {
      for (const block of section.smartBlocks || []) {
        if (block.type) types.add(block.type.toUpperCase())
      }
    }
  }
  return types
}

// Build domain hit-set from a set of block types
function domainCoverage(blockTypes) {
  const domainItems = {} // domain → Set of items
  for (const [domain] of Object.entries(DOMAINS)) domainItems[domain] = new Set()
  for (const type of blockTypes) {
    const items = BLOCK_ELEOT[type] || []
    for (const item of items) {
      const domain = item[0] // first char: A, B, C…
      if (domainItems[domain]) domainItems[domain].add(item)
    }
  }
  return domainItems
}

// Grade/saturation levels
function coverageLevel(count) {
  if (count === 0) return { label: 'Sin cobertura', color: '#E5E7EB', text: '#9CA3AF' }
  if (count <= 1)  return { label: 'Básica',        color: '#FEF9C3', text: '#854D0E' }
  if (count <= 2)  return { label: 'Buena',         color: '#DCFCE7', text: '#14532D' }
  return              { label: 'Óptima',         color: '#BBF7D0', text: '#14532D' }
}

export default function PeriodCoverageDashboard({ teacher }) {
  const canSeeAll = canReadAllPlans(teacher.role)

  const [plans,    setPlans]    = useState([])
  const [teachers, setTeachers] = useState({})
  const [loading,  setLoading]  = useState(true)
  const [period,   setPeriod]   = useState('')
  const [grade,    setGrade]    = useState('')
  const [subject,  setSubject]  = useState('')
  const [selTeacher, setSelTeacher] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: trows } = await supabase
      .from('teachers')
      .select('id, full_name')
      .eq('school_id', teacher.school_id)
    const tmap = {}
    for (const t of trows || []) tmap[t.id] = t
    setTeachers(tmap)

    let q = supabase
      .from('lesson_plans')
      .select('id, grade, subject, period, teacher_id, content, session_agenda, week_number')
      .order('period').order('grade').order('subject')

    if (!canSeeAll) q = q.eq('teacher_id', teacher.id)

    const { data } = await q.limit(300)
    const filtered = canSeeAll
      ? (data || []).filter(p => tmap[p.teacher_id])
      : (data || [])
    setPlans(filtered)
    setLoading(false)
  }

  const periods  = [...new Set(plans.map(p => p.period).filter(Boolean))].sort()
  const grades   = [...new Set(plans.map(p => p.grade).filter(Boolean))].sort()
  const subjects = [...new Set(plans.map(p => p.subject).filter(Boolean))].sort()

  const filtered = plans.filter(p => {
    if (period    && String(p.period)  !== String(period))    return false
    if (grade     && p.grade           !== grade)             return false
    if (subject   && p.subject         !== subject)           return false
    if (selTeacher && p.teacher_id     !== selTeacher)        return false
    return true
  })

  // ── Aggregate coverage ─────────────────────────────────────────────────────
  // Per plan: collect all block types → map to domains → per-domain item union
  const aggDomainItems = {}
  for (const domain of Object.keys(DOMAINS)) aggDomainItems[domain] = new Set()

  const blockTypeFreq = {}  // type → count of plans using it

  for (const plan of filtered) {
    const types = extractBlockTypes(plan.content)
    for (const type of types) {
      blockTypeFreq[type] = (blockTypeFreq[type] || 0) + 1
    }
    const cov = domainCoverage(types)
    for (const [domain, items] of Object.entries(cov)) {
      for (const item of items) aggDomainItems[domain].add(item)
    }
  }

  const totalPlans = filtered.length

  return (
    <div style={{ padding: '24px 28px', maxWidth: 960 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, color: '#1F3864', fontWeight: 700 }}>
          🔭 Cobertura eleot® del Período
        </h2>
        <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>
          Análisis agregado de dominios Cognia® cubiertos por Smart Blocks en{' '}
          {totalPlans} guía{totalPlans !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { key: 'period',  label: 'Período',  val: period,  set: setPeriod,  opts: periods },
          { key: 'grade',   label: 'Grado',    val: grade,   set: setGrade,   opts: grades },
          { key: 'subject', label: 'Materia',  val: subject, set: setSubject, opts: subjects },
        ].map(({ key, label, val, set, opts }) => (
          <select
            key={key}
            value={val}
            onChange={e => set(e.target.value)}
            style={{
              padding: '7px 10px', borderRadius: 8, border: '1px solid #D0D5DD',
              fontSize: 13, background: '#fff', cursor: 'pointer',
            }}
          >
            <option value="">{label}: todos</option>
            {opts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        {canSeeAll && (
          <select
            value={selTeacher}
            onChange={e => setSelTeacher(e.target.value)}
            style={{
              padding: '7px 10px', borderRadius: 8, border: '1px solid #D0D5DD',
              fontSize: 13, background: '#fff', cursor: 'pointer',
            }}
          >
            <option value="">Docente: todos</option>
            {Object.values(teachers).map(t => (
              <option key={t.id} value={t.id}>{t.full_name}</option>
            ))}
          </select>
        )}
      </div>

      {loading && <p style={{ color: '#888', fontStyle: 'italic' }}>Calculando cobertura…</p>}

      {!loading && (
        <>
          {/* Domain coverage heatmap */}
          <div style={{
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
            padding: '20px', marginBottom: 20,
            boxShadow: '0 1px 4px rgba(0,0,0,.06)',
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, color: '#1F3864' }}>
              Cobertura por Dominio eleot®
            </h3>
            {Object.entries(DOMAINS).map(([key, domain]) => {
              const items = aggDomainItems[key]
              const count = items.size
              const lv    = coverageLevel(count)
              const pct   = Math.min(100, count * 20) // 5 items → 100%

              return (
                <div key={key} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{
                      background: domain.color, color: '#fff',
                      borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700,
                      minWidth: 24, textAlign: 'center', flexShrink: 0,
                    }}>{key}</span>
                    <span style={{ fontSize: 13, color: '#374151', flex: 1 }}>{domain.label}</span>
                    <span style={{
                      background: lv.color, color: lv.text,
                      borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600,
                    }}>{lv.label}</span>
                    <span style={{ fontSize: 12, color: '#94A3B8', minWidth: 60, textAlign: 'right' }}>
                      {count} ítem{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {/* Bar */}
                  <div style={{
                    height: 8, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', width: `${pct}%`, background: domain.color,
                      borderRadius: 4, transition: 'width .4s ease',
                    }} />
                  </div>
                  {count > 0 && (
                    <div style={{ marginTop: 3, fontSize: 11, color: '#94A3B8' }}>
                      {[...items].sort().join(' · ')}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Block type frequency */}
          {Object.keys(blockTypeFreq).length > 0 && (
            <div style={{
              background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
              padding: '20px', marginBottom: 20,
              boxShadow: '0 1px 4px rgba(0,0,0,.06)',
            }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, color: '#1F3864' }}>
                Smart Blocks más usados
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(blockTypeFreq)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, cnt]) => (
                    <div key={type} style={{
                      background: '#F8FAFC', border: '1px solid #E2E8F0',
                      borderRadius: 8, padding: '6px 12px',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                        {type}
                      </span>
                      <span style={{
                        background: '#EEF2FF', color: '#2E5598',
                        borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700,
                      }}>{cnt}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Missing domains warning */}
          {(() => {
            const missing = Object.entries(DOMAINS)
              .filter(([key]) => aggDomainItems[key].size === 0)
              .map(([key, d]) => `${key} · ${d.label}`)
            if (!missing.length || totalPlans === 0) return null
            return (
              <div style={{
                background: '#FFF8E1', border: '1px solid #FFD54F',
                borderRadius: 10, padding: '14px 18px',
              }}>
                <strong style={{ color: '#7A6200', fontSize: 13 }}>
                  ⚠️ Dominios sin cobertura en la selección actual:
                </strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 20, color: '#7A6200', fontSize: 13 }}>
                  {missing.map(m => <li key={m}>{m}</li>)}
                </ul>
                <p style={{ margin: '8px 0 0', fontSize: 12, color: '#9A7200' }}>
                  Considera agregar Smart Blocks de tipo COLLABORATIVE_TASK, DIGITAL_RESOURCE
                  o TEACHER_NOTE para cubrir los dominios faltantes.
                </p>
              </div>
            )
          })()}

          {totalPlans === 0 && (
            <div style={{
              background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
              padding: '32px', textAlign: 'center', color: '#94A3B8',
            }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📊</div>
              No hay guías para los filtros seleccionados.
            </div>
          )}
        </>
      )}
    </div>
  )
}
