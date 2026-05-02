// ── GradebookPage.jsx ─────────────────────────────────────────────────────────
// Sábana de calificaciones institucional por grado+sección+materia+período.
// 5 categorías: Actividades Generales, Actividades Evaluativas, Meta Digital,
//               Meta Axiológica, Evaluación Final.
// Columnas auto-detectadas desde NEWS actividades_evaluativas + micro_activities.
// Celdas editables inline. Enter → guarda + baja al siguiente estudiante.

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { displayName } from '../utils/studentUtils'
import { gradeLevel } from '../utils/examUtils'
import { useToast } from '../context/ToastContext'
import MicroActivityModal from '../components/MicroActivityModal'

// ── Categorías institucionales Boston Flex ───────────────────────────────────
const CATEGORIES = [
  { key: 'general',     label: 'Actividades Generales',   weight: 20, color: '#15803D', bg: '#DCFCE7', icon: '📋' },
  { key: 'cognitiva',   label: 'Actividades Evaluativas', weight: 15, color: '#1D4ED8', bg: '#DBEAFE', icon: '📝' },
  { key: 'digital',     label: 'Meta Digital',            weight: 20, color: '#D97706', bg: '#FEF3C7', icon: '💻' },
  { key: 'axiologica',  label: 'Meta Axiológica',         weight: 15, color: '#9333EA', bg: '#F3E8FF', icon: '✝️' },
]
// Evaluación Final (30%) is a fixed single column, not a category with sub-activities
const FINAL_WEIGHT = 30

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
  const tableRef = useRef(null)

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
  const [saving, setSaving] = useState(null)

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

  useEffect(() => {
    if (sectionsForGrade.length && !sectionsForGrade.includes(selectedSection))
      setSelectedSection(sectionsForGrade[0])
  }, [sectionsForGrade])
  useEffect(() => {
    if (subjectsForGradeSection.length && !subjectsForGradeSection.includes(selectedSubject))
      setSelectedSubject(subjectsForGradeSection[0])
  }, [subjectsForGradeSection])

  // ── Load data when selection changes ────────────────────────────────────────
  const hasSelection = selectedGrade && selectedSection && selectedSubject

  useEffect(() => {
    if (!hasSelection || !teacher?.school_id) return
    setLoading(true)

    Promise.all([
      supabase.from('school_students')
        .select('id, first_name, second_name, first_lastname, second_lastname, student_code')
        .eq('school_id', teacher.school_id)
        .eq('grade', selectedGrade)
        .eq('section', selectedSection)
        .order('first_lastname'),
      supabase.from('news_projects')
        .select('id, title, grade, section, subject, actividades_evaluativas, skill, period')
        .eq('teacher_id', teacher.id)
        .eq('subject', selectedSubject)
        .eq('grade', selectedGrade)
        .eq('section', selectedSection)
        .eq('period', selectedPeriod),
      supabase.from('micro_activities')
        .select('*')
        .eq('teacher_id', teacher.id)
        .eq('grade', selectedGrade)
        .eq('section', selectedSection)
        .eq('subject', selectedSubject)
        .eq('period', selectedPeriod)
        .eq('status', 'active')
        .order('activity_date'),
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

  // ── Build columns ──────────────────────────────────────────────────────────
  const columns = useMemo(() => {
    const cols = { general: [], cognitiva: [], digital: [], axiologica: [] }

    for (const project of newsProjects) {
      for (const act of (project.actividades_evaluativas || [])) {
        const cat = act.categoria || 'cognitiva'
        if (cols[cat]) {
          cols[cat].push({
            id: act.id, name: act.nombre, date: act.fecha, pct: act.porcentaje,
            source: 'news', projectId: project.id, projectTitle: project.title,
            rubricType: 'numeric',
          })
        }
      }
    }

    for (const micro of microActivities) {
      const cat = micro.category || 'cognitiva'
      if (cols[cat]) {
        cols[cat].push({
          id: micro.id, name: micro.name, date: micro.activity_date,
          source: 'micro', microId: micro.id,
          rubricType: micro.rubric_type, groupMode: micro.group_mode,
        })
      }
    }

    return cols
  }, [newsProjects, microActivities])

  // Flat list of all activity columns (for cell navigation)
  const allCols = useMemo(() => {
    const flat = []
    for (const cat of CATEGORIES) flat.push(...(columns[cat.key] || []))
    flat.push({ id: `final_${selectedPeriod}`, name: 'Examen Final', source: 'final', rubricType: 'numeric' })
    return flat
  }, [columns, selectedPeriod])

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
    const g = gradeMap[getGradeKey(studentId, col)]
    return g ? Number(g.colombian_grade || g.score) : null
  }

  // ── Save grade ──────────────────────────────────────────────────────────────
  const saveGrade = useCallback(async (studentId, col, value) => {
    const numVal = Number(value)
    if (isNaN(numVal) || numVal < 1 || numVal > 5) return

    const cellKey = getGradeKey(studentId, col)
    setSaving(cellKey)

    const row = {
      school_id: teacher.school_id, teacher_id: teacher.id,
      student_id: studentId, score: numVal, max_score: 5,
    }
    if (col.source === 'micro') row.micro_activity_id = col.microId
    else if (col.source === 'final') row.activity_id = `final_${selectedPeriod}`
    else { row.news_project_id = col.projectId; row.activity_id = col.id }

    const existing = gradeMap[cellKey]
    const result = existing
      ? await supabase.from('student_activity_grades').update({ score: numVal, max_score: 5 }).eq('id', existing.id).select()
      : await supabase.from('student_activity_grades').insert(row).select()

    if (result.error) {
      showToast('Error guardando nota', 'error')
    } else if (result.data?.[0]) {
      setGrades(prev => {
        const idx = prev.findIndex(g => g.id === result.data[0].id)
        if (idx >= 0) { const n = [...prev]; n[idx] = result.data[0]; return n }
        return [...prev, result.data[0]]
      })
    }
    setSaving(null)
  }, [teacher, gradeMap, selectedPeriod])

  // ── Averages ────────────────────────────────────────────────────────────────
  function categoryAvg(studentId, catKey) {
    const catCols = columns[catKey] || []
    if (!catCols.length) return null
    const vals = catCols.map(c => getGradeValue(studentId, c)).filter(v => v != null)
    if (!vals.length) return null
    return vals.reduce((s, v) => s + v, 0) / vals.length
  }

  const finalCol = { id: `final_${selectedPeriod}`, source: 'final', rubricType: 'numeric' }

  function computeFinalGrade(studentId) {
    let total = 0, wSum = 0
    for (const cat of CATEGORIES) {
      const avg = categoryAvg(studentId, cat.key)
      if (avg != null) { total += avg * cat.weight; wSum += cat.weight }
    }
    const fv = getGradeValue(studentId, finalCol)
    if (fv != null) { total += fv * FINAL_WEIGHT; wSum += FINAL_WEIGHT }
    return wSum > 0 ? total / wSum : null
  }

  // ── Callbacks ───────────────────────────────────────────────────────────────
  const handleMicroCreated = (micro) => {
    setMicroActivities(prev => [...prev, micro])
    setShowMicroModal(false)
    showToast('Micro-actividad creada', 'success')
  }

  // Check if any category has columns
  const hasColumns = CATEGORIES.some(c => (columns[c.key] || []).length > 0)

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
          <button className="gb-add-micro-btn" onClick={() => setShowMicroModal(true)}>+ Micro-actividad</button>
          <button className="gb-history-btn" onClick={() => navigate('/grading')}>📋 Calificación rápida</button>
        </div>
      </div>

      {/* Weight legend */}
      <div className="gb-legend">
        {CATEGORIES.map(c => (
          <span key={c.key} className="gb-legend-item" style={{ background: c.bg, color: c.color }}>
            {c.icon} {c.label} ({c.weight}%)
          </span>
        ))}
        <span className="gb-legend-item" style={{ background: '#EDE9FE', color: '#7C3AED' }}>
          🎓 Evaluación Final ({FINAL_WEIGHT}%)
        </span>
      </div>

      {loading ? (
        <div className="gb-loading">Cargando sábana...</div>
      ) : !hasSelection ? (
        <div className="gb-empty">Selecciona grado, sección y materia para ver la sábana.</div>
      ) : (
        <div className="gb-table-wrap" ref={tableRef}>
          <table className="gb-table">
            <thead>
              {/* Row 1: Category group headers */}
              <tr className="gb-cat-row">
                <th className="gb-th-num gb-sticky-col" rowSpan={2}>#</th>
                <th className="gb-th-student gb-sticky-col" rowSpan={2}>Estudiantes</th>
                {CATEGORIES.map(cat => {
                  const catCols = columns[cat.key] || []
                  // +1 for subtotal column
                  const span = catCols.length + (catCols.length > 0 ? 1 : 0)
                  if (!span) return null
                  return (
                    <th key={cat.key} colSpan={span} className="gb-th-cat" style={{ background: cat.color, color: '#fff' }}>
                      {cat.icon} {cat.label} <span className="gb-th-cat-pct">{cat.weight}%</span>
                    </th>
                  )
                })}
                <th className="gb-th-final-header" rowSpan={2}>
                  🎓 Eval. Final<br/><span className="gb-th-cat-pct">{FINAL_WEIGHT}%</span>
                </th>
                <th className="gb-th-total" rowSpan={2}>DEF</th>
              </tr>

              {/* Row 2: Activity sub-headers */}
              <tr className="gb-act-row">
                {CATEGORIES.map(cat => {
                  const catCols = columns[cat.key] || []
                  if (!catCols.length) return null
                  return [
                    ...catCols.map(col => (
                      <th key={col.id} className="gb-th-act" style={{ borderTopColor: cat.color }}>
                        <div className="gb-act-name" title={col.name}>{col.name}</div>
                        {col.date && <div className="gb-act-date">{col.date}</div>}
                      </th>
                    )),
                    <th key={`${cat.key}_sub`} className="gb-th-subtotal" style={{ borderTopColor: cat.color }}>
                      <div className="gb-act-name">Prom.</div>
                    </th>
                  ]
                })}
              </tr>
            </thead>

            <tbody>
              {students.map((student, idx) => {
                const fg = computeFinalGrade(student.id)
                const fgLevel = fg != null ? gradeLevel(fg) : null

                return (
                  <tr key={student.id}>
                    <td className="gb-td-num gb-sticky-col">{idx + 1}</td>
                    <td className="gb-td-student gb-sticky-col">{displayName(student)}</td>
                    {CATEGORIES.map(cat => {
                      const catCols = columns[cat.key] || []
                      if (!catCols.length) return null
                      const avg = categoryAvg(student.id, cat.key)
                      const avgLv = avg != null ? gradeLevel(avg) : null
                      return [
                        ...catCols.map((col, ci) => (
                          <GradeCell
                            key={`${student.id}_${col.id}`}
                            studentId={student.id}
                            studentIdx={idx}
                            col={col}
                            colIdx={ci}
                            value={getGradeValue(student.id, col)}
                            saving={saving === getGradeKey(student.id, col)}
                            onSave={saveGrade}
                            students={students}
                            tableRef={tableRef}
                          />
                        )),
                        <td key={`${student.id}_${cat.key}_sub`} className="gb-td-subtotal" style={avgLv ? { color: avgLv.color } : undefined}>
                          {avg != null ? avg.toFixed(1) : '—'}
                        </td>
                      ]
                    })}
                    <GradeCell
                      key={`${student.id}_final`}
                      studentId={student.id}
                      studentIdx={idx}
                      col={finalCol}
                      colIdx={allCols.length - 1}
                      value={getGradeValue(student.id, finalCol)}
                      saving={saving === getGradeKey(student.id, finalCol)}
                      onSave={saveGrade}
                      students={students}
                      tableRef={tableRef}
                      isFinal
                    />
                    <td className="gb-td-def">
                      {fg != null ? (
                        <span className="gb-def-value" style={{ color: fgLevel?.color }}>
                          <strong>{fg.toFixed(2)}</strong>
                          <span className="gb-def-label">{fgLevel?.label}</span>
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            <tfoot>
              <tr className="gb-footer-row">
                <td className="gb-td-num gb-sticky-col"></td>
                <td className="gb-td-student gb-sticky-col"><strong>Promedio</strong></td>
                {CATEGORIES.map(cat => {
                  const catCols = columns[cat.key] || []
                  if (!catCols.length) return null
                  // Per-activity group average
                  const catAvgs = students.map(s => categoryAvg(s.id, cat.key)).filter(v => v != null)
                  const groupCatAvg = catAvgs.length ? catAvgs.reduce((s,v) => s + v, 0) / catAvgs.length : null
                  const groupCatLv = groupCatAvg != null ? gradeLevel(groupCatAvg) : null
                  return [
                    ...catCols.map(col => {
                      const vals = students.map(s => getGradeValue(s.id, col)).filter(v => v != null)
                      const avg = vals.length ? vals.reduce((s,v) => s + v, 0) / vals.length : null
                      const lv = avg != null ? gradeLevel(avg) : null
                      return (
                        <td key={col.id} className="gb-td-grade gb-td-footer-grade" style={lv ? { color: lv.color } : undefined}>
                          {avg != null ? avg.toFixed(1) : '—'}
                        </td>
                      )
                    }),
                    <td key={`${cat.key}_sub_footer`} className="gb-td-subtotal gb-td-footer-grade" style={groupCatLv ? { color: groupCatLv.color } : undefined}>
                      <strong>{groupCatAvg != null ? groupCatAvg.toFixed(1) : '—'}</strong>
                    </td>
                  ]
                })}
                <td className="gb-td-grade gb-td-footer-grade">
                  {(() => {
                    const vals = students.map(s => getGradeValue(s.id, finalCol)).filter(v => v != null)
                    if (!vals.length) return '—'
                    const avg = vals.reduce((s,v) => s + v, 0) / vals.length
                    const lv = gradeLevel(avg)
                    return <strong style={{ color: lv?.color }}>{avg.toFixed(1)}</strong>
                  })()}
                </td>
                <td className="gb-td-def">
                  {(() => {
                    const fgs = students.map(s => computeFinalGrade(s.id)).filter(v => v != null)
                    if (!fgs.length) return '—'
                    const avg = fgs.reduce((s,v) => s + v, 0) / fgs.length
                    const lv = gradeLevel(avg)
                    return <strong style={{ color: lv?.color }}>{avg.toFixed(2)}</strong>
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

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

// ── GradeCell — inline editable + Enter→next row ─────────────────────────────
function GradeCell({ studentId, studentIdx, col, colIdx, value, saving, onSave, students, tableRef, isFinal }) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef(null)
  const cellRef = useRef(null)

  const handleClick = () => {
    if (col.rubricType === 'simple') {
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

  const commitAndClose = useCallback(() => {
    setEditing(false)
    if (inputVal.trim() && Number(inputVal) !== value) {
      onSave(studentId, col, inputVal)
    }
  }, [inputVal, value, studentId, col, onSave])

  // Focus the cell in the next row (same column)
  const focusNextRow = useCallback(() => {
    if (!tableRef?.current) return
    const nextStudentIdx = studentIdx + 1
    if (nextStudentIdx >= students.length) return
    // Find all grade cells in the table body, click the matching one
    const rows = tableRef.current.querySelectorAll('tbody tr')
    if (rows[nextStudentIdx]) {
      // Find the td at same position: skip #, name, then count to our column
      const cells = rows[nextStudentIdx].querySelectorAll('td.gb-td-grade, td.gb-td-final-cell')
      // We need to find the cell with the same data-col-id
      const target = rows[nextStudentIdx].querySelector(`[data-col-id="${col.id}"]`)
      if (target) target.click()
    }
  }, [studentIdx, students, col.id, tableRef])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitAndClose()
      // Move to next student below after a tick (so state updates)
      setTimeout(focusNextRow, 50)
    }
    if (e.key === 'Escape') setEditing(false)
    if (e.key === 'Tab') commitAndClose()
  }

  const lv = value != null ? gradeLevel(value) : null
  const rl = col.rubricType === 'simple' && value != null ? rubricLabel(value) : null

  return (
    <td
      ref={cellRef}
      data-col-id={col.id}
      className={`gb-td-grade ${isFinal ? 'gb-td-final-cell' : ''} ${saving ? 'gb-saving' : ''} ${value != null ? 'gb-has-value' : ''}`}
      onClick={!editing ? handleClick : undefined}
    >
      {editing ? (
        <input
          ref={inputRef}
          className="gb-cell-input"
          type="number" min="1" max="5" step="0.1"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onBlur={commitAndClose}
          onKeyDown={handleKeyDown}
        />
      ) : value != null ? (
        <span className="gb-cell-value" style={{ color: lv?.color }}>
          {col.rubricType === 'simple' ? (
            <span className="gb-rubric-badge" style={{ background: rl?.color, color: '#fff' }}>{rl?.short}</span>
          ) : value.toFixed(1)}
        </span>
      ) : (
        <span className="gb-cell-empty">—</span>
      )}
    </td>
  )
}
