// ── AttendancePanel.jsx ────────────────────────────────────────────────────────
// Phone-first attendance UI. Teacher taps absent students; all others = present.
// Auto-saves on each tap. Optimistic UI with rollback on error.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabase'
import { useToast } from '../../context/ToastContext'
import { displayName } from '../../utils/studentUtils'

export default function AttendancePanel({ teacher, students, grade, section, assignments }) {
  const { showToast } = useToast()
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [subject, setSubject] = useState('')
  const [records, setRecords] = useState({}) // { studentId: 'present'|'absent'|'late'|'excused' }
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(null)

  // Subjects from teacher assignments for this grade+section
  const subjects = (assignments || [])
    .filter(a => a.grade === grade && a.section === section)
    .map(a => a.subject)
    .filter((v, i, arr) => arr.indexOf(v) === i)

  useEffect(() => {
    if (subjects.length && !subject) setSubject(subjects[0])
  }, [subjects.length])

  // Load existing attendance for selected date+subject
  useEffect(() => {
    if (!date || !subject || !students.length) return
    setLoading(true)
    supabase.from('student_attendance')
      .select('student_id, status')
      .eq('teacher_id', teacher.id)
      .eq('attendance_date', date)
      .eq('subject', subject)
      .then(({ data }) => {
        const map = {}
        for (const r of (data || [])) map[r.student_id] = r.status
        // Default all students to present if no record
        for (const s of students) {
          if (!map[s.id]) map[s.id] = 'present'
        }
        setRecords(map)
        setLoading(false)
      })
  }, [date, subject, students, teacher.id])

  const toggleStatus = useCallback(async (studentId) => {
    const current = records[studentId] || 'present'
    const next = current === 'present' ? 'absent'
               : current === 'absent' ? 'late'
               : current === 'late' ? 'excused'
               : 'present'

    // Optimistic update
    setRecords(prev => ({ ...prev, [studentId]: next }))
    setSaving(studentId)

    const row = {
      school_id: teacher.school_id,
      student_id: studentId,
      teacher_id: teacher.id,
      attendance_date: date,
      subject,
      status: next,
    }

    const { error } = await supabase.from('student_attendance')
      .upsert(row, { onConflict: 'student_id,attendance_date,teacher_id,subject' })

    if (error) {
      // Rollback
      setRecords(prev => ({ ...prev, [studentId]: current }))
      showToast('Error guardando asistencia', 'error')
    }
    setSaving(null)
  }, [records, date, subject, teacher])

  const absentCount = Object.values(records).filter(s => s === 'absent').length
  const lateCount = Object.values(records).filter(s => s === 'late').length

  const STATUS_STYLES = {
    present: { bg: '#DCFCE7', color: '#15803D', icon: '✓', label: 'Presente' },
    absent:  { bg: '#FEE2E2', color: '#DC2626', icon: '✗', label: 'Ausente' },
    late:    { bg: '#FEF3C7', color: '#D97706', icon: '⏱', label: 'Tardanza' },
    excused: { bg: '#DBEAFE', color: '#1D4ED8', icon: '📋', label: 'Excusado' },
  }

  return (
    <div className="sp-attendance">
      {/* Header */}
      <div className="sp-att-header">
        <h3 className="sp-att-title">Asistencia</h3>
        <div className="sp-att-controls">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="sp-att-date"
          />
          <select value={subject} onChange={e => setSubject(e.target.value)} className="sp-att-subject">
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Summary badges */}
      <div className="sp-att-summary">
        <span className="sp-att-badge sp-att-badge--total">{students.length} estudiantes</span>
        {absentCount > 0 && (
          <span className="sp-att-badge sp-att-badge--absent">{absentCount} ausentes</span>
        )}
        {lateCount > 0 && (
          <span className="sp-att-badge sp-att-badge--late">{lateCount} tardanzas</span>
        )}
      </div>

      {/* Student list */}
      {loading ? (
        <div className="sp-att-loading">Cargando...</div>
      ) : (
        <div className="sp-att-list">
          {students.map(student => {
            const status = records[student.id] || 'present'
            const st = STATUS_STYLES[status]
            const isSaving = saving === student.id
            return (
              <button
                key={student.id}
                className={`sp-att-row ${isSaving ? 'sp-att-row--saving' : ''}`}
                onClick={() => toggleStatus(student.id)}
                type="button"
              >
                <span className="sp-att-row-name">{displayName(student)}</span>
                <span
                  className="sp-att-row-badge"
                  style={{ background: st.bg, color: st.color }}
                >
                  {st.icon} {st.label}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <div className="sp-att-legend">
        <span>Tap para cambiar: Presente → Ausente → Tardanza → Excusado</span>
      </div>
    </div>
  )
}
