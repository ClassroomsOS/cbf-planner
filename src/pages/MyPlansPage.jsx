import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const STATUS_CONFIG = {
  draft:     { label: 'Borrador',  color: '#aaa',    bg: '#f5f5f5' },
  complete:  { label: 'Completa',  color: '#4BACC6', bg: '#e8f7fb' },
  submitted: { label: 'Enviada',   color: '#F79646', bg: '#fff3e8' },
  approved:  { label: 'Aprobada', color: '#9BBB59', bg: '#eef7e0' },
}
const STATUS_ORDER = ['draft', 'complete', 'submitted', 'approved']

export default function MyPlansPage({ teacher }) {
  const navigate = useNavigate()
  const [plans,         setPlans]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [filterGrade,   setFilterGrade]   = useState('all')
  const [filterStatus,  setFilterStatus]  = useState('all')
  const [duplicating,   setDuplicating]   = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [previewId,    setPreviewId]    = useState(null)

  useEffect(() => { fetchPlans() }, [teacher.id])

  async function fetchPlans() {
    setLoading(true)
    const { data } = await supabase
      .from('lesson_plans')
      .select('*')
      .eq('teacher_id', teacher.id)
      .order('week_number', { ascending: false })
    setPlans(data || [])
    setLoading(false)
  }

  function openPlan(id) { navigate(`/editor/${id}`) }

  async function cycleStatus(plan, e) {
    e.stopPropagation()
    const idx    = STATUS_ORDER.indexOf(plan.status || 'draft')
    const nextSt = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length]
    await supabase.from('lesson_plans').update({ status: nextSt }).eq('id', plan.id)
    setPlans(prev => prev.map(p => p.id === plan.id ? { ...p, status: nextSt } : p))

    // Notify admin when submitted
    if (nextSt === 'submitted') {
      await supabase.from('notifications').insert({
        school_id: teacher.school_id,
        from_id:   teacher.id,
        to_role:   'admin',
        type:      'plan_submitted',
        plan_id:   plan.id,
        message:   `${teacher.full_name} envió la guía de ${plan.subject} — ${plan.grade}, Semana ${plan.week_number}`,
      })
    }
    // Notify teacher when approved
    if (nextSt === 'approved') {
      await supabase.from('notifications').insert({
        school_id: teacher.school_id,
        from_id:   teacher.id,
        to_role:   'teacher',
        type:      'plan_approved',
        plan_id:   plan.id,
        message:   `Tu guía de ${plan.subject} — ${plan.grade}, Semana ${plan.week_number} fue aprobada ✅`,
      })
    }
  }

  async function duplicatePlan(plan, e) {
    e.stopPropagation()
    setDuplicating(plan.id)

    // Calculate next week monday
    const nextMonday = plan.monday_date
      ? (() => {
          const d = new Date(plan.monday_date + 'T12:00:00')
          d.setDate(d.getDate() + 7)
          return d.toISOString().slice(0, 10)
        })()
      : null

    // Calculate next date_range label
    function fmtRange(mondayISO) {
      if (!mondayISO) return ''
      const MONTHS = ['Ene.','Feb.','Mar.','Abr.','May.','Jun.','Jul.','Ago.','Sep.','Oct.','Nov.','Dic.']
      const mon = new Date(mondayISO + 'T12:00:00')
      const fri = new Date(mon); fri.setDate(fri.getDate() + 4)
      const m1 = MONTHS[mon.getMonth()], m2 = MONTHS[fri.getMonth()]
      if (m1 === m2) return `${m1} ${mon.getDate()}–${fri.getDate()}, ${mon.getFullYear()}`
      return `${m1} ${mon.getDate()} – ${m2} ${fri.getDate()}, ${fri.getFullYear()}`
    }

    // Deep clone content and clear day data (fresh week)
    const newContent = plan.content ? JSON.parse(JSON.stringify(plan.content)) : {}
    if (newContent.days) newContent.days = {}
    if (newContent.info) {
      newContent.info.semana  = String((plan.week_number || 1) + 1)
      newContent.info.fechas  = fmtRange(nextMonday)
    }

    const { data: newPlan } = await supabase
      .from('lesson_plans')
      .insert({
        teacher_id:  teacher.id,
        school_id:   teacher.school_id,
        grade:       plan.grade,
        subject:     plan.subject,
        period:      plan.period,
        week_number: (plan.week_number || 1) + 1,
        monday_date: nextMonday,
        date_range:  fmtRange(nextMonday),
        status:      'draft',
        content:     newContent,
      })
      .select()
      .single()
    setDuplicating(null)
    if (newPlan) { await fetchPlans(); navigate(`/editor/${newPlan.id}`) }
  }

  async function confirmDeletePlan() {
    await supabase.from('lesson_plans').delete().eq('id', confirmDelete)
    setPlans(prev => prev.filter(p => p.id !== confirmDelete))
    setConfirmDelete(null)
  }

  const grades   = [...new Set(plans.map(p => p.grade).filter(Boolean))]
  const filtered = plans.filter(p => {
    const gradeMatch  = filterGrade  === 'all' || p.grade             === filterGrade
    const statusMatch = filterStatus === 'all' || (p.status || 'draft') === filterStatus
    return gradeMatch && statusMatch
  })
  const grouped = filtered.reduce((acc, p) => {
    const key = p.grade || 'Sin grado'
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  if (loading) return (
    <div className="ge-loading">
      <div className="loading-spinner" />
      <p>Cargando guías…</p>
    </div>
  )

  return (
    <div className="planner-wrap">
      <div className="card">
        <div className="card-title">
          <div className="badge">📚</div>
          Mis Guías
          <span style={{ marginLeft:'auto', fontSize:'11px', color:'#888', fontWeight:400, textTransform:'none' }}>
            {plans.length} guía{plans.length !== 1 ? 's' : ''}
          </span>
        </div>

        {plans.length > 0 && (
          <div className="mp-toolbar">
            <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)}>
              <option value="all">Todos los grados</option>
              {grades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">Todos los estados</option>
              {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
            </select>
          </div>
        )}

        {plans.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize:'48px' }}>📋</div>
            <p>Aún no tienes guías guardadas.</p>
            <p style={{ fontSize:'12px', color:'#aaa', marginTop:'6px' }}>Crea tu primera guía desde "Nueva Guía"</p>
            <button className="btn-primary" style={{ marginTop:'16px' }} onClick={() => navigate('/')}>+ Nueva Guía</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p>No hay guías para los filtros seleccionados.</p></div>
        ) : (
          Object.entries(grouped).map(([grade, items]) => (
            <div key={grade} className="mp-group">
              <div className="mp-group-header">
                {grade}
                <span className="mp-group-count">{items.length} guía{items.length !== 1 ? 's' : ''}</span>
              </div>
              {items.map(plan => {
                const st = STATUS_CONFIG[plan.status || 'draft']
                const days = plan.content?.days || {}
                const activeDays = Object.values(days).filter(d => d.active !== false).length
                const totalDays  = Object.keys(days).length
                return (
                  <div key={plan.id} className="mp-card" onClick={() => openPlan(plan.id)}>
                    <div className="mp-card-left">
                      <div className="mp-card-title">
                        {plan.subject || '—'}
                        {plan.week_number && <span className="mp-week-badge">Sem. {plan.week_number}</span>}
                      </div>
                      <div className="mp-card-meta">
                        {plan.date_range && <span>📅 {plan.date_range}</span>}
                        {plan.period     && <span>· {plan.period}</span>}
                        {totalDays > 0   && <span>· {activeDays}/{totalDays} días</span>}
                      </div>
                    </div>
                    <div className="mp-card-right" onClick={e => e.stopPropagation()}>
                      <button className="mp-status-btn"
                        style={{ background: st.bg, color: st.color, borderColor: st.color }}
                        onClick={e => cycleStatus(plan, e)}
                        title="Clic para cambiar estado">
                        {st.label}
                      </button>
                      <button className="mp-action-btn"
                        onClick={e => duplicatePlan(plan, e)}
                        disabled={duplicating === plan.id}
                        title="Duplicar (semana +1)">
                        {duplicating === plan.id ? '⏳' : '⎘'}
                      </button>
                      {confirmDelete === plan.id ? (
                        <div className="mp-confirm-row" onClick={e => e.stopPropagation()}>
                          <span style={{ fontSize:'11px', color:'#cc3333', fontWeight:700 }}>¿Eliminar?</span>
                          <button className="btn-cal-confirm" onClick={confirmDeletePlan}>Sí</button>
                          <button className="btn-cal-cancel"  onClick={() => setConfirmDelete(null)}>No</button>
                        </div>
                      ) : (
                        <button className="mp-action-btn mp-action-danger"
                          onClick={e => { e.stopPropagation(); setConfirmDelete(plan.id) }}
                          title="Eliminar">🗑</button>
                      )}
                      <span className="mp-arrow">→</span>
                    </div>
                  </div>

                  {/* Preview panel */}
                  {previewId === plan.id && (
                    <PlanPreview plan={plan} />
                  )}
                )
              })}
            </div>
          ))
        )}
      </div>

      {confirmDelete && (
        <div className="prof-overlay open" onClick={() => setConfirmDelete(null)}>
          <div style={{ background:'#fff', borderRadius:'12px', padding:'28px 32px', maxWidth:'360px', width:'90%', textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:'36px', marginBottom:'12px' }}>🗑</div>
            <div style={{ fontWeight:700, fontSize:'15px', color:'#1F3864', marginBottom:'8px' }}>¿Eliminar esta guía?</div>
            <div style={{ fontSize:'12px', color:'#888', marginBottom:'20px' }}>Esta acción no se puede deshacer.</div>
            <div style={{ display:'flex', gap:'10px', justifyContent:'center' }}>
              <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Cancelar</button>
              <button className="btn-primary" style={{ background:'#cc3333' }} onClick={confirmDeletePlan}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// ── Plan Preview ─────────────────────────────────────────────────────────────
function PlanPreview({ plan }) {
  const content = plan.content || {}
  const days    = Object.entries(content.days || {})
    .sort(([a],[b]) => a.localeCompare(b))
    .filter(([, d]) => d.active !== false)

  const SECTIONS = [
    { key: 'subject',    label: 'Subject',    color: '#4F81BD' },
    { key: 'motivation', label: 'Motivation', color: '#4BACC6' },
    { key: 'activity',   label: 'Activity',   color: '#F79646' },
    { key: 'skill',      label: 'Skill',      color: '#8064A2' },
    { key: 'closing',    label: 'Closing',    color: '#9BBB59' },
    { key: 'assignment', label: 'Assignment', color: '#4E84A2' },
  ]

  const DAYS_EN = ['Monday','Tuesday','Wednesday','Thursday','Friday']

  function getDayName(iso) {
    const d = new Date(iso + 'T12:00:00')
    return DAYS_EN[d.getDay() - 1] || iso
  }

  function stripHtml(html) {
    return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  if (!days.length) {
    return (
      <div className="mp-preview">
        <p style={{ color: '#aaa', fontSize: '12px', fontStyle: 'italic' }}>
          Esta guía no tiene días con contenido aún.
        </p>
      </div>
    )
  }

  return (
    <div className="mp-preview">
      {content.objetivo?.general && (
        <div className="mp-preview-objective">
          <span className="mp-preview-label">🎯 Objetivo:</span>
          {stripHtml(content.objetivo.general).slice(0, 200)}
          {stripHtml(content.objetivo.general).length > 200 ? '…' : ''}
        </div>
      )}
      <div className="mp-preview-days">
        {days.map(([iso, day]) => (
          <div key={iso} className="mp-preview-day">
            <div className="mp-preview-day-header">
              📅 {getDayName(iso)}
              {day.unit && <span className="mp-preview-unit">· {day.unit}</span>}
            </div>
            <div className="mp-preview-sections">
              {SECTIONS.map(s => {
                const sec = day.sections?.[s.key]
                const text = stripHtml(sec?.content)
                if (!text) return null
                return (
                  <div key={s.key} className="mp-preview-section">
                    <span className="mp-preview-sec-dot" style={{ background: s.color }} />
                    <span className="mp-preview-sec-label">{s.label}:</span>
                    <span className="mp-preview-sec-text">
                      {text.slice(0, 120)}{text.length > 120 ? '…' : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
