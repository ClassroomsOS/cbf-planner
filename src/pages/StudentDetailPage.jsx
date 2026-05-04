// ── StudentDetailPage.jsx ─────────────────────────────────────────────────────
// /player/:studentId — Individual student profile with unified activity panel.
// Shows stats, tasks (NEWS + exams + micro), attendance, grade history.

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { displayName } from '../utils/studentUtils'
import RadarChart from '../components/player/RadarChart'
import { getTier } from '../components/player/PlayerCard'
import useStudentTasks, { SOURCE_LABELS } from '../hooks/useStudentTasks'
import MicroActivityModal from '../components/MicroActivityModal'

const STATUS_META = {
  pending:    { label: 'Pendiente',   icon: '🟡', cls: 'pending' },
  inProgress: { label: 'En progreso', icon: '🔵', cls: 'progress' },
  completed:  { label: 'Completada',  icon: '🟢', cls: 'done' },
  late:       { label: 'Tarde',       icon: '🔴', cls: 'late' },
}

const CATEGORY_LABELS = {
  cognitiva: '📝 Cognitiva', digital: '💻 Digital',
  axiologica: '✝️ Axiológica', general: '📋 General',
}

const SOURCE_ICONS = { news: '📰', exam: '📄', micro: '⚡' }

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

