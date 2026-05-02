// ── GradebookPage.jsx ─────────────────────────────────────────────────────────
// Sábana de calificaciones institucional por grado+sección+materia+período.
// 4 categorías: Cognitiva 35%, Digital 20%, Axiológica 15%, Eval. Final 30%.
// Columnas auto-detectadas desde NEWS actividades_evaluativas + micro_activities.
// Celdas editables inline.

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { displayName } from '../utils/studentUtils'
import { gradeLevel } from '../utils/examUtils'
import { useToast } from '../context/ToastContext'
import MicroActivityModal from '../components/MicroActivityModal'

// ── Categorías institucionales ──────────────────────────────────────────────
const CATEGORIES = [
  { key: 'cognitiva',   label: 'Meta Cognitiva',   weight: 35, color: '#1D4ED8', bg: '#DBEAFE', icon: '📝' },
  { key: 'digital',     label: 'Meta Digital',     weight: 20, color: '#D97706', bg: '#FEF3C7', icon: '💻' },
  { key: 'axiologica',  label: 'Meta Axiológica',  weight: 15, color: '#15803D', bg: '#DCFCE7', icon: '✝️' },
  { key: 'final',       label: 'Evaluación Final', weight: 30, color: '#7C3AED', bg: '#EDE9FE', icon: '🎓' },
]

const SIMPLE_RUBRIC = [
  { label: 'Básico',     value: 2.0, short: 'B',  color: '#DC2626' },
  { label: 'En Proceso', value: 3.0, short: 'EP', color: '#D97706' },
  { label: 'Intermedio', value: 4.0, short: 'I',  color: '#1D4ED8' },
  { label: 'Logrado',    value: 5.0, short: 'L',  color: '#15803D' },
]

function rubricLabel(score) {
  if (score == null) return null
  const s = Number(score)
  const match = [...SIMPLE_RUBRIC].reverse().find(r => s >= r.value - 0.5)
  return match || SIMPLE_RUBRIC[0]
}

export { CATEGORIES, SIMPLE_RUBRIC }

