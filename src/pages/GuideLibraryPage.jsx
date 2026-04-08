// ── GuideLibraryPage.jsx ──────────────────────────────────────────────────────
// Browsable library of all lesson plans in the school.
// Admin: sees all guides. Teacher: sees own + others' (read-only).
// Filter by grade, subject, period, teacher.

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { canReadAllPlans } from '../utils/roles'

const STATUS_COLORS = {
  draft:     { bg: '#FFF8E1', color: '#7A6200', label: 'Borrador' },
  complete:  { bg: '#EFF6FF', color: '#1D4ED8', label: 'Completa' },
  submitted: { bg: '#EEF2FF', color: '#4338CA', label: 'Enviada' },
  approved:  { bg: '#F0FDF4', color: '#15803D', label: 'Aprobada' },
  published: { bg: '#E8F5E9', color: '#1B5E20', label: 'Publicada' },
  archived:  { bg: '#F5F5F5', color: '#757575', label: 'Archivada' },
}

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.draft
  return (
    <span style={{
      background: s.bg, color: s.color, borderRadius: 4,
      padding: '2px 7px', fontSize: 11, fontWeight: 600,
    }}>{s.label}</span>
  )
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function GuideLibraryPage({ teacher }) {
  const navigate   = useNavigate()
  const canSeeAll  = canReadAllPlans(teacher.role)

  const [plans,    setPlans]    = useState([])
  const [teachers, setTeachers] = useState({})
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [filters,  setFilters]  = useState({ grade: '', subject: '', period: '', status: '' })
  const [page,     setPage]     = useState(0)
  const PAGE_SIZE = 20

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)

    // Load teachers map
    const { data: trows } = await supabase
      .from('teachers')
      .select('id, full_name, initials')
      .eq('school_id', teacher.school_id)
    const tmap = {}
    for (const t of trows || []) tmap[t.id] = t
    setTeachers(tmap)

    // Load plans
    let q = supabase
      .from('lesson_plans')
      .select('id, grade, subject, period, week_number, week_count, status, updated_at, teacher_id, content')
      .order('updated_at', { ascending: false })

    if (!canSeeAll) {
      // Teachers only see their own school via RLS; no extra filter needed
      // but we still limit to teacher's own to respect intent
      q = q.eq('teacher_id', teacher.id)
    } else {
      // Admin: filter by school via teacher_id join (RLS handles it)
      // We filter client-side by checking teacher map
    }

    const { data } = await q.limit(200)
    // For admins, filter to same school using the teacher map
    const filtered = canSeeAll
      ? (data || []).filter(p => tmap[p.teacher_id])
      : (data || [])
    setPlans(filtered)
    setLoading(false)
  }

  // Extract unique values for filter dropdowns
  const grades   = [...new Set(plans.map(p => p.grade).filter(Boolean))].sort()
  const subjects = [...new Set(plans.map(p => p.subject).filter(Boolean))].sort()
  const periods  = [...new Set(plans.map(p => p.period).filter(Boolean))].sort()

  const visible = plans.filter(p => {
    if (filters.grade   && p.grade   !== filters.grade)   return false
    if (filters.subject && p.subject !== filters.subject) return false
    if (filters.period  && String(p.period) !== String(filters.period)) return false
    if (filters.status  && p.status  !== filters.status)  return false
    if (search) {
      const t = teachers[p.teacher_id]
      const hay = [p.grade, p.subject, t?.full_name, p.week_number].join(' ').toLowerCase()
      if (!hay.includes(search.toLowerCase())) return false
    }
    return true
  })

  const paged   = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const pages   = Math.ceil(visible.length / PAGE_SIZE)

  function setFilter(key, val) {
    setFilters(f => ({ ...f, [key]: val }))
    setPage(0)
  }

  function openPlan(plan) {
    if (plan.teacher_id === teacher.id || canSeeAll) {
      navigate(`/editor/${plan.id}`)
    }
  }

  // Extract topic preview from content
  function topicPreview(plan) {
    try {
      const c = plan.content
      if (!c?.objetivo?.general) return null
      return c.objetivo.general.replace(/<[^>]+>/g, '').slice(0, 80)
    } catch { return null }
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 960 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, color: '#1F3864', fontWeight: 700 }}>
          📚 Biblioteca de Guías
        </h2>
        <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>
          {loading ? '…' : `${visible.length} guía${visible.length !== 1 ? 's' : ''}`}
          {!canSeeAll && ' · Solo tus guías'}
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
          placeholder="🔍 Buscar..."
          style={{
            padding: '7px 12px', borderRadius: 8, border: '1px solid #D0D5DD',
            fontSize: 13, minWidth: 180,
          }}
        />
        {[
          { key: 'grade',   label: 'Grado',   opts: grades },
          { key: 'subject', label: 'Materia',  opts: subjects },
          { key: 'period',  label: 'Período',  opts: periods },
          { key: 'status',  label: 'Estado',
            opts: Object.entries(STATUS_COLORS).map(([val, s]) => ({ val, label: s.label })) },
        ].map(({ key, label, opts }) => (
          <select
            key={key}
            value={filters[key]}
            onChange={e => setFilter(key, e.target.value)}
            style={{
              padding: '7px 10px', borderRadius: 8, border: '1px solid #D0D5DD',
              fontSize: 13, background: '#fff', cursor: 'pointer',
            }}
          >
            <option value="">Todos los {label.toLowerCase()}s</option>
            {opts.map(o => typeof o === 'string'
              ? <option key={o} value={o}>{o}</option>
              : <option key={o.val} value={o.val}>{o.label}</option>
            )}
          </select>
        ))}
        {(search || Object.values(filters).some(Boolean)) && (
          <button
            onClick={() => { setSearch(''); setFilters({ grade: '', subject: '', period: '', status: '' }); setPage(0) }}
            style={{
              padding: '7px 12px', borderRadius: 8, border: '1px solid #FCA5A5',
              background: '#FEF2F2', color: '#DC2626', fontSize: 12, cursor: 'pointer',
            }}
          >
            ✕ Limpiar
          </button>
        )}
      </div>

      {loading && <p style={{ color: '#888', fontStyle: 'italic' }}>Cargando guías…</p>}

      {!loading && visible.length === 0 && (
        <div style={{
          background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
          padding: '32px', textAlign: 'center', color: '#94A3B8',
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
          No hay guías que coincidan con los filtros.
        </div>
      )}

      {/* Guide cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {paged.map(plan => {
          const t       = teachers[plan.teacher_id]
          const isOwn   = plan.teacher_id === teacher.id
          const preview = topicPreview(plan)

          return (
            <div
              key={plan.id}
              onClick={() => openPlan(plan)}
              style={{
                background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
                padding: '12px 16px', cursor: 'pointer', transition: 'box-shadow .15s',
                display: 'flex', alignItems: 'flex-start', gap: 14,
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,.1)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              {/* Grade badge */}
              <div style={{
                background: '#EEF2FF', color: '#2E5598', borderRadius: 8,
                padding: '6px 10px', fontWeight: 700, fontSize: 13,
                minWidth: 70, textAlign: 'center', flexShrink: 0,
              }}>
                {plan.grade}
              </div>

              {/* Main info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#1F3864' }}>
                    {plan.subject}
                  </span>
                  <span style={{ color: '#94A3B8', fontSize: 12 }}>
                    Sem. {plan.week_number}{plan.week_count === 2 ? '–' + (plan.week_number + 1) : ''} · P{plan.period}
                  </span>
                  <StatusBadge status={plan.status} />
                  {isOwn && (
                    <span style={{
                      background: '#E0F2FE', color: '#0369A1', borderRadius: 4,
                      padding: '1px 6px', fontSize: 10, fontWeight: 600,
                    }}>Mi guía</span>
                  )}
                </div>
                {preview && (
                  <p style={{
                    margin: '3px 0 0', fontSize: 12, color: '#64748B',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{preview}</p>
                )}
              </div>

              {/* Teacher + date */}
              <div style={{ textAlign: 'right', flexShrink: 0, fontSize: 12, color: '#64748B' }}>
                {t && (
                  <div style={{ fontWeight: 600, color: '#374151', marginBottom: 2 }}>
                    {t.full_name?.split(' ')[0]}
                  </div>
                )}
                <div>{formatDate(plan.updated_at)}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid #D0D5DD',
              background: page === 0 ? '#F5F5F5' : '#fff', cursor: page === 0 ? 'default' : 'pointer',
            }}
          >← Anterior</button>
          <span style={{ padding: '6px 10px', fontSize: 13, color: '#666' }}>
            {page + 1} / {pages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pages - 1, p + 1))}
            disabled={page >= pages - 1}
            style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid #D0D5DD',
              background: page >= pages - 1 ? '#F5F5F5' : '#fff',
              cursor: page >= pages - 1 ? 'default' : 'pointer',
            }}
          >Siguiente →</button>
        </div>
      )}
    </div>
  )
}