export default function StudentDetailPage({ teacher }) {
  const { studentId } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  // ── State ────────────────────────────────────────────────────────────────────
  const [student, setStudent] = useState(null)
  const [stats, setStats] = useState(null)
  const [profile, setProfile] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [gradeHistory, setGradeHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all') // all | news | exam | micro
  const [showMicroModal, setShowMicroModal] = useState(false)
  const [assignments, setAssignments] = useState([])

  // ── Load core data ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!studentId || !teacher?.id) return
    setLoading(true)

    const [studentRes, statsRes, profileRes, attendanceRes, gradesRes, assignRes] = await Promise.all([
      supabase.from('school_students')
        .select('*').eq('id', studentId).single(),
      supabase.from('student_player_stats')
        .select('*').eq('student_id', studentId).maybeSingle(),
      supabase.from('student_psychosocial_profiles')
        .select('*').eq('student_id', studentId).maybeSingle(),
      supabase.from('student_attendance')
        .select('id, attendance_date, status, subject')
        .eq('student_id', studentId)
        .order('attendance_date', { ascending: false })
        .limit(100),
      supabase.from('student_activity_grades')
        .select('id, news_project_id, activity_id, micro_activity_id, colombian_grade, graded_at, score, max_score')
        .eq('student_id', studentId)
        .order('graded_at', { ascending: false }),
      supabase.from('teacher_assignments')
        .select('grade, section, subject')
        .eq('teacher_id', teacher.id),
    ])

    if (studentRes.error) {
      showToast('No se pudo cargar el estudiante', 'error')
      navigate('/player')
      return
    }

    setStudent(studentRes.data)
    setStats(statsRes.data)
    setProfile(profileRes.data)
    setAttendance(attendanceRes.data || [])
    setGradeHistory(gradesRes.data || [])
    setAssignments(assignRes.data || [])
    setLoading(false)
  }, [studentId, teacher?.id])

  useEffect(() => { load() }, [load])

  // ── Tasks hook ────────────────────────────────────────────────────────────────
  const { tasks, counts, loading: tasksLoading, refresh: refreshTasks } = useStudentTasks({
    teacher,
    studentId,
    grade: student?.grade,
    section: student?.section,
  })

  // ── Derived ───────────────────────────────────────────────────────────────────
  const overall = stats?.overall_rating || 0
  const tier = getTier(overall)
  const statValues = stats?.stats || { aca: overall, par: 50, cre: 50, lid: 50, dis: 50, col: 50 }

  const filteredTasks = activeTab === 'all'
    ? tasks
    : tasks.filter(t => t.source === activeTab)

  // Attendance summary
  const attSummary = { present: 0, absent: 0, late: 0, excused: 0 }
  for (const a of attendance) attSummary[a.status] = (attSummary[a.status] || 0) + 1
  const attTotal = attendance.length

  // Subject for micro modal
  const subjectForSection = assignments.find(a =>
    a.grade === student?.grade && a.section === student?.section
  )?.subject || ''

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (loading || !student) {
    return (
      <div className="sd-page">
        <div className="sd-loading">
          <div className="sd-loading-pulse" />
          <p>Cargando perfil del estudiante...</p>
        </div>
      </div>
    )
  }

  const name = displayName(student)
  const photo = profile?.photo_url

  return (
    <div className="sd-page">
      {/* ── Hero Header ──────────────────────────────────────────────────────── */}
      <div className={`sd-hero sd-hero--${tier}`}>
        <button className="sd-back" onClick={() => navigate('/player')} type="button">
          ← Volver
        </button>

        <div className="sd-hero-content">
          <div className="sd-hero-left">
            <div className="sd-hero-rating">{overall}</div>
            <div className="sd-hero-avatar">
              {photo
                ? <img src={photo} alt={name} className="sd-hero-photo" />
                : <div className="sd-hero-initials">{(student.first_name?.[0] || '') + (student.first_lastname?.[0] || '')}</div>
              }
            </div>
            <h1 className="sd-hero-name">{name}</h1>
            <p className="sd-hero-meta">{student.grade} {student.section} · {student.student_code}</p>
            {profile?.status && profile.status !== 'no_intervention' && (
              <span className={`sd-hero-status sd-hero-status--${profile.status}`}>
                {profile.status === 'monitoring' ? '👁 Monitoreo' : '🚨 Intervención'}
              </span>
            )}
            {profile?.flags?.length > 0 && (
              <div className="sd-hero-flags">
                {profile.flags.map(f => <span key={f} className="sd-hero-flag">{f}</span>)}
              </div>
            )}
          </div>

          <div className="sd-hero-right">
            <RadarChart stats={statValues} tier={tier} size={200} />
            <div className="sd-hero-tier">
              <span className={`sd-tier-badge sd-tier-badge--${tier}`}>
                {tier === 'gold' ? 'Champion' : tier === 'silver' ? 'Elite' : tier === 'bronze' ? 'Rising' : 'Rookie'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats Bar ────────────────────────────────────────────────────────── */}
      <div className="sd-section sd-stats-section">
        <div className="sd-stats-grid">
          <StatBar label="Académico" abbr="ACA" value={statValues.aca} />
          <StatBar label="Participación" abbr="PAR" value={statValues.par} />
          <StatBar label="Creatividad" abbr="CRE" value={statValues.cre} />
          <StatBar label="Liderazgo" abbr="LID" value={statValues.lid} />
          <StatBar label="Disciplina" abbr="DIS" value={statValues.dis} />
          <StatBar label="Colaboración" abbr="COL" value={statValues.col} />
        </div>
      </div>

      {/* ���─ Activity Panel ───────────────────────────────────────────────────── */}
      <div className="sd-section">
        <div className="sd-section-header">
          <h2>Actividades</h2>
          <div className="sd-counts">
            <span className="sd-count sd-count--pending">{counts.pending} pendientes</span>
            <span className="sd-count sd-count--progress">{counts.inProgress} en curso</span>
            <span className="sd-count sd-count--done">{counts.completed} completadas</span>
            {counts.late > 0 && <span className="sd-count sd-count--late">{counts.late} tarde</span>}
          </div>
        </div>

        <div className="sd-tabs">
          {[
            { key: 'all', label: 'Todas' },
            { key: 'news', label: '📰 NEWS' },
            { key: 'exam', label: '📄 Exámenes' },
            { key: 'micro', label: '⚡ Micro' },
          ].map(t => (
            <button
              key={t.key}
              className={`sd-tab ${activeTab === t.key ? 'sd-tab--active' : ''}`}
              onClick={() => setActiveTab(t.key)}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </div>

        {tasksLoading ? (
          <div className="sd-tasks-loading">Cargando actividades...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="sd-tasks-empty">
            <p>No hay actividades {activeTab !== 'all' ? `de tipo ${SOURCE_LABELS[activeTab]}` : ''} asignadas.</p>
          </div>
        ) : (
          <div className="sd-tasks-list">
            <table className="sd-tasks-table">
              <thead>
                <tr>
                  <th>Actividad</th>
                  <th>Fuente</th>
                  <th>Categoría</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(task => {
                  const sm = STATUS_META[task.status]
                  return (
                    <tr key={task.id} className="sd-task-row" onClick={() => handleTaskClick(task)}>
                      <td className="sd-task-name">
                        <span className="sd-task-icon">{SOURCE_ICONS[task.source]}</span>
                        <div>
                          <span className="sd-task-title">{task.name}</span>
                          {task.sourceTitle && task.source === 'news' && (
                            <span className="sd-task-project">{task.sourceTitle}</span>
                          )}
                        </div>
                      </td>
                      <td><span className="sd-task-source">{SOURCE_LABELS[task.source]}</span></td>
                      <td><span className="sd-task-cat">{CATEGORY_LABELS[task.category] || task.category}</span></td>
                      <td className="sd-task-date">{fmtDate(task.dueDate)}</td>
                      <td>
                        <span className={`sd-task-status sd-task-status--${sm.cls}`}>
                          {sm.icon} {sm.label}
                        </span>
                      </td>
                      <td className="sd-task-grade">
                        {task.colombianGrade ? task.colombianGrade.toFixed(1) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* FAB: crear micro-actividad */}
        <button
          className="sd-fab"
          onClick={() => setShowMicroModal(true)}
          type="button"
          title="Crear actividad en clase"
        >
          ＋ Actividad en clase
        </button>
      </div>

      {/* ── Attendance Summary ───────────────────────────────────────────────── */}
      <div className="sd-section">
        <h2 className="sd-section-title">Asistencia</h2>
        <div className="sd-att-grid">
          <div className="sd-att-card">
            <span className="sd-att-num">{attTotal}</span>
            <span className="sd-att-label">Total</span>
          </div>
          <div className="sd-att-card sd-att-card--present">
            <span className="sd-att-num">{attSummary.present}</span>
            <span className="sd-att-label">Presentes</span>
          </div>
          <div className="sd-att-card sd-att-card--absent">
            <span className="sd-att-num">{attSummary.absent}</span>
            <span className="sd-att-label">Ausencias</span>
          </div>
          <div className="sd-att-card sd-att-card--late">
            <span className="sd-att-num">{attSummary.late}</span>
            <span className="sd-att-label">Tardanzas</span>
          </div>
          <div className="sd-att-card sd-att-card--excused">
            <span className="sd-att-num">{attSummary.excused}</span>
            <span className="sd-att-label">Excusas</span>
          </div>
        </div>
      </div>

      {/* ── Grade History ────────────────────────────────────────────────────── */}
      {gradeHistory.length > 0 && (
        <div className="sd-section">
          <h2 className="sd-section-title">Historial de Notas</h2>
          <table className="sd-grades-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Nota</th>
                <th>Puntaje</th>
              </tr>
            </thead>
            <tbody>
              {gradeHistory.slice(0, 20).map(g => (
                <tr key={g.id}>
                  <td>{g.graded_at ? fmtDate(g.graded_at.slice(0, 10)) : '—'}</td>
                  <td className="sd-grade-val">{Number(g.colombian_grade).toFixed(1)}</td>
                  <td className="sd-grade-score">{Number(g.score).toFixed(1)}/{Number(g.max_score).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Micro Activity Modal ─────────────────────────────────────────────── */}
      {showMicroModal && (
        <MicroActivityModal
          teacher={teacher}
          grade={student.grade}
          section={student.section}
          subject={subjectForSection}
          period={teacher.default_period || 1}
          students={[student]}
          onCreated={() => {
            setShowMicroModal(false)
            refreshTasks()
            showToast('Actividad creada', 'success')
          }}
          onClose={() => setShowMicroModal(false)}
        />
      )}
    </div>
  )

  function handleTaskClick(task) {
    if (task.source === 'exam') {
      navigate(`/exams/${task.sourceId}`)
    } else if (task.source === 'micro') {
      navigate(`/grades/quick/${task.sourceId}`)
    } else if (task.source === 'news') {
      navigate('/grades')
    }
  }
}

function StatBar({ label, abbr, value = 0 }) {
  const pct = Math.min(value, 99)
  return (
    <div className="sd-stat-bar">
      <div className="sd-stat-bar-header">
        <span className="sd-stat-bar-label">{label}</span>
        <span className="sd-stat-bar-value">{value}</span>
      </div>
      <div className="sd-stat-bar-track">
        <div className="sd-stat-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