export default function GradebookPage({ teacher }) {
  const navigate = useNavigate()
  const { showToast } = useToast()

  // ── Selectors ───────────────────────────────────────────────────────────────
  const [assignments, setAssignments] = useState([])
  const [selectedGrade, setSelectedGrade] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState(1)
  const [showMicroModal, setShowMicroModal] = useState(false)

  // ── Data ────────────────────────────────────────────────────────────────────
  const [students, setStudents] = useState([])
  const [newsProjects, setNewsProjects] = useState([])
  const [microActivities, setMicroActivities] = useState([])
  const [grades, setGrades] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(null) // cellKey being saved

  // Load teacher assignments
  useEffect(() => {
    if (!teacher?.id) return
    supabase
      .from('teacher_assignments')
      .select('grade, section, subject')
      .eq('teacher_id', teacher.id)
      .then(({ data }) => {
        setAssignments(data || [])
        if (data?.length) {
          setSelectedGrade(data[0].grade)
          setSelectedSection(data[0].section)
          setSelectedSubject(data[0].subject)
        }
      })
  }, [teacher?.id])

  const uniqueGrades = useMemo(() => [...new Set(assignments.map(a => a.grade))], [assignments])
  const sectionsForGrade = useMemo(() =>
    [...new Set(assignments.filter(a => a.grade === selectedGrade).map(a => a.section))],
    [assignments, selectedGrade]
  )
  const subjectsForGradeSection = useMemo(() =>
    [...new Set(assignments.filter(a => a.grade === selectedGrade && a.section === selectedSection).map(a => a.subject))],
    [assignments, selectedGrade, selectedSection]
  )

  // Auto-select first section/subject when grade changes
  useEffect(() => {
    if (sectionsForGrade.length && !sectionsForGrade.includes(selectedSection)) {
      setSelectedSection(sectionsForGrade[0])
    }
  }, [sectionsForGrade])
  useEffect(() => {
    if (subjectsForGradeSection.length && !subjectsForGradeSection.includes(selectedSubject)) {
      setSelectedSubject(subjectsForGradeSection[0])
    }
  }, [subjectsForGradeSection])

  // ── Load data when selection changes ────────────────────────────────────────
  const hasSelection = selectedGrade && selectedSection && selectedSubject

  useEffect(() => {
    if (!hasSelection || !teacher?.school_id) return
    setLoading(true)

    const combinedGrade = `${selectedGrade} ${selectedSection}`

    Promise.all([
      // Students
      supabase.from('school_students')
        .select('id, first_name, second_name, first_lastname, second_lastname, student_code')
        .eq('school_id', teacher.school_id)
        .eq('grade', selectedGrade)
        .eq('section', selectedSection)
        .order('first_lastname'),

      // NEWS projects with activities for this subject+grade+period
      supabase.from('news_projects')
        .select('id, title, grade, section, subject, actividades_evaluativas, skill, period')
        .eq('teacher_id', teacher.id)
        .eq('subject', selectedSubject)
        .eq('grade', selectedGrade)
        .eq('section', selectedSection)
        .eq('period', selectedPeriod),

      // Micro activities
      supabase.from('micro_activities')
        .select('*')
        .eq('teacher_id', teacher.id)
        .eq('grade', selectedGrade)
        .eq('section', selectedSection)
        .eq('subject', selectedSubject)
        .eq('period', selectedPeriod)
        .eq('status', 'active')
        .order('activity_date'),

      // All grades for this teacher+subject in the period
      supabase.from('student_activity_grades')
        .select('*')
        .eq('teacher_id', teacher.id)
        .eq('school_id', teacher.school_id),
    ]).then(([studRes, newsRes, microRes, gradesRes]) => {
      setStudents(studRes.data || [])
      setNewsProjects((newsRes.data || []).filter(p =>
        Array.isArray(p.actividades_evaluativas) && p.actividades_evaluativas.length > 0
      ))
      setMicroActivities(microRes.data || [])
      setGrades(gradesRes.data || [])
      setLoading(false)
    })
  }, [hasSelection, selectedPeriod, teacher?.id, teacher?.school_id])

  // ── Build columns from data sources ─────────────────────────────────────────
  const columns = useMemo(() => {
    const cols = { cognitiva: [], digital: [], axiologica: [], final: [] }

    // NEWS activities → columns
    for (const project of newsProjects) {
      for (const act of (project.actividades_evaluativas || [])) {
        const cat = act.categoria || 'cognitiva'
        if (cols[cat]) {
          cols[cat].push({
            id: act.id,
            name: act.nombre,
            date: act.fecha,
            pct: act.porcentaje,
            source: 'news',
            projectId: project.id,
            projectTitle: project.title,
            rubricType: 'numeric',
          })
        }
      }
    }

    // Micro activities → columns
    for (const micro of microActivities) {
      const cat = micro.category || 'cognitiva'
      if (cols[cat]) {
        cols[cat].push({
          id: micro.id,
          name: micro.name,
          date: micro.activity_date,
          source: 'micro',
          microId: micro.id,
          rubricType: micro.rubric_type,
          groupMode: micro.group_mode,
        })
      }
    }

    // Final exam — always 1 column
    cols.final = [{
      id: `final_${selectedPeriod}`,
      name: 'Examen Final',
      source: 'final',
      rubricType: 'numeric',
    }]

    return cols
  }, [newsProjects, microActivities, selectedPeriod])

  // ── Grade lookup ────────────────────────────────────────────────────────────
  const gradeMap = useMemo(() => {
    const m = {}
    for (const g of grades) {
      const key = g.micro_activity_id
        ? `${g.student_id}_micro_${g.micro_activity_id}`
        : `${g.student_id}_${g.news_project_id}_${g.activity_id}`
      m[key] = g
    }
    return m
  }, [grades])

  function getGradeKey(studentId, col) {
    if (col.source === 'micro') return `${studentId}_micro_${col.microId}`
    if (col.source === 'final') return `${studentId}_final_${selectedPeriod}`
    return `${studentId}_${col.projectId}_${col.id}`
  }

  function getGradeValue(studentId, col) {
    const key = getGradeKey(studentId, col)
    const g = gradeMap[key]
    return g ? Number(g.colombian_grade || g.score) : null
  }

  // ── Save grade ──────────────────────────────────────────────────────────────
  const saveGrade = useCallback(async (studentId, col, value) => {
    const numVal = Number(value)
    if (isNaN(numVal) || numVal < 1 || numVal > 5) return

    const cellKey = getGradeKey(studentId, col)
    setSaving(cellKey)

    const row = {
      school_id: teacher.school_id,
      teacher_id: teacher.id,
      student_id: studentId,
      score: numVal,
      max_score: 5,
    }

    if (col.source === 'micro') {
      row.micro_activity_id = col.microId
    } else if (col.source === 'final') {
      // For final exam, store as a micro-activity-like entry
      // We'll use activity_id = 'final_{period}' with no project
      row.activity_id = `final_${selectedPeriod}`
    } else {
      row.news_project_id = col.projectId
      row.activity_id = col.id
    }

    const existing = gradeMap[cellKey]
    let result
    if (existing) {
      result = await supabase.from('student_activity_grades')
        .update({ score: numVal, max_score: 5 })
        .eq('id', existing.id)
        .select()
    } else {
      result = await supabase.from('student_activity_grades')
        .insert(row)
        .select()
    }

    if (result.error) {
      showToast('Error guardando nota', 'error')
    } else if (result.data?.[0]) {
      // Update local state
      setGrades(prev => {
        const idx = prev.findIndex(g => g.id === result.data[0].id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = result.data[0]
          return next
        }
        return [...prev, result.data[0]]
      })
    }
    setSaving(null)
  }, [teacher, gradeMap, selectedPeriod])

  // ── Weighted average per student ────────────────────────────────────────────
  function categoryAvg(studentId, catKey) {
    const catCols = columns[catKey] || []
    if (!catCols.length) return null
    const vals = catCols.map(c => getGradeValue(studentId, c)).filter(v => v != null)
    if (!vals.length) return null
    return vals.reduce((s, v) => s + v, 0) / vals.length
  }

  function finalGrade(studentId) {
    let total = 0, weightSum = 0
    for (const cat of CATEGORIES) {
      const avg = categoryAvg(studentId, cat.key)
      if (avg != null) {
        total += avg * cat.weight
        weightSum += cat.weight
      }
    }
    return weightSum > 0 ? total / weightSum : null
  }

  // Total columns count for colspan
  const totalCols = CATEGORIES.reduce((s, c) => s + (columns[c.key]?.length || 0), 0)

  // ── Micro activity created callback ─────────────────────────────────────────
  const handleMicroCreated = (micro) => {
    setMicroActivities(prev => [...prev, micro])
    setShowMicroModal(false)
    showToast('Micro-actividad creada', 'success')
  }

  return (
    <div className="gb-page">
      {/* Header */}
      <div className="gb-header">
        <h2>📊 Sábana de Calificaciones</h2>
        <div className="gb-selectors">
          <select value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}>
            {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)}>
            {sectionsForGrade.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
            {subjectsForGradeSection.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={selectedPeriod} onChange={e => setSelectedPeriod(Number(e.target.value))}>
            {[1,2,3,4].map(p => <option key={p} value={p}>Período {p}</option>)}
          </select>
        </div>
        <div className="gb-actions">
          <button className="gb-add-micro-btn" onClick={() => setShowMicroModal(true)}>
            + Micro-actividad
          </button>
          <button className="gb-history-btn" onClick={() => navigate('/grading')}>
            📋 Calificación rápida
          </button>
        </div>
      </div>

      {/* Weight legend */}
      <div className="gb-legend">
        {CATEGORIES.map(c => (
          <span key={c.key} className="gb-legend-item" style={{ background: c.bg, color: c.color }}>
            {c.icon} {c.label} ({c.weight}%)
          </span>
        ))}
      </div>

      {loading ? (
        <div className="gb-loading">Cargando sábana...</div>
      ) : !hasSelection ? (
        <div className="gb-empty">Selecciona grado, sección y materia para ver la sábana.</div>
      ) : (
        <div className="gb-table-wrap">
          <table className="gb-table">
            {/* Category group headers */}
            <thead>
              <tr className="gb-cat-row">
                <th className="gb-th-num" rowSpan={2}>#</th>
                <th className="gb-th-student" rowSpan={2}>Estudiantes</th>
                {CATEGORIES.map(cat => {
                  const catCols = columns[cat.key] || []
                  if (!catCols.length) return null
                  return (
                    <th
                      key={cat.key}
                      colSpan={catCols.length}
                      className="gb-th-cat"
                      style={{ background: cat.color, color: '#fff' }}
                    >
                      {cat.icon} {cat.label} <span className="gb-th-cat-pct">{cat.weight}%</span>
                    </th>
                  )
                })}
                <th className="gb-th-final" rowSpan={2}>Evaluación<br/>Final</th>
                <th className="gb-th-pct" rowSpan={2}>%</th>
              </tr>

              {/* Activity sub-headers */}
              <tr className="gb-act-row">
                {CATEGORIES.map(cat =>
                  (columns[cat.key] || []).map(col => (
                    <th key={col.id} className="gb-th-act" style={{ borderTopColor: cat.color }}>
                      <div className="gb-act-name" title={col.name}>{col.name}</div>
                      {col.date && <div className="gb-act-date">{col.date}</div>}
                      {col.pct != null && <div className="gb-act-pct">{col.pct}%</div>}
                    </th>
                  ))
                )}
              </tr>
            </thead>

            <tbody>
              {students.map((student, idx) => {
                const fg = finalGrade(student.id)
                const fgLevel = fg != null ? gradeLevel(fg) : null

                return (
                  <tr key={student.id} className={idx % 2 === 0 ? 'gb-row-even' : ''}>
                    <td className="gb-td-num">{idx + 1}</td>
                    <td className="gb-td-student">{displayName(student)}</td>
                    {CATEGORIES.map(cat =>
                      (columns[cat.key] || []).map(col => (
                        <GradeCell
                          key={`${student.id}_${col.id}`}
                          studentId={student.id}
                          col={col}
                          value={getGradeValue(student.id, col)}
                          saving={saving === getGradeKey(student.id, col)}
                          onSave={saveGrade}
                          catColor={cat.color}
                        />
                      ))
                    )}
                    <td className="gb-td-final" style={fgLevel ? { color: fgLevel.color } : undefined}>
                      {fg != null ? (
                        <><strong>{fg.toFixed(2)}</strong></>
                      ) : '—'}
                    </td>
                    <td className="gb-td-level">
                      {fgLevel && (
                        <span className="gb-level-badge" style={{ background: fgLevel.bg, color: fgLevel.color }}>
                          {fgLevel.icon} {fgLevel.label}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            {/* Footer: group averages */}
            <tfoot>
              <tr className="gb-footer-row">
                <td className="gb-td-num"></td>
                <td className="gb-td-student"><strong>Promedio</strong></td>
                {CATEGORIES.map(cat =>
                  (columns[cat.key] || []).map(col => {
                    const vals = students.map(s => getGradeValue(s.id, col)).filter(v => v != null)
                    const avg = vals.length ? vals.reduce((s,v) => s + v, 0) / vals.length : null
                    const lv = avg != null ? gradeLevel(avg) : null
                    return (
                      <td key={col.id} className="gb-td-grade gb-td-avg" style={lv ? { color: lv.color } : undefined}>
                        {avg != null ? avg.toFixed(1) : '—'}
                      </td>
                    )
                  })
                )}
                <td className="gb-td-final">
                  {(() => {
                    const fgs = students.map(s => finalGrade(s.id)).filter(v => v != null)
                    if (!fgs.length) return '—'
                    const avg = fgs.reduce((s,v) => s + v, 0) / fgs.length
                    const lv = gradeLevel(avg)
                    return <strong style={{ color: lv?.color }}>{avg.toFixed(2)}</strong>
                  })()}
                </td>
                <td className="gb-td-level"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Micro-activity modal */}
      {showMicroModal && (
        <MicroActivityModal
          teacher={teacher}
          grade={selectedGrade}
          section={selectedSection}
          subject={selectedSubject}
          period={selectedPeriod}
          students={students}
          onCreated={handleMicroCreated}
          onClose={() => setShowMicroModal(false)}
        />
      )}
    </div>
  )
}

// ── GradeCell — inline editable ───────────────────────────────────────────────
function GradeCell({ studentId, col, value, saving, onSave, catColor }) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef(null)

  const handleClick = () => {
    if (col.rubricType === 'simple') {
      // Cycle through simple rubric values
      const currentIdx = SIMPLE_RUBRIC.findIndex(r => value != null && Math.abs(r.value - value) < 0.5)
      const nextIdx = (currentIdx + 1) % SIMPLE_RUBRIC.length
      onSave(studentId, col, SIMPLE_RUBRIC[nextIdx].value)
    } else {
      setInputVal(value != null ? value.toFixed(1) : '')
      setEditing(true)
    }
  }

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleBlur = () => {
    setEditing(false)
    if (inputVal.trim() && Number(inputVal) !== value) {
      onSave(studentId, col, inputVal)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { handleBlur(); }
    if (e.key === 'Escape') { setEditing(false); }
    // Tab navigation
    if (e.key === 'Tab') { handleBlur(); }
  }

  const lv = value != null ? gradeLevel(value) : null
  const rl = col.rubricType === 'simple' && value != null ? rubricLabel(value) : null

  return (
    <td
      className={`gb-td-grade ${saving ? 'gb-saving' : ''} ${value != null ? 'gb-has-value' : ''}`}
      onClick={!editing ? handleClick : undefined}
      style={{ cursor: 'pointer' }}
    >
      {editing ? (
        <input
          ref={inputRef}
          className="gb-cell-input"
          type="number"
          min="1"
          max="5"
          step="0.1"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      ) : value != null ? (
        <span className="gb-cell-value" style={{ color: lv?.color }}>
          {col.rubricType === 'simple' ? (
            <span className="gb-rubric-badge" style={{ background: rl?.color, color: '#fff' }}>{rl?.short}</span>
          ) : (
            value.toFixed(1)
          )}
        </span>
      ) : (
        <span className="gb-cell-empty">—</span>
      )}
    </td>
  )
}
