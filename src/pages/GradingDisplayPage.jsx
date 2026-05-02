// ── GradingDisplayPage.jsx ───────────────────────────────────────────────────
// Projector/TV view: large grid of student cards with real-time grade updates.
// Optimized for 1080p+ display. Animated grade arrivals.

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import useLiveGrades from '../hooks/useLiveGrades'
import { displayName } from '../utils/studentUtils'
import { gradeLevel } from '../utils/examUtils'

export default function GradingDisplayPage({ teacher }) {
  const { id: sessionId } = useParams()
  const { grades, loading: gradesLoading } = useLiveGrades(sessionId, teacher)

  const [session, setSession] = useState(null)
  const [students, setStudents] = useState([])
  const [recentId, setRecentId] = useState(null) // flash animation for latest grade

  // Load session
  useEffect(() => {
    if (!sessionId) return
    supabase
      .from('grading_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()
      .then(({ data }) => setSession(data))
  }, [sessionId])

  // Load students
  useEffect(() => {
    if (!session?.grade || !session?.section || !teacher?.school_id) return
    supabase
      .from('school_students')
      .select('id, first_name, second_name, first_lastname, second_lastname, student_code')
      .eq('school_id', teacher.school_id)
      .eq('grade', session.grade)
      .eq('section', session.section)
      .order('first_lastname')
      .then(({ data }) => setStudents(data || []))
  }, [session?.grade, session?.section, teacher?.school_id])

  // Detect newly arrived grades for animation
  const gradeMap = useMemo(() => {
    const m = {}
    for (const g of grades) m[g.student_id] = g
    return m
  }, [grades])

  // Flash effect: track latest grade change
  useEffect(() => {
    if (!grades.length) return
    const latest = grades.reduce((a, b) =>
      new Date(b.updated_at || b.graded_at) > new Date(a.updated_at || a.graded_at) ? b : a
    )
    setRecentId(latest.student_id)
    const t = setTimeout(() => setRecentId(null), 1500)
    return () => clearTimeout(t)
  }, [grades])

  // Stats
  const gradedCount = students.filter(s => gradeMap[s.id]).length
  const average = gradedCount > 0
    ? (grades.reduce((sum, g) => sum + Number(g.colombian_grade || 0), 0) / gradedCount).toFixed(1)
    : null
  const avgLevel = average ? gradeLevel(Number(average)) : null

  if (!session && !gradesLoading) return <div className="gd-loading">Sesión no encontrada</div>

  return (
    <div className="gd-page">
      {/* Header */}
      <div className="gd-header">
        <div className="gd-header-left">
          <strong className="gd-title">{session?.activity_name || 'Cargando...'}</strong>
          <span className="gd-subtitle">
            {session?.grade} {session?.section} · {session?.subject} · {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
        <div className="gd-header-right">
          {session?.status === 'active' && <span className="gd-live-dot" />}
          <span className="gd-live-text">{session?.status === 'active' ? 'EN VIVO' : session?.status?.toUpperCase()}</span>
        </div>
      </div>

      {/* Student grid */}
      <div className="gd-grid">
        {students.map(s => {
          const g = gradeMap[s.id]
          const level = g ? gradeLevel(Number(g.colombian_grade)) : null
          const isRecent = recentId === s.id

          return (
            <div
              key={s.id}
              className={`gd-card ${g ? 'gd-card-graded' : 'gd-card-pending'} ${isRecent ? 'gd-card-flash' : ''}`}
              style={g ? { borderColor: level?.color, boxShadow: isRecent ? `0 0 20px ${level?.color}40` : undefined } : undefined}
            >
              <div className="gd-card-name">{displayName(s)}</div>
              {g ? (
                <div className="gd-card-grade" style={{ color: level?.color }}>
                  <span className="gd-card-number">{Number(g.colombian_grade).toFixed(1)}</span>
                  <span className="gd-card-level">{level?.icon} {level?.label}</span>
                </div>
              ) : (
                <div className="gd-card-grade gd-card-pending-grade">—</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer progress */}
      <div className="gd-footer">
        <div className="gd-progress-bar">
          <div className="gd-progress-fill" style={{
            width: `${students.length ? (gradedCount / students.length) * 100 : 0}%`,
            background: avgLevel?.color || '#94a3b8',
          }} />
        </div>
        <div className="gd-stats">
          <span>{gradedCount} de {students.length} calificados</span>
          {average && (
            <span className="gd-avg" style={{ color: avgLevel?.color }}>
              Promedio: <strong>{average}</strong> {avgLevel?.icon} {avgLevel?.label}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
