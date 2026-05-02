// ── GradingHistoryPage.jsx ─────────────────────────────────────────────────
// Historical grades per NEWS project + weighted average per indicator.
// Teacher selects project → sees all activities with per-student grades.

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { displayName } from '../utils/studentUtils'
import { gradeLevel } from '../utils/examUtils'
import { useToast } from '../context/ToastContext'

export default function GradingHistoryPage({ teacher }) {
  const { showToast } = useToast()
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null)
  const [students, setStudents] = useState([])
  const [grades, setGrades] = useState([])
  const [loading, setLoading] = useState(true)

  // Load teacher's NEWS projects that have evaluative activities
  useEffect(() => {
    if (!teacher?.id) return
    supabase
      .from('news_projects')
      .select('id, title, grade, section, subject, actividades_evaluativas, skill')
      .eq('teacher_id', teacher.id)
      .not('actividades_evaluativas', 'is', null)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { showToast('Error cargando proyectos', 'error'); return }
        const withActs = (data || []).filter(p =>
          Array.isArray(p.actividades_evaluativas) && p.actividades_evaluativas.length > 0
        )
        setProjects(withActs)
        setLoading(false)
      })
  }, [teacher?.id])

  // When project selected, load students + grades
  useEffect(() => {
    if (!selectedProject || !teacher?.school_id) return
    const p = selectedProject

    // Load students for this grade+section
    supabase
      .from('school_students')
      .select('id, first_name, second_name, first_lastname, second_lastname, student_code')
      .eq('school_id', teacher.school_id)
      .eq('grade', p.grade)
      .eq('section', p.section)
      .order('first_lastname')
      .then(({ data }) => setStudents(data || []))

    // Load all grades for this project
    supabase
      .from('student_activity_grades')
      .select('*')
      .eq('news_project_id', p.id)
      .then(({ data }) => setGrades(data || []))
  }, [selectedProject?.id, teacher?.school_id])

  // Build grade lookup: { studentId: { activityId: grade } }
  const gradeMap = useMemo(() => {
    const m = {}
    for (const g of grades) {
      if (!m[g.student_id]) m[g.student_id] = {}
      m[g.student_id][g.activity_id] = g
    }
    return m
  }, [grades])

  const activities = selectedProject?.actividades_evaluativas || []

  // Compute weighted average for a student
  function weightedAvg(studentId) {
    const sg = gradeMap[studentId]
    if (!sg) return null
    let totalWeight = 0, weightedSum = 0
    for (const act of activities) {
      const g = sg[act.id]
      if (g && g.colombian_grade != null) {
        const w = act.porcentaje || 0
        weightedSum += Number(g.colombian_grade) * w
        totalWeight += w
      }
    }
    return totalWeight > 0 ? weightedSum / totalWeight : null
  }

  // Class average per activity
  function activityAvg(actId) {
    const relevant = grades.filter(g => g.activity_id === actId && g.colombian_grade != null)
    if (!relevant.length) return null
    return relevant.reduce((s, g) => s + Number(g.colombian_grade), 0) / relevant.length
  }

  if (loading) return <div className="gh-loading">Cargando...</div>

  return (
    <div className="gh-page">
      <div className="gh-header">
        <h2>📊 Historial de Calificaciones</h2>
        <p className="gh-subtitle">Selecciona un proyecto NEWS para ver las notas por actividad</p>
      </div>

      {/* Project selector */}
      <div className="gh-selector">
        <select
          value={selectedProject?.id || ''}
          onChange={e => {
            const p = projects.find(pr => pr.id === e.target.value)
            setSelectedProject(p || null)
          }}
        >
          <option value="">— Seleccionar proyecto —</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>
              {p.title} · {p.grade} {p.section} · {p.subject}
            </option>
          ))}
        </select>
      </div>

      {selectedProject && activities.length > 0 && (
        <div className="gh-table-wrap">
          <table className="gh-table">
            <thead>
              <tr>
                <th className="gh-th-student">Estudiante</th>
                {activities.map(act => (
                  <th key={act.id} className="gh-th-act">
                    <div className="gh-act-name">{act.nombre}</div>
                    <div className="gh-act-pct">{act.porcentaje}%</div>
                  </th>
                ))}
                <th className="gh-th-avg">Promedio</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => {
                const avg = weightedAvg(s.id)
                const level = avg != null ? gradeLevel(avg) : null
                return (
                  <tr key={s.id}>
                    <td className="gh-td-student">{displayName(s)}</td>
                    {activities.map(act => {
                      const g = gradeMap[s.id]?.[act.id]
                      const val = g?.colombian_grade != null ? Number(g.colombian_grade) : null
                      const lv = val != null ? gradeLevel(val) : null
                      return (
                        <td key={act.id} className="gh-td-grade" style={lv ? { color: lv.color } : undefined}>
                          {val != null ? val.toFixed(1) : '—'}
                        </td>
                      )
                    })}
                    <td className="gh-td-avg" style={level ? { color: level.color, fontWeight: 700 } : undefined}>
                      {avg != null ? (
                        <>{avg.toFixed(1)} {level?.icon}</>
                      ) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="gh-footer-row">
                <td className="gh-td-student"><strong>Promedio grupo</strong></td>
                {activities.map(act => {
                  const avg = activityAvg(act.id)
                  const lv = avg != null ? gradeLevel(avg) : null
                  return (
                    <td key={act.id} className="gh-td-grade" style={lv ? { color: lv.color, fontWeight: 600 } : undefined}>
                      {avg != null ? avg.toFixed(1) : '—'}
                    </td>
                  )
                })}
                <td className="gh-td-avg">
                  {(() => {
                    const allAvgs = students.map(s => weightedAvg(s.id)).filter(a => a != null)
                    if (!allAvgs.length) return '—'
                    const grand = allAvgs.reduce((s, v) => s + v, 0) / allAvgs.length
                    const lv = gradeLevel(grand)
                    return <strong style={{ color: lv?.color }}>{grand.toFixed(1)} {lv?.icon}</strong>
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {selectedProject && activities.length === 0 && (
        <div className="gh-empty">Este proyecto no tiene actividades evaluativas configuradas.</div>
      )}

      {!selectedProject && projects.length === 0 && (
        <div className="gh-empty">No tienes proyectos NEWS con actividades evaluativas.</div>
      )}
    </div>
  )
}
