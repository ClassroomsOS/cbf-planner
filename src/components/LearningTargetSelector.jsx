import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

// ── LearningTargetSelector ──────────────────────────────────────────────────
// Drop-in component for GuideEditorPage's "Objetivo" panel.
// Shows active targets for the guide's subject/grade/period and lets the
// teacher link a target to the current lesson plan.
//
// Props:
//   planId    – lesson plan UUID
//   subject   – e.g. 'Language Arts'
//   grade     – e.g. '8vo'
//   period    – e.g. 1
//   schoolId  – school UUID
//   teacherId – teacher UUID
//   currentTargetId – currently linked target UUID (or null)
//   onChange  – callback(targetId | null) when selection changes

const TAXONOMY_EMOJI = { recognize: '👁️', apply: '🛠️', produce: '✨' }

export default function LearningTargetSelector({
  planId, subject, grade, period, schoolId, teacherId,
  currentTargetId, onChange,
  trimestre,  // optional — if provided, highlights targets of that trimestre
}) {
  const navigate = useNavigate()
  const [targets,  setTargets]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    loadTargets()
  }, [subject, grade, period, schoolId])

  async function loadTargets() {
    setLoading(true)
    // Fetch all active targets for this subject + school
    // then filter client-side for flexible grade/group matching
    const { data } = await supabase
      .from('learning_targets')
      .select('id, description, taxonomy, grade, group_name, prerequisite_ids, trimestre, tematica_names')
      .eq('school_id', schoolId)
      .eq('subject', subject)
      .eq('is_active', true)
      .order('period', { ascending: true })

    // Flexible match: guide grade might be "7.° Blue" while target has
    // grade="7.°" and group_name="Blue" separately
    const filtered = (data || []).filter(t => {
      if (t.grade === grade) return true
      if (grade.startsWith(t.grade)) {
        if (t.group_name) return grade.includes(t.group_name)
        return true
      }
      return false
    })

    // Sort: trimestre match first, then rest
    if (trimestre) {
      filtered.sort((a, b) => {
        const aMatch = a.trimestre === trimestre ? -1 : 0
        const bMatch = b.trimestre === trimestre ? -1 : 0
        return aMatch - bMatch
      })
    }

    setTargets(filtered)
    setLoading(false)
  }

  const selectedTarget = useMemo(() => {
    if (!currentTargetId) return null
    return targets.find(t => t.id === currentTargetId) || null
  }, [targets, currentTargetId])

  async function handleSelect(targetId) {
    // Update lesson_plans.target_id in DB
    await supabase
      .from('lesson_plans')
      .update({ target_id: targetId })
      .eq('id', planId)
    const target = targets.find(t => t.id === targetId) || null
    onChange(targetId, target)
    setExpanded(false)
  }

  async function handleClear() {
    await supabase
      .from('lesson_plans')
      .update({ target_id: null })
      .eq('id', planId)
    onChange(null, null)
  }

  if (loading) {
    return (
      <div style={{ padding: '12px', color: '#888', fontSize: '13px' }}>
        Cargando logros…
      </div>
    )
  }

  return (
    <div className="ge-field" style={{ marginBottom: '16px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        🎯 Logro de desempeño vinculado
      </label>

      {/* Current selection */}
      {selectedTarget ? (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          padding: '10px 14px', background: '#f0f7f0', borderRadius: '8px',
          border: '1px solid #b5d6b5',
        }}>
          <span style={{ fontSize: '18px', lineHeight: '1.4' }}>
            {TAXONOMY_EMOJI[selectedTarget.taxonomy] || '🛠️'}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', color: '#1a5c1a', fontWeight: 600, lineHeight: '1.4' }}>
              {selectedTarget.description}
            </div>
            {selectedTarget.group_name && (
              <span style={{
                fontSize: '11px', color: '#666', marginTop: '4px',
                display: 'inline-block', background: '#e8e8e8', padding: '1px 8px',
                borderRadius: '4px',
              }}>
                {selectedTarget.group_name}
              </span>
            )}
          </div>
          <button
            onClick={handleClear}
            style={{
              background: 'none', border: 'none', fontSize: '16px',
              color: '#999', cursor: 'pointer', padding: '0 4px',
            }}
            title="Desvincular logro"
          >
            ✕
          </button>
        </div>
      ) : (
        <div style={{
          padding: '10px 14px', background: '#fef9ee', borderRadius: '8px',
          border: '1px dashed #d4b96a', fontSize: '13px', color: '#8a7030',
        }}>
          Ningún logro vinculado — esta guía no tiene un ancla de desempeño.
        </div>
      )}

      {/* Toggle list */}
      {targets.length > 0 && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            marginTop: '8px', fontSize: '12px', padding: '5px 14px',
            borderRadius: '7px', border: '1px solid #c5d5f0',
            background: expanded ? '#e8eef8' : '#f0f4ff',
            color: '#2E5598', cursor: 'pointer', fontWeight: 600,
          }}
        >
          {expanded ? '▲ Cerrar selector' : `🎯 Elegir logro (${targets.length} disponibles)`}
        </button>
      )}

      {targets.length === 0 && !selectedTarget && (
        <p style={{ fontSize: '12px', color: '#999', marginTop: '6px' }}>
          No hay logros activos para {subject} · {grade}.{' '}
          <a
            href="#"
            onClick={e => { e.preventDefault(); navigate('/targets') }}
            style={{ color: '#2E5598' }}
          >
            Crear uno →
          </a>
        </p>
      )}

      {/* Expandable target list */}
      {expanded && (
        <div style={{
          marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px',
          maxHeight: '240px', overflowY: 'auto', paddingRight: '4px',
        }}>
          {targets.map(t => {
            const isSelected   = t.id === currentTargetId
            const isSameTrim   = trimestre && t.trimestre === trimestre
            return (
              <button
                key={t.id}
                onClick={() => handleSelect(t.id)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '8px',
                  padding: '8px 12px', borderRadius: '8px', textAlign: 'left',
                  border: isSelected ? '2px solid #2E5598' : isSameTrim ? '1px solid #9BBB59' : '1px solid #dde3f0',
                  background: isSelected ? '#eef2fa' : isSameTrim ? '#f6fff0' : '#fff',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: '16px', marginTop: '1px' }}>
                  {TAXONOMY_EMOJI[t.taxonomy] || '🛠️'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#333', lineHeight: '1.4' }}>
                    {t.description}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                    {t.group_name && (
                      <span style={{
                        fontSize: '10px', color: '#888',
                        background: '#f0f0f0', padding: '1px 6px', borderRadius: '4px',
                      }}>
                        {t.group_name}
                      </span>
                    )}
                    {t.trimestre && (
                      <span style={{
                        fontSize: '10px', fontWeight: 600,
                        color: isSameTrim ? '#1A5C1A' : '#888',
                        background: isSameTrim ? '#d4edda' : '#f0f0f0',
                        padding: '1px 6px', borderRadius: '4px',
                      }}>
                        T{t.trimestre}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
