import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { LESSON_PLAN_STATUS, ACADEMIC_PERIODS } from '../utils/constants'

// ── CurriculumPage ────────────────────────────────────────────
// Malla curricular — Sprint 6
// Vista de cobertura curricular por docente/grado/materia/período.
// Muestra cuántas guías existen y en qué estado por período académico.
// Acceso: admin, superadmin, director
// ─────────────────────────────────────────────────────────────

const STATUS_DOT = {
  draft:     { color: '#ccc',    title: 'Borrador'  },
  complete:  { color: '#4BACC6', title: 'Completa'  },
  submitted: { color: '#F79646', title: 'Enviada'   },
  approved:  { color: '#9BBB59', title: 'Aprobada'  },
}

export default function CurriculumPage({ teacher }) {
  const [plans,    setPlans]    = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading,  setLoading]  = useState(true)

  // Filters
  const [filterTeacher, setFilterTeacher] = useState('all')
  const [filterPeriod,  setFilterPeriod]  = useState('all')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: planData }, { data: teacherData }] = await Promise.all([
      supabase.from('lesson_plans')
        .select('id, grade, subject, status, teacher_id, content')
        .eq('school_id', teacher.school_id)
        .order('grade'),
      supabase.from('teachers')
        .select('id, full_name, initials, level')
        .eq('school_id', teacher.school_id)
        .eq('status', 'approved')
        .order('full_name'),
    ])
    setPlans(planData || [])
    setTeachers(teacherData || [])
    setLoading(false)
  }

  // Group plans: teacherId → grade → subject → period → [plans]
  const grouped = useMemo(() => {
    const result = {}
    plans.forEach(p => {
      const period = p.content?.info?.periodo || 'sin_periodo'
      if (!result[p.teacher_id]) result[p.teacher_id] = {}
      if (!result[p.teacher_id][p.grade]) result[p.teacher_id][p.grade] = {}
      if (!result[p.teacher_id][p.grade][p.subject]) result[p.teacher_id][p.grade][p.subject] = {}
      if (!result[p.teacher_id][p.grade][p.subject][period]) result[p.teacher_id][p.grade][p.subject][period] = []
      result[p.teacher_id][p.grade][p.subject][period].push(p)
    })
    return result
  }, [plans])

  // Apply filters
  const visibleTeachers = useMemo(() =>
    teachers.filter(t => {
      if (filterTeacher !== 'all' && t.id !== filterTeacher) return false
      return Boolean(grouped[t.id])
    }),
  [teachers, grouped, filterTeacher])

  // Summary stats
  const totalPlans    = plans.length
  const approvedPlans = plans.filter(p => p.status === 'approved').length
  const coveragePct   = totalPlans > 0 ? Math.round(approvedPlans / totalPlans * 100) : 0

  const periods = filterPeriod === 'all'
    ? ACADEMIC_PERIODS
    : ACADEMIC_PERIODS.filter(p => p.value === filterPeriod)

  if (loading) return (
    <div className="ge-loading"><div className="loading-spinner" /><p>Cargando malla…</p></div>
  )

  return (
    <div className="planner-wrap">
      <div className="card">
        <div className="card-title">
          <div className="badge">📊</div>
          Malla Curricular
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#888', fontWeight: 400, textTransform: 'none' }}>
            {totalPlans} guías · {coveragePct}% aprobadas
          </span>
        </div>

        {/* Summary pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {Object.entries(STATUS_DOT).map(([st, cfg]) => {
            const count = plans.filter(p => p.status === st).length
            if (!count) return null
            return (
              <span key={st} style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '4px 10px', borderRadius: '10px',
                background: '#f5f5f5', fontSize: '11px', fontWeight: 600,
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
                {cfg.title}: {count}
              </span>
            )
          })}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)}>
            <option value="all">Todos los docentes</option>
            {teachers.filter(t => grouped[t.id]).map(t => (
              <option key={t.id} value={t.id}>{t.full_name}</option>
            ))}
          </select>
          <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
            <option value="all">Todos los períodos</option>
            {ACADEMIC_PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px', fontSize: '10px', color: '#888' }}>
          {Object.entries(STATUS_DOT).map(([st, cfg]) => (
            <span key={st} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: cfg.color, display: 'inline-block' }} />
              {cfg.title}
            </span>
          ))}
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#f0f0f0', border: '1px solid #ddd', display: 'inline-block' }} />
            Sin guías
          </span>
        </div>

        {/* Matrix */}
        {visibleTeachers.length === 0 ? (
          <div className="empty-state">No hay guías registradas para los filtros seleccionados.</div>
        ) : (
          visibleTeachers.map(t => {
            const teacherGroups = grouped[t.id] || {}
            return (
              <div key={t.id} style={{ marginBottom: '20px' }}>
                {/* Teacher header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 12px', background: '#1F3864', borderRadius: '8px 8px 0 0',
                }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: '#4BACC6', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: '11px', flexShrink: 0,
                  }}>{t.initials || t.full_name?.[0] || '?'}</div>
                  <span style={{ color: '#fff', fontWeight: 700, fontSize: '13px' }}>{t.full_name}</span>
                  <span style={{ color: '#9BBB59', fontSize: '11px', marginLeft: 'auto' }}>
                    {Object.keys(teacherGroups).length} grado{Object.keys(teacherGroups).length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Grade/subject rows */}
                <div style={{ border: '1px solid #dde5f0', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ background: '#f0f4ff' }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#2E5598', width: '140px' }}>Grado</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#2E5598' }}>Materia</th>
                        {periods.map(p => (
                          <th key={p.value} style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700, color: '#2E5598', width: '80px' }}>
                            {p.short}
                          </th>
                        ))}
                        <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700, color: '#2E5598', width: '60px' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(teacherGroups).sort().map(([grade, subjects], gi) =>
                        Object.entries(subjects).sort().map(([subject, periodMap], si) => {
                          const totalRow = Object.values(periodMap).flat().length
                          return (
                            <tr key={`${grade}-${subject}`}
                              style={{ background: (gi + si) % 2 === 0 ? '#fff' : '#fafbff', borderTop: '1px solid #eee' }}>
                              {si === 0 && (
                                <td rowSpan={Object.keys(subjects).length}
                                  style={{ padding: '6px 10px', fontWeight: 700, color: '#1F3864', verticalAlign: 'middle', borderRight: '1px solid #eee' }}>
                                  {grade}
                                </td>
                              )}
                              <td style={{ padding: '6px 10px', color: '#333' }}>{subject}</td>
                              {periods.map(p => {
                                const cellPlans = periodMap[p.value] || []
                                const periodPlans = cellPlans.length
                                  ? cellPlans
                                  : (periodMap['sin_periodo'] || []) // fallback for plans without period set
                                const hasCellPlans = cellPlans.length > 0
                                return (
                                  <td key={p.value} style={{ padding: '6px', textAlign: 'center', borderLeft: '1px solid #eee' }}>
                                    <PeriodCell plans={hasCellPlans ? cellPlans : []} />
                                  </td>
                                )
                              })}
                              <td style={{ padding: '6px', textAlign: 'center', borderLeft: '1px solid #eee', fontWeight: 700, color: '#2E5598' }}>
                                {totalRow}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── PeriodCell ─────────────────────────────────────────────────
// Shows a visual indicator for plans in a period cell
function PeriodCell({ plans }) {
  if (!plans.length) return (
    <span style={{
      display: 'inline-block', width: '24px', height: '24px',
      borderRadius: '4px', background: '#f0f0f0',
      border: '1px solid #ddd', verticalAlign: 'middle',
    }} title="Sin guías" />
  )

  const byStatus = {
    approved:  plans.filter(p => p.status === 'approved').length,
    submitted: plans.filter(p => p.status === 'submitted').length,
    complete:  plans.filter(p => p.status === 'complete').length,
    draft:     plans.filter(p => p.status === 'draft').length,
  }

  const topStatus = byStatus.approved > 0 ? 'approved'
    : byStatus.submitted > 0 ? 'submitted'
    : byStatus.complete  > 0 ? 'complete'
    : 'draft'

  const color = STATUS_DOT[topStatus]?.color || '#ccc'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '28px', height: '24px', borderRadius: '4px',
        background: `${color}22`, border: `2px solid ${color}`,
        fontWeight: 700, fontSize: '11px', color,
      }} title={`${plans.length} guía${plans.length !== 1 ? 's' : ''}`}>
        {plans.length}
      </span>
      {/* mini status dots */}
      <div style={{ display: 'flex', gap: '2px' }}>
        {Object.entries(byStatus).filter(([, c]) => c > 0).map(([st, c]) => (
          <span key={st} title={`${c} ${STATUS_DOT[st]?.title}`} style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: STATUS_DOT[st]?.color, display: 'inline-block',
          }} />
        ))}
      </div>
    </div>
  )
}
