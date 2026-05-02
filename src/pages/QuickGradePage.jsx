// ── QuickGradePage.jsx ─────────────────────────────────────────────────────
// Mobile-first grading for micro-activities.
// Individual: tap rubric level per student.
// Group: tap rubric level per team → applies to all members.

import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { displayName } from '../utils/studentUtils'
import { gradeLevel } from '../utils/examUtils'
import { useToast } from '../context/ToastContext'
import { SIMPLE_RUBRIC } from './GradebookPage'

export default function QuickGradePage({ teacher }) {
  const { id: microId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [micro, setMicro] = useState(null)
  const [students, setStudents] = useState([])
  const [groups, setGroups] = useState([])
  const [grades, setGrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  // Load micro-activity + students + groups + existing grades
  useEffect(() => {
    if (!microId || !teacher?.school_id) return

    Promise.all([
      supabase.from('micro_activities').select('*').eq('id', microId).single(),
      supabase.from('micro_activity_groups').select('*').eq('micro_activity_id', microId),
      supabase.from('student_activity_grades').select('*').eq('micro_activity_id', microId),
    ]).then(([microRes, groupsRes, gradesRes]) => {
      const m = microRes.data
      setMicro(m)
      setGroups(groupsRes.data || [])
      setGrades(gradesRes.data || [])

      if (m) {
        supabase.from('school_students')
          .select('id, first_name, second_name, first_lastname, second_lastname, student_code')
          .eq('school_id', teacher.school_id)
          .eq('grade', m.grade)
          .eq('section', m.section)
          .order('first_lastname')
          .then(({ data }) => { setStudents(data || []); setLoading(false) })
      } else {
        setLoading(false)
      }
    })
  }, [microId, teacher?.school_id])

  // Grade map: studentId → grade record
  const gradeMap = useMemo(() => {
    const m = {}
    for (const g of grades) m[g.student_id] = g
    return m
  }, [grades])

  // ── Save grade (individual or group) ────────────────────────────────────────
  async function gradeStudent(studentId, value) {
    setSaving(studentId)
    const existing = gradeMap[studentId]

    let result
    if (existing) {
      result = await supabase.from('student_activity_grades')
        .update({ score: value, max_score: 5 })
        .eq('id', existing.id)
        .select()
    } else {
      result = await supabase.from('student_activity_grades')
        .insert({
          school_id: teacher.school_id,
          teacher_id: teacher.id,
          student_id: studentId,
          micro_activity_id: microId,
          score: value,
          max_score: 5,
        })
        .select()
    }

    if (result.error) {
      showToast('Error guardando', 'error')
    } else if (result.data?.[0]) {
      setGrades(prev => {
        const idx = prev.findIndex(g => g.id === result.data[0].id)
        if (idx >= 0) { const n = [...prev]; n[idx] = result.data[0]; return n }
        return [...prev, result.data[0]]
      })
    }
    setSaving(null)
  }

  async function gradeGroup(group, value) {
    for (const sid of group.student_ids) {
      await gradeStudent(sid, value)
    }
  }

  // Stats
  const gradedCount = students.filter(s => gradeMap[s.id]).length
  const studentMap = Object.fromEntries(students.map(s => [s.id, s]))

  if (loading) return <div className="qg-loading">Cargando...</div>
  if (!micro) return <div className="qg-loading">Actividad no encontrada</div>

  return (
    <div className="qg-page">
      {/* Header */}
      <div className="qg-header">
        <button className="qg-back" onClick={() => navigate('/grades')}>← Sábana</button>
        <div className="qg-header-info">
          <h3>{micro.name}</h3>
          <span className="qg-meta">
            {micro.grade} {micro.section} · {micro.subject} · {micro.activity_date}
          </span>
        </div>
      </div>

      {/* Stats bar */}
      <div className="qg-stats">
        <span>{gradedCount} de {students.length} calificados</span>
        <span className="qg-rubric-legend">
          {SIMPLE_RUBRIC.map(r => (
            <span key={r.short} className="qg-legend-dot" style={{ background: r.color }}>{r.short}</span>
          ))}
        </span>
      </div>

      {/* Group mode */}
      {micro.group_mode && groups.length > 0 ? (
        <div className="qg-groups">
          {groups.map(group => (
            <div key={group.id} className="qg-group-card">
              <div className="qg-group-header">
                <strong>{group.group_label}</strong>
                <span className="qg-group-count">{group.student_ids.length} miembros</span>
              </div>
              <div className="qg-group-members">
                {group.student_ids.map(sid => {
                  const s = studentMap[sid]
                  if (!s) return null
                  const g = gradeMap[sid]
                  const lv = g ? gradeLevel(Number(g.colombian_grade || g.score)) : null
                  return (
                    <div key={sid} className="qg-member">
                      <span>{displayName(s)}</span>
                      {lv && <span className="qg-member-badge" style={{ background: lv.bg, color: lv.color }}>{lv.icon}</span>}
                    </div>
                  )
                })}
              </div>
              <div className="qg-rubric-btns">
                {SIMPLE_RUBRIC.map(r => (
                  <button
                    key={r.short}
                    className="qg-rubric-btn"
                    style={{ background: r.color }}
                    onClick={() => gradeGroup(group, r.value)}
                    disabled={saving != null}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Individual mode */
        <div className="qg-student-list">
          {students.map(student => {
            const g = gradeMap[student.id]
            const currentVal = g ? Number(g.score) : null
            const lv = g ? gradeLevel(Number(g.colombian_grade || g.score)) : null
            const isSaving = saving === student.id

            return (
              <div key={student.id} className={`qg-student-row ${g ? 'qg-graded' : ''}`}>
                <div className="qg-student-name">
                  <span>{displayName(student)}</span>
                  {lv && <span className="qg-current-badge" style={{ background: lv.bg, color: lv.color }}>
                    {lv.icon} {lv.label}
                  </span>}
                </div>
                <div className="qg-rubric-btns">
                  {micro.rubric_type === 'simple' ? (
                    SIMPLE_RUBRIC.map(r => (
                      <button
                        key={r.short}
                        className={`qg-rubric-btn ${currentVal === r.value ? 'qg-selected' : ''}`}
                        style={{
                          background: currentVal === r.value ? r.color : 'transparent',
                          color: currentVal === r.value ? '#fff' : r.color,
                          borderColor: r.color,
                        }}
                        onClick={() => gradeStudent(student.id, r.value)}
                        disabled={isSaving}
                      >
                        {r.short}
                      </button>
                    ))
                  ) : (
                    [1,2,3,4,5].map(v => {
                      const sc = gradeLevel(v)
                      return (
                        <button
                          key={v}
                          className={`qg-num-btn ${currentVal === v ? 'qg-selected' : ''}`}
                          style={{
                            background: currentVal === v ? sc?.color : 'transparent',
                            color: currentVal === v ? '#fff' : sc?.color,
                            borderColor: sc?.color,
                          }}
                          onClick={() => gradeStudent(student.id, v)}
                          disabled={isSaving}
                        >
                          {v}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
