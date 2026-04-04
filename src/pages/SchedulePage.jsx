import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { PERIODS, DAYS, GRADES, SECTIONS_LIST } from '../utils/constants'

// ── SchedulePage ───────────────────────────────────────────────
// Grilla de horarios institucional — dos vistas:
//   • Por Grado/Sección: seleccionar grado → ver qué materia/docente ocupa cada período
//   • Por Docente: seleccionar docente → ver sus asignaciones en la semana
// Acceso: admin, superadmin, director, psicopedagoga
// ──────────────────────────────────────────────────────────────

const SUBJECT_COLORS = [
  '#4F81BD', '#4BACC6', '#F79646', '#8064A2', '#9BBB59',
  '#C0504D', '#1F3864', '#375623', '#C55A11', '#17375E',
  '#B8860B', '#2E5598', '#6B4226', '#556B2F', '#8B4513',
]

function subjectColor(subject, colorMap) {
  if (!colorMap[subject]) {
    const idx = Object.keys(colorMap).length % SUBJECT_COLORS.length
    colorMap[subject] = SUBJECT_COLORS[idx]
  }
  return colorMap[subject]
}

export default function SchedulePage({ teacher }) {
  const [view,          setView]          = useState('grade')    // 'grade' | 'teacher'
  const [assignments,   setAssignments]   = useState([])
  const [teachers,      setTeachers]      = useState([])
  const [loading,       setLoading]       = useState(true)

  // Grade view selectors
  const [selGrade,    setSelGrade]    = useState('')
  const [selSection,  setSelSection]  = useState('')
  // Teacher view selector
  const [selTeacher,  setSelTeacher]  = useState('')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: aData }, { data: tData }] = await Promise.all([
      supabase.from('teacher_assignments')
        .select('id, teacher_id, grade, section, subject, schedule, classroom')
        .eq('school_id', teacher.school_id),
      supabase.from('teachers')
        .select('id, full_name, initials')
        .eq('school_id', teacher.school_id)
        .eq('status', 'approved')
        .order('full_name'),
    ])
    setAssignments(aData || [])
    setTeachers(tData || [])
    setLoading(false)
  }

  // Available grades/sections from actual assignments
  const gradeOptions = useMemo(() => {
    const pairs = new Map()
    assignments.forEach(a => {
      const key = `${a.grade}|${a.section}`
      if (!pairs.has(key)) pairs.set(key, { grade: a.grade, section: a.section })
    })
    return [...pairs.values()].sort((a, b) => {
      const gi = GRADES.indexOf(a.grade)
      const gj = GRADES.indexOf(b.grade)
      if (gi !== gj) return gi - gj
      return a.section.localeCompare(b.section)
    })
  }, [assignments])

  // Build cell map for selected grade/section
  const gradeCellMap = useMemo(() => {
    if (!selGrade || !selSection) return {}
    const map = {}
    const colorMap = {}
    assignments
      .filter(a => a.grade === selGrade && a.section === selSection)
      .forEach(a => {
        const t = teachers.find(x => x.id === a.teacher_id)
        const color = subjectColor(a.subject, colorMap)
        DAYS.forEach(({ key: dk }) => {
          ;(a.schedule?.[dk] || []).forEach(pid => {
            const k = `${dk}-${pid}`
            if (!map[k]) map[k] = []
            map[k].push({ a, t, color })
          })
        })
      })
    return map
  }, [assignments, teachers, selGrade, selSection])

  // Build cell map for selected teacher
  const teacherCellMap = useMemo(() => {
    if (!selTeacher) return {}
    const map = {}
    const colorMap = {}
    assignments
      .filter(a => a.teacher_id === selTeacher)
      .forEach(a => {
        const color = subjectColor(`${a.grade}${a.section}`, colorMap)
        DAYS.forEach(({ key: dk }) => {
          ;(a.schedule?.[dk] || []).forEach(pid => {
            const k = `${dk}-${pid}`
            if (!map[k]) map[k] = []
            map[k].push({ a, color })
          })
        })
      })
    return map
  }, [assignments, selTeacher])

  // Count conflicts across the whole school (same classroom + same slot)
  const schoolConflicts = useMemo(() => {
    const slotMap = {}
    assignments.forEach(a => {
      if (!a.classroom) return
      DAYS.forEach(({ key: dk }) => {
        ;(a.schedule?.[dk] || []).forEach(pid => {
          const k = `${a.classroom}-${dk}-${pid}`
          if (!slotMap[k]) slotMap[k] = []
          slotMap[k].push(a)
        })
      })
    })
    return Object.entries(slotMap)
      .filter(([, list]) => list.length > 1)
      .map(([k, list]) => ({ key: k, conflicts: list }))
  }, [assignments])

  const activeCellMap = view === 'grade' ? gradeCellMap : teacherCellMap

  if (loading) return (
    <div className="ge-loading">
      <div className="loading-spinner" />
      <p>Cargando horarios…</p>
    </div>
  )

  return (
    <div className="planner-wrap">
      <div className="card">
        <div className="card-title">
          <div className="badge">🗓</div>
          Horario Institucional
          <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#9BBB59', fontWeight: 700 }}>
            {schoolConflicts.length > 0
              ? <span style={{ color: '#C0504D' }}>⚠️ {schoolConflicts.length} conflicto{schoolConflicts.length !== 1 ? 's' : ''} de salón</span>
              : '✅ Sin conflictos de salón'}
          </span>
        </div>

        {/* ── View tabs ── */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            className={view === 'grade' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setView('grade')}
            style={{ fontSize: '12px' }}>
            🏫 Por Grado / Sección
          </button>
          <button
            className={view === 'teacher' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setView('teacher')}
            style={{ fontSize: '12px' }}>
            👩‍🏫 Por Docente
          </button>
        </div>

        {/* ── Selectors ── */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {view === 'grade' ? (
            <>
              <select value={selGrade} onChange={e => { setSelGrade(e.target.value); setSelSection('') }}
                style={{ minWidth: '120px' }}>
                <option value="">— Grado —</option>
                {[...new Set(gradeOptions.map(o => o.grade))].map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <select value={selSection} onChange={e => setSelSection(e.target.value)}
                disabled={!selGrade} style={{ minWidth: '100px' }}>
                <option value="">— Sección —</option>
                {gradeOptions.filter(o => o.grade === selGrade).map(o => (
                  <option key={o.section} value={o.section}>{o.section}</option>
                ))}
              </select>
              {selGrade && selSection && (
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#2E5598', alignSelf: 'center' }}>
                  Horario: {selGrade} {selSection}
                </span>
              )}
            </>
          ) : (
            <>
              <select value={selTeacher} onChange={e => setSelTeacher(e.target.value)}
                style={{ minWidth: '200px' }}>
                <option value="">— Seleccionar docente —</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
            </>
          )}
        </div>

        {/* ── Grid ── */}
        {(view === 'grade' ? (selGrade && selSection) : selTeacher) ? (
          <ScheduleGrid
            cellMap={activeCellMap}
            view={view}
          />
        ) : (
          <div className="empty-state">
            {view === 'grade'
              ? 'Selecciona un grado y sección para ver el horario.'
              : 'Selecciona un docente para ver su horario semanal.'}
          </div>
        )}

        {/* ── School conflicts panel ── */}
        {schoolConflicts.length > 0 && (
          <div style={{
            marginTop: '20px', background: '#fdf0f0',
            border: '2px solid #C0504D', borderRadius: '10px', padding: '14px',
          }}>
            <div style={{ fontWeight: 700, fontSize: '12px', color: '#C0504D', marginBottom: '8px' }}>
              ⚠️ Conflictos de salón detectados
            </div>
            {schoolConflicts.map(({ key, conflicts }) => {
              const [classroom, dk, pid] = key.split('-')
              const dayLabel = DAYS.find(d => d.key === dk)?.full || dk
              return (
                <div key={key} style={{
                  fontSize: '11px', color: '#8a1010', marginBottom: '4px',
                  padding: '6px 10px', background: '#fff', borderRadius: '6px',
                }}>
                  🏠 <strong>{classroom}</strong> — {dayLabel} · {pid}:
                  {conflicts.map(c => ` ${c.grade}${c.section} ${c.subject}`).join(' vs')}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── ScheduleGrid ───────────────────────────────────────────────
function ScheduleGrid({ cellMap, view }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%', borderCollapse: 'collapse',
        fontSize: '11px', tableLayout: 'fixed',
      }}>
        <thead>
          <tr>
            <th style={thStyle('#1F3864', '100px')}>Período</th>
            {DAYS.map(d => (
              <th key={d.key} style={thStyle('#2E5598')}>{d.full}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((p, pi) => (
            <tr key={p.id} style={{ background: pi % 2 === 0 ? '#fafafa' : '#fff' }}>
              <td style={{
                padding: '6px 8px', fontWeight: 700, textAlign: 'center',
                borderRight: '2px solid #dde5f0', whiteSpace: 'nowrap',
                fontSize: '11px', color: '#2E5598',
              }}>
                <div>{p.label}</div>
                <div style={{ fontSize: '9px', fontWeight: 400, color: '#888' }}>{p.time}</div>
              </td>
              {DAYS.map(d => {
                const entries = cellMap[`${d.key}-${p.id}`] || []
                const hasConflict = entries.length > 1
                return (
                  <td key={d.key} style={{
                    padding: '4px',
                    border: '1px solid #e8e8e8',
                    background: hasConflict ? '#fdf0f0' : 'transparent',
                    verticalAlign: 'top',
                    minWidth: '90px',
                  }}>
                    {entries.map(({ a, t, color }, i) => (
                      <CellBlock key={i} a={a} t={t} color={color} view={view} conflict={hasConflict} />
                    ))}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CellBlock({ a, t, color, view, conflict }) {
  const bg = conflict ? '#fdf0f0' : `${color}18`
  const border = conflict ? '#C0504D' : color
  return (
    <div style={{
      background: bg, border: `1.5px solid ${border}`,
      borderRadius: '4px', padding: '3px 5px', marginBottom: '2px',
      lineHeight: 1.3,
    }}>
      {view === 'grade' ? (
        <>
          <div style={{ fontWeight: 700, color: border, fontSize: '10px' }}>{a.subject}</div>
          {t && <div style={{ color: '#555', fontSize: '9px' }}>{t.initials || t.full_name.split(' ').map(w => w[0]).join('')}</div>}
          {a.classroom && <div style={{ color: '#888', fontSize: '9px' }}>🏠 {a.classroom}</div>}
        </>
      ) : (
        <>
          <div style={{ fontWeight: 700, color: border, fontSize: '10px' }}>{a.grade} {a.section}</div>
          <div style={{ color: '#555', fontSize: '9px' }}>{a.subject}</div>
          {a.classroom && <div style={{ color: '#888', fontSize: '9px' }}>🏠 {a.classroom}</div>}
        </>
      )}
      {conflict && <div style={{ color: '#C0504D', fontSize: '9px', fontWeight: 700 }}>⚠️ Conflicto</div>}
    </div>
  )
}

function thStyle(bg, width) {
  return {
    background: bg, color: '#fff', padding: '8px 6px',
    textAlign: 'center', fontWeight: 700, fontSize: '11px',
    ...(width ? { width } : {}),
  }
}
