// ── ReviewRoomPage.jsx ────────────────────────────────────────────────────────
// /sala-revision — Admin/Rector view: all school guides organized by grade.
// Each card: status badge, teacher, subject, dates, feedback count.
// Opens GuideEditorPage with "other teacher's guide" banner + justification.
// Admin can also leave feedback via FeedbackModal without editing.

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import FeedbackModal from '../components/FeedbackModal'
import { canGiveFeedback } from '../utils/roles'

const STATUS_META = {
  draft:     { label: 'Borrador',    bg: '#FFF8E1', color: '#7A6200', dot: '#F59E0B' },
  submitted: { label: 'Enviada',     bg: '#EFF6FF', color: '#1D4ED8', dot: '#3B82F6' },
  approved:  { label: 'Aprobada',    bg: '#F0FDF4', color: '#15803D', dot: '#22C55E' },
  published: { label: 'Publicada',   bg: '#ECFDF5', color: '#065F46', dot: '#10B981' },
  archived:  { label: 'Archivada',   bg: '#F5F5F5', color: '#6B7280', dot: '#9CA3AF' },
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.draft
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: m.bg, color: m.color, borderRadius: 5,
      padding: '2px 8px', fontSize: 11, fontWeight: 700,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.dot, display: 'inline-block' }} />
      {m.label}
    </span>
  )
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ReviewRoomPage({ teacher }) {
  const navigate       = useNavigate()
  const canFeedback    = canGiveFeedback(teacher.role)

  const [plans,        setPlans]        = useState([])
  const [teachers,     setTeachers]     = useState({})
  const [feedbackCounts, setFeedbackCounts] = useState({})
  const [loading,      setLoading]      = useState(true)
  const [expanded,     setExpanded]     = useState({})
  const [filters,      setFilters]      = useState({ status: '', subject: '', teacherId: '' })
  const [feedbackPlan, setFeedbackPlan] = useState(null) // plan being reviewed

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)

    // Load teachers map
    const { data: trows } = await supabase
      .from('teachers')
      .select('id, full_name, initials, role')
      .eq('school_id', teacher.school_id)
    const tmap = {}
    for (const t of trows || []) tmap[t.id] = t
    setTeachers(tmap)

    // Load all plans in school (RLS must allow admin SELECT)
    const { data: prows } = await supabase
      .from('lesson_plans')
      .select('id, grade, subject, week_number, week_count, period, status, updated_at, teacher_id, content')
      .order('updated_at', { ascending: false })
      .limit(300)

    const schoolPlans = (prows || []).filter(p => tmap[p.teacher_id])
    setPlans(schoolPlans)

    // Auto-expand grades with non-draft plans
    const grades = [...new Set(schoolPlans.map(p => p.grade).filter(Boolean))]
    const initExpand = {}
    for (const g of grades.slice(0, 3)) initExpand[g] = true
    setExpanded(initExpand)

    // Load feedback counts per plan
    if (schoolPlans.length) {
      const ids = schoolPlans.map(p => p.id)
      const { data: fbrows } = await supabase
        .from('document_feedback')
        .select('entity_id, resolved')
        .in('entity_id', ids)
        .eq('entity_type', 'guide')
      const counts = {}
      for (const fb of fbrows || []) {
        if (!counts[fb.entity_id]) counts[fb.entity_id] = { total: 0, open: 0 }
        counts[fb.entity_id].total++
        if (!fb.resolved) counts[fb.entity_id].open++
      }
      setFeedbackCounts(counts)
    }

    setLoading(false)
  }

  // Filter
  const filtered = plans.filter(p => {
    if (filters.status    && p.status        !== filters.status)    return false
    if (filters.subject   && p.subject       !== filters.subject)   return false
    if (filters.teacherId && p.teacher_id    !== filters.teacherId) return false
    return true
  })

  // Group by grade
  const byGrade = {}
  for (const p of filtered) {
    ;(byGrade[p.grade] = byGrade[p.grade] || []).push(p)
  }
  const grades = Object.keys(byGrade).sort()

  const subjects = [...new Set(plans.map(p => p.subject).filter(Boolean))].sort()
  const statuses = [...new Set(plans.map(p => p.status).filter(Boolean))].sort()

  function toggleGrade(g) { setExpanded(prev => ({ ...prev, [g]: !prev[g] })) }

  function openEditor(plan) {
    navigate(`/editor/${plan.id}`)
  }

  function topicPreview(plan) {
    try {
      return (plan.content?.objetivo?.general || '').replace(/<[^>]+>/g, '').slice(0, 90)
    } catch { return '' }
  }

  const totalOpen = Object.values(feedbackCounts).reduce((n, c) => n + c.open, 0)

  return (
    <div style={{ padding: '24px 28px', maxWidth: 960 }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, color: '#1F3864', fontWeight: 700 }}>
          🏛 Sala de Revisión de Guías
        </h2>
        <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>
          {loading ? '…' : `${plans.length} guías en el colegio`}
          {totalOpen > 0 && (
            <span style={{
              marginLeft: 10, background: '#C0504D', color: '#fff',
              borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700,
            }}>{totalOpen} feedback pendiente</span>
          )}
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
        {[
          { key: 'status',    label: 'Estado',   opts: statuses.map(s => ({ val: s, label: STATUS_META[s]?.label || s })) },
          { key: 'subject',   label: 'Materia',  opts: subjects.map(s => ({ val: s, label: s })) },
        ].map(({ key, label, opts }) => (
          <select key={key} value={filters[key]}
            onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 13, background: '#fff' }}>
            <option value="">{label}: todos</option>
            {opts.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
        ))}
        <select value={filters.teacherId}
          onChange={e => setFilters(f => ({ ...f, teacherId: e.target.value }))}
          style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 13, background: '#fff' }}>
          <option value="">Docente: todos</option>
          {Object.values(teachers).sort((a, b) => a.full_name.localeCompare(b.full_name)).map(t => (
            <option key={t.id} value={t.id}>{t.full_name}</option>
          ))}
        </select>
        {Object.values(filters).some(Boolean) && (
          <button onClick={() => setFilters({ status: '', subject: '', teacherId: '' })}
            style={{
              padding: '7px 12px', borderRadius: 8, border: '1px solid #FCA5A5',
              background: '#FEF2F2', color: '#DC2626', fontSize: 12, cursor: 'pointer',
            }}>✕ Limpiar</button>
        )}
      </div>

      {loading && <p style={{ color: '#888', fontStyle: 'italic' }}>Cargando guías…</p>}

      {!loading && grades.length === 0 && (
        <div style={{
          background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
          padding: '32px', textAlign: 'center', color: '#94A3B8',
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
          No hay guías que coincidan con los filtros.
        </div>
      )}

      {/* Grade groups */}
      {grades.map(grade => {
        const gradePlans = byGrade[grade]
        const isOpen = !!expanded[grade]
        const openFb = gradePlans.reduce((n, p) => n + (feedbackCounts[p.id]?.open || 0), 0)

        return (
          <div key={grade} style={{
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
            marginBottom: 12, overflow: 'hidden',
            boxShadow: '0 1px 4px rgba(0,0,0,.05)',
          }}>
            {/* Grade header */}
            <button
              type="button"
              onClick={() => toggleGrade(grade)}
              style={{
                width: '100%', padding: '13px 18px',
                background: isOpen ? '#F0F4FF' : '#F8FAFC',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 12,
                borderBottom: isOpen ? '1px solid #E2E8F0' : 'none',
              }}
            >
              <span style={{
                background: '#1F3864', color: '#fff',
                borderRadius: 8, padding: '4px 12px', fontWeight: 800, fontSize: 14,
              }}>{grade}</span>
              <span style={{ color: '#64748B', fontSize: 13 }}>
                {gradePlans.length} guía{gradePlans.length !== 1 ? 's' : ''}
              </span>
              {openFb > 0 && (
                <span style={{
                  background: '#C0504D', color: '#fff',
                  borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                }}>{openFb} feedback</span>
              )}
              <span style={{
                marginLeft: 'auto', color: '#94A3B8', fontSize: 18,
                transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s',
              }}>›</span>
            </button>

            {/* Plan cards */}
            {isOpen && (
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {gradePlans.map(plan => {
                  const t     = teachers[plan.teacher_id]
                  const fb    = feedbackCounts[plan.id]
                  const preview = topicPreview(plan)
                  const isOwn   = plan.teacher_id === teacher.id

                  return (
                    <div key={plan.id} style={{
                      border: '1px solid #E8EFF6', borderRadius: 10, padding: '12px 14px',
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      background: isOwn ? '#FAFEFF' : '#fff',
                    }}>
                      {/* Subject + meta */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: '#1F3864' }}>
                            {plan.subject}
                          </span>
                          <span style={{ color: '#94A3B8', fontSize: 12 }}>
                            Sem. {plan.week_number}{plan.week_count === 2 ? '–' + (plan.week_number + 1) : ''} · P{plan.period}
                          </span>
                          <StatusBadge status={plan.status} />
                          {isOwn && (
                            <span style={{
                              background: '#E0F2FE', color: '#0369A1',
                              borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700,
                            }}>Mi guía</span>
                          )}
                          {fb?.open > 0 && (
                            <span style={{
                              background: '#FEE2E2', color: '#DC2626',
                              borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700,
                            }}>💬 {fb.open} abierto{fb.open !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                        {preview && (
                          <p style={{
                            margin: 0, fontSize: 12, color: '#64748B',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>{preview}</p>
                        )}
                      </div>

                      {/* Teacher + date */}
                      <div style={{
                        textAlign: 'right', flexShrink: 0, fontSize: 12, color: '#64748B', minWidth: 100,
                      }}>
                        {t && (
                          <div style={{ fontWeight: 600, color: '#374151', marginBottom: 2 }}>
                            {t.full_name?.split(' ').slice(0, 2).join(' ')}
                          </div>
                        )}
                        <div style={{ fontSize: 11 }}>{formatDate(plan.updated_at)}</div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => openEditor(plan)}
                          style={{
                            padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                            background: '#1F3864', color: '#fff', border: 'none', cursor: 'pointer',
                          }}
                        >
                          ✏️ Abrir
                        </button>
                        {canFeedback && (
                          <button
                            type="button"
                            onClick={() => setFeedbackPlan(plan)}
                            style={{
                              padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                              background: fb?.open > 0 ? '#FEF2F2' : '#F8FAFC',
                              color: fb?.open > 0 ? '#DC2626' : '#374151',
                              border: `1px solid ${fb?.open > 0 ? '#FCA5A5' : '#E2E8F0'}`,
                              cursor: 'pointer',
                            }}
                          >
                            💬 Feedback
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Feedback Modal */}
      {feedbackPlan && (
        <FeedbackModal
          entityType="guide"
          entityId={feedbackPlan.id}
          entityTitle={`${feedbackPlan.grade} · ${feedbackPlan.subject} · Sem. ${feedbackPlan.week_number}`}
          teacher={teacher}
          onClose={() => { setFeedbackPlan(null); load() }}
        />
      )}
    </div>
  )
}
