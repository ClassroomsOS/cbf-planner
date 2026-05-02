// ── GradingSessionPage.jsx ───────────────────────────────────────────────────
// Phone grading UI: student list with one-tap scoring + group mode.
// Mobile-first, touch targets ≥44px.

import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import useGradingSession from '../hooks/useGradingSession'
import useLiveGrades from '../hooks/useLiveGrades'
import { useToast } from '../context/ToastContext'
import { displayName } from '../utils/studentUtils'
import { gradeLevel } from '../utils/examUtils'

export default function GradingSessionPage({ teacher }) {
  const { id: sessionId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { session, loadSession, closeSession, loading: sessionLoading } = useGradingSession(teacher)
  const { grades, gradeStudent, gradeGroup, loading: gradesLoading } = useLiveGrades(sessionId, teacher)

  const [students, setStudents] = useState([])
  const [groupMode, setGroupMode] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [grading, setGrading] = useState(null) // studentId being graded (flash)

  // Load session on mount
  useEffect(() => { loadSession(sessionId) }, [sessionId, loadSession])

  // Load students for the session's grade+section
  useEffect(() => {
    if (!session?.grade || !session?.section) return
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('school_students')
        .select('id, first_name, second_name, first_lastname, second_lastname, student_code')
        .eq('school_id', teacher.school_id)
        .eq('grade', session.grade)
        .eq('section', session.section)
        .order('first_lastname')
      if (!cancelled) setStudents(data || [])
    }
    load()
    return () => { cancelled = true }
  }, [session?.grade, session?.section, teacher.school_id])

  // Map student_id → grade row
  const gradeMap = useMemo(() => {
    const m = {}
    for (const g of grades) m[g.student_id] = g
    return m
  }, [grades])

  // Score steps based on max_score
  const maxScore = session?.max_score || 5
  const scoreSteps = useMemo(() => {
    if (maxScore <= 5) return Array.from({ length: maxScore }, (_, i) => i + 1)
    if (maxScore <= 10) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(v => v <= maxScore)
    if (maxScore <= 20) return [2, 4, 6, 8, 10, 12, 14, 16, 18, 20].filter(v => v <= maxScore)
    // For larger scales, show 5 evenly spaced values
    const step = maxScore / 5
    return Array.from({ length: 5 }, (_, i) => Math.round(step * (i + 1)))
  }, [maxScore])

  async function handleScore(studentId, score) {
    if (!session) return
    setGrading(studentId)
    const { error } = await gradeStudent({
      studentId,
      newsProjectId: session.news_project_id,
      activityId:    session.activity_id,
      score,
      maxScore:      session.max_score,
    })
    if (error) showToast('Error al calificar', 'error')
    setTimeout(() => setGrading(null), 400)
  }

  async function handleGroupScore(score) {
    if (!session || selected.size === 0) return
    setGrading('group')
    const { error } = await gradeGroup({
      studentIds:    [...selected],
      newsProjectId: session.news_project_id,
      activityId:    session.activity_id,
      score,
      maxScore:      session.max_score,
    })
    if (error) showToast('Error al calificar grupo', 'error')
    else {
      showToast(`${selected.size} estudiantes calificados`, 'success')
      setSelected(new Set())
    }
    setTimeout(() => setGrading(null), 400)
  }

  function toggleStudent(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleClose() {
    await closeSession()
    navigate('/grading')
  }

  // Stats
  const gradedCount = students.filter(s => gradeMap[s.id]).length
  const average = gradedCount > 0
    ? (grades.reduce((sum, g) => sum + Number(g.colombian_grade || 0), 0) / gradedCount).toFixed(1)
    : null
  const avgLevel = average ? gradeLevel(Number(average)) : null

  if (sessionLoading) return <div className="gs-loading">Cargando sesión...</div>
  if (!session) return <div className="gs-loading">Sesión no encontrada</div>

  return (
    <div className="gs-page">
      {/* Header */}
      <div className="gs-header">
        <div className="gs-header-info">
          <strong>{session.activity_name}</strong>
          <span>{session.grade} {session.section} · {session.subject}</span>
        </div>
        <button className="gs-close-btn" onClick={handleClose}>✕</button>
      </div>

      {/* Progress bar */}
      <div className="gs-progress">
        <div className="gs-progress-bar">
          <div className="gs-progress-fill" style={{
            width: `${students.length ? (gradedCount / students.length) * 100 : 0}%`,
            background: avgLevel?.color || '#94a3b8',
          }} />
        </div>
        <span className="gs-progress-text">
          {gradedCount}/{students.length}
          {average && <> · <strong style={{ color: avgLevel?.color }}>{average} {avgLevel?.label}</strong></>}
        </span>
      </div>

      {/* Group mode toggle */}
      <div className="gs-toolbar">
        <button
          className={`gs-group-toggle ${groupMode ? 'active' : ''}`}
          onClick={() => { setGroupMode(!groupMode); setSelected(new Set()) }}
        >
          {groupMode ? '👥 Modo Grupo (ON)' : '👤 Individual'}
        </button>
        {groupMode && selected.size > 0 && (
          <span className="gs-selected-count">{selected.size} seleccionados</span>
        )}
        {/* Projector link */}
        <button className="gs-projector-btn" onClick={() => {
          navigator.clipboard?.writeText(`${window.location.origin}/cbf-planner/grading/display/${sessionId}`)
          showToast('Link del proyector copiado', 'success')
        }}>📺 Link</button>
      </div>

      {/* Group scoring bar (visible when group mode + selection) */}
      {groupMode && selected.size > 0 && (
        <div className="gs-group-bar">
          <span>Calificar {selected.size} estudiantes:</span>
          <div className="gs-score-btns">
            {scoreSteps.map(v => (
              <button
                key={v}
                className="gs-score-btn gs-score-btn-lg"
                onClick={() => handleGroupScore(v)}
                disabled={grading === 'group'}
              >{v}</button>
            ))}
          </div>
        </div>
      )}

      {/* Student list */}
      <div className="gs-students">
        {gradesLoading ? <div className="gs-loading">Cargando...</div> : students.map(s => {
          const g = gradeMap[s.id]
          const level = g ? gradeLevel(Number(g.colombian_grade)) : null
          const isGrading = grading === s.id

          return (
            <div
              key={s.id}
              className={`gs-student ${isGrading ? 'gs-flash' : ''} ${g ? 'gs-graded' : ''}`}
              style={g ? { borderLeftColor: level?.color || '#94a3b8' } : undefined}
            >
              {groupMode && (
                <input
                  type="checkbox"
                  className="gs-check"
                  checked={selected.has(s.id)}
                  onChange={() => toggleStudent(s.id)}
                />
              )}
              <div className="gs-student-info">
                <span className="gs-student-name">{displayName(s)}</span>
                {g && (
                  <span className="gs-student-grade" style={{ color: level?.color }}>
                    {Number(g.colombian_grade).toFixed(1)} {level?.icon}
                  </span>
                )}
              </div>
              {!groupMode && (
                <div className="gs-score-btns">
                  {scoreSteps.map(v => (
                    <button
                      key={v}
                      className={`gs-score-btn ${g && Number(g.score) === v ? 'active' : ''}`}
                      onClick={() => handleScore(s.id, v)}
                      style={g && Number(g.score) === v ? { background: level?.color, color: '#fff' } : undefined}
                    >{v}</button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
