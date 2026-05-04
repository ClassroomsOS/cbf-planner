// ── StudentPlayerPage.jsx ─────────────────────────────────────────────────────
// FIFA-style student dashboard. Platinum theme, glass cards.
// Route: /player — click card navigates to /player/:studentId detail page.

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { displayName } from '../utils/studentUtils'
import PlayerCard, { getTier } from '../components/player/PlayerCard'
import AttendancePanel from '../components/player/AttendancePanel'

export default function StudentPlayerPage({ teacher }) {
  const { showToast } = useToast()
  const navigate = useNavigate()

  // ── State ────────────────────────────────────────────────────────────────────
  const [assignments, setAssignments] = useState([])
  const [selectedGrade, setSelectedGrade] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [students, setStudents] = useState([])
  const [playerStats, setPlayerStats] = useState({})
  const [profiles, setProfiles] = useState({})
  const [grades, setGrades] = useState([])
  const [badgeMap, setBadgeMap] = useState({})
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState('cards') // 'cards' | 'list' | 'attendance'

  // ── Load assignments ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!teacher?.id) return
    supabase.from('teacher_assignments')
      .select('grade, section, subject')
      .eq('teacher_id', teacher.id)
      .then(({ data }) => {
        setAssignments(data || [])
        if (data?.length) {
          setSelectedGrade(data[0].grade)
          setSelectedSection(data[0].section)
        }
      })
  }, [teacher?.id])

  const uniqueGrades = useMemo(() =>
    [...new Set(assignments.map(a => a.grade))].sort(),
    [assignments]
  )
  const sectionsForGrade = useMemo(() =>
    [...new Set(assignments.filter(a => a.grade === selectedGrade).map(a => a.section))].sort(),
    [assignments, selectedGrade]
  )

  useEffect(() => {
    if (sectionsForGrade.length && !sectionsForGrade.includes(selectedSection))
      setSelectedSection(sectionsForGrade[0])
  }, [sectionsForGrade])

  // ── Load students + stats + badge data ────────────────────────────────────────
  useEffect(() => {
    if (!selectedGrade || !selectedSection || !teacher?.school_id) return
    setLoading(true)

    Promise.all([
      supabase.from('school_students')
        .select('id, first_name, second_name, first_lastname, second_lastname, student_code, email')
        .eq('school_id', teacher.school_id)
        .eq('grade', selectedGrade)
        .eq('section', selectedSection)
        .order('first_lastname'),
      supabase.from('student_player_stats')
        .select('*')
        .eq('school_id', teacher.school_id),
      supabase.from('student_psychosocial_profiles')
        .select('student_id, status, support_level, flags, photo_url')
        .eq('school_id', teacher.school_id),
      supabase.from('student_activity_grades')
        .select('student_id, colombian_grade, news_project_id, activity_id, micro_activity_id, graded_at')
        .eq('school_id', teacher.school_id),
      // Badge data: NEWS projects with activities
      supabase.from('news_projects')
        .select('id, grade, section, actividades_evaluativas, status')
        .eq('school_id', teacher.school_id)
        .eq('grade', selectedGrade)
        .eq('section', selectedSection)
        .in('status', ['draft', 'in_progress', 'active']),
      // Badge data: exam instances for students in this grade/section
      supabase.from('exam_instances')
        .select('student_id, instance_status, submitted_at, exam_sessions(ended_at)')
        .eq('school_id', teacher.school_id),
      // Badge data: micro activities
      supabase.from('micro_activities')
        .select('id, status')
        .eq('school_id', teacher.school_id)
        .eq('grade', selectedGrade)
        .eq('section', selectedSection),
    ]).then(([studentsRes, statsRes, profilesRes, gradesRes, newsRes, examRes, microRes]) => {
      const studentList = studentsRes.data || []
      setStudents(studentList)

      const statsMap = {}
      for (const s of (statsRes.data || [])) statsMap[s.student_id] = s
      setPlayerStats(statsMap)

      const profMap = {}
      for (const p of (profilesRes.data || [])) profMap[p.student_id] = p
      setProfiles(profMap)

      const allGrades = gradesRes.data || []
      setGrades(allGrades)

      // ── Compute badges ──────────────────────────────────────────────────────
      const studentIds = new Set(studentList.map(s => s.id))
      const badges = {}
      for (const sid of studentIds) badges[sid] = { pending: 0, completed: 0, late: 0 }

      // Grade lookup
      const gradeKeys = new Set()
      for (const g of allGrades) {
        if (g.news_project_id && g.activity_id) gradeKeys.add(`${g.student_id}|${g.news_project_id}|${g.activity_id}`)
        if (g.micro_activity_id) gradeKeys.add(`${g.student_id}|micro|${g.micro_activity_id}`)
      }

      // NEWS activities
      const newsProjects = newsRes.data || []
      for (const proj of newsProjects) {
        const acts = proj.actividades_evaluativas || []
        for (const act of acts) {
          if (!act.nombre) continue
          for (const sid of studentIds) {
            const key = `${sid}|${proj.id}|${act.id}`
            if (gradeKeys.has(key)) {
              badges[sid].completed++
            } else {
              badges[sid].pending++
            }
          }
        }
      }

      // Exam instances
      const examInstances = examRes.data || []
      for (const inst of examInstances) {
        if (!studentIds.has(inst.student_id)) continue
        if (inst.instance_status === 'submitted') {
          const ended = inst.exam_sessions?.ended_at
          if (ended && inst.submitted_at && inst.submitted_at > ended) {
            badges[inst.student_id].late++
          } else {
            badges[inst.student_id].completed++
          }
        } else if (['ready', 'started'].includes(inst.instance_status)) {
          badges[inst.student_id].pending++
        }
      }

      // Micro activities
      const microActs = microRes.data || []
      for (const micro of microActs) {
        for (const sid of studentIds) {
          const key = `${sid}|micro|${micro.id}`
          if (gradeKeys.has(key)) {
            badges[sid].completed++
          } else {
            badges[sid].pending++
          }
        }
      }

      setBadgeMap(badges)
      setLoading(false)
    })
  }, [selectedGrade, selectedSection, teacher?.school_id, teacher?.id])

  // ── Compute stats ─────────────────────────────────────────────────────────────
  const getStudentOverall = (studentId) => {
    const cached = playerStats[studentId]
    if (cached?.overall_rating) return cached.overall_rating
    const studentGrades = grades.filter(g => g.student_id === studentId)
    if (!studentGrades.length) return 0
    const avg = studentGrades.reduce((s, g) => s + Number(g.colombian_grade || 0), 0) / studentGrades.length
    return Math.round(((avg - 1.0) / 4.0) * 99)
  }

  const getStudentStats = (studentId) => {
    const cached = playerStats[studentId]
    if (cached?.stats && Object.keys(cached.stats).length) return cached.stats
    const overall = getStudentOverall(studentId)
    return { aca: overall, par: 50, cre: 50, lid: 50, dis: 50, col: 50 }
  }

  const goToStudent = (student) => navigate(`/player/${student.id}`)

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="sp-page">
      {/* Header */}
      <div className="sp-header">
        <div className="sp-header-content">
          <h1 className="sp-header-title">Mis Estudiantes BF</h1>
          <p className="sp-header-subtitle">Equipo de campeones — Perfil integral</p>
        </div>
        <div className="sp-header-actions">
          <button
            className={`sp-view-btn ${view === 'cards' ? 'sp-view-btn--active' : ''}`}
            onClick={() => setView('cards')}
          >
            🃏 Cards
          </button>
          <button
            className={`sp-view-btn ${view === 'list' ? 'sp-view-btn--active' : ''}`}
            onClick={() => setView('list')}
          >
            📋 Lista
          </button>
          <button
            className={`sp-view-btn ${view === 'attendance' ? 'sp-view-btn--active' : ''}`}
            onClick={() => setView('attendance')}
          >
            ✅ Asistencia
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="sp-filters">
        <select value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)} className="sp-filter-select">
          {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)} className="sp-filter-select">
          {sectionsForGrade.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="sp-filter-count">{students.length} estudiantes</span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="sp-loading">
          <div className="sp-loading-card" />
          <div className="sp-loading-card" />
          <div className="sp-loading-card" />
        </div>
      ) : !students.length ? (
        <div className="sp-empty">
          <div className="sp-empty-icon">👩‍🎓</div>
          <h3>No hay estudiantes</h3>
          <p>Pide al coordinador que agregue estudiantes en "Estudiantes BF" para este grado y sección.</p>
        </div>
      ) : view === 'cards' ? (
        <div className="sp-grid">
          {students.map(student => (
            <PlayerCard
              key={student.id}
              student={student}
              stats={getStudentStats(student.id)}
              photoUrl={profiles[student.id]?.photo_url}
              overall={getStudentOverall(student.id)}
              badges={badgeMap[student.id]}
              onClick={() => goToStudent(student)}
            />
          ))}
        </div>
      ) : view === 'list' ? (
        <div className="sp-list">
          <table className="sp-list-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Estudiante</th>
                <th>Código</th>
                <th>Rating</th>
                <th>Tier</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, i) => {
                const overall = getStudentOverall(student.id)
                const tier = getTier(overall)
                const photo = profiles[student.id]?.photo_url
                const b = badgeMap[student.id]
                return (
                  <tr key={student.id} className="sp-list-row" onClick={() => goToStudent(student)}>
                    <td className="sp-list-num">{i + 1}</td>
                    <td className="sp-list-name">
                      <div className="sp-list-avatar">
                        {photo
                          ? <img src={photo} alt="" className="sp-list-photo" />
                          : <span className="sp-list-initials">{(student.first_name?.[0] || '') + (student.first_lastname?.[0] || '')}</span>
                        }
                      </div>
                      <span>{displayName(student)}</span>
                      {b?.pending > 0 && <span className="sp-list-badge sp-list-badge--pending">{b.pending}</span>}
                      {b?.late > 0 && <span className="sp-list-badge sp-list-badge--late">{b.late}</span>}
                    </td>
                    <td className="sp-list-code">{student.student_code || '—'}</td>
                    <td className="sp-list-rating">
                      <span className={`sp-list-rating-badge sp-list-rating-badge--${tier}`}>{overall}</span>
                    </td>
                    <td className="sp-list-tier">
                      <span className={`sp-list-tier-badge sp-list-tier-badge--${tier}`}>
                        {tier === 'gold' ? 'Champion' : tier === 'silver' ? 'Elite' : tier === 'bronze' ? 'Rising' : 'Rookie'}
                      </span>
                    </td>
                    <td className="sp-list-action">
                      <button type="button" className="sp-list-expand-btn" onClick={e => { e.stopPropagation(); goToStudent(student) }}>Ver</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <AttendancePanel
          teacher={teacher}
          students={students}
          grade={selectedGrade}
          section={selectedSection}
          assignments={assignments}
        />
      )}
    </div>
  )
}
