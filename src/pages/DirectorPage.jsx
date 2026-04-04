import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { LEVEL_LABELS } from '../utils/roles'

// ── DirectorPage ──────────────────────────────────────────────────────────────
// Read-only view for directors: see all lesson plans in the school,
// filterable by teacher, grade, and status.
// Requires the "Managers can read school lesson plans" RLS policy.

export default function DirectorPage({ teacher }) {
  const navigate = useNavigate()
  const [plans,    setPlans]    = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading,  setLoading]  = useState(true)

  // Filters
  const [filterTeacher, setFilterTeacher] = useState('all')
  const [filterGrade,   setFilterGrade]   = useState('all')
  const [filterStatus,  setFilterStatus]  = useState('all')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: planData }, { data: teacherData }] = await Promise.all([
      supabase
        .from('lesson_plans')
        .select('id, title, grade, status, created_at, updated_at, teacher_id, content')
        .eq('school_id', teacher.school_id)
        .order('updated_at', { ascending: false })
        .limit(200),
      supabase
        .from('teachers')
        .select('id, full_name, initials, role, level')
        .eq('school_id', teacher.school_id)
        .eq('status', 'approved'),
    ])
    setPlans(planData || [])
    setTeachers(teacherData || [])
    setLoading(false)
  }

  const teacherMap = useMemo(() => {
    const map = {}
    teachers.forEach(t => { map[t.id] = t })
    return map
  }, [teachers])

  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      if (filterTeacher !== 'all' && p.teacher_id !== filterTeacher) return false
      if (filterGrade   !== 'all' && p.grade !== filterGrade)         return false
      if (filterStatus  !== 'all' && p.status !== filterStatus)       return false
      return true
    })
  }, [plans, filterTeacher, filterGrade, filterStatus])

  const gradeOptions = useMemo(() => {
    return [...new Set(plans.map(p => p.grade).filter(Boolean))].sort()
  }, [plans])

  const STATUS_LABELS = {
    draft:     { label: 'Borrador',  color: '#888', bg: '#f5f5f5' },
    complete:  { label: 'Completa',  color: '#4BACC6', bg: '#e8f7fb' },
    submitted: { label: 'Enviada',   color: '#F79646', bg: '#fff3e8' },
    approved:  { label: 'Aprobada',  color: '#9BBB59', bg: '#eef7e0' },
  }

  if (loading) return (
    <div className="ge-loading">
      <div className="loading-spinner" />
      <p>Cargando planes…</p>
    </div>
  )

  return (
    <div className="lt-page">
      {/* Top bar */}
      <div className="ge-topbar">
        <div className="ge-topbar-info">
          <span className="ge-guide-title">📋 Vista de Director</span>
          <span className="ge-guide-dates">
            {teacher.schools?.name || 'Mi Colegio'}
            {teacher.level ? ` · ${LEVEL_LABELS[teacher.level]}` : ''}
          </span>
        </div>
        <div className="ge-save-area" style={{ fontSize: 12, color: '#888' }}>
          {filteredPlans.length} guía{filteredPlans.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="lt-body">

        {/* Filters */}
        <div className="lt-filters">
          <div className="lt-filter-group">
            <label>Docente</label>
            <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)}>
              <option value="all">Todos</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>
          </div>
          <div className="lt-filter-group">
            <label>Grado</label>
            <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)}>
              <option value="all">Todos</option>
              {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="lt-filter-group">
            <label>Estado</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">Todos</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          {(filterTeacher !== 'all' || filterGrade !== 'all' || filterStatus !== 'all') && (
            <button
              className="lt-clear-filters"
              onClick={() => { setFilterTeacher('all'); setFilterGrade('all'); setFilterStatus('all') }}
            >
              ✕ Limpiar
            </button>
          )}
        </div>

        {/* Plans grouped by teacher */}
        {filteredPlans.length === 0 ? (
          <div className="lt-empty">
            <div className="lt-empty-icon">📋</div>
            <h3>No hay guías para mostrar</h3>
            <p>Ajusta los filtros o espera a que los docentes creen guías.</p>
          </div>
        ) : (
          <div className="lt-list">
            {filteredPlans.map(plan => {
              const t = teacherMap[plan.teacher_id]
              const statusCfg = STATUS_LABELS[plan.status] || STATUS_LABELS.draft
              const info = plan.content?.info || {}
              const updatedAt = plan.updated_at
                ? new Date(plan.updated_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
                : ''

              return (
                <div key={plan.id} className="lt-card" style={{ cursor: 'default' }}>
                  <div className="lt-card-header">
                    <div className="lt-card-meta">
                      <span className="lt-meta-pill grade">{plan.grade}</span>
                      {info.asignatura && (
                        <span className="lt-meta-pill subject">{info.asignatura}</span>
                      )}
                      {info.semana && (
                        <span className="lt-meta-pill period">Semana {info.semana}</span>
                      )}
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                        background: statusCfg.bg, color: statusCfg.color,
                        border: `1px solid ${statusCfg.color}33`
                      }}>
                        {statusCfg.label}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, color: '#aaa' }}>
                        Actualizado {updatedAt}
                      </span>
                    </div>
                  </div>

                  {/* Teacher + plan title */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                    {t && (
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', background: '#2E5598',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, flexShrink: 0,
                      }}>
                        {t.initials || t.full_name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1F3864' }}>
                        {plan.title || 'Guía sin título'}
                      </div>
                      {t && (
                        <div style={{ fontSize: 11, color: '#888' }}>{t.full_name}</div>
                      )}
                    </div>
                  </div>

                  {/* Objetivo preview */}
                  {plan.content?.objetivo?.general && (
                    <p style={{
                      margin: '8px 0 0', fontSize: 12, color: '#555', lineHeight: 1.5,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden'
                    }}>
                      🎯 {plan.content.objetivo.general}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
