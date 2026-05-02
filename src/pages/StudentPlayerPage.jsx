// ── StudentPlayerPage.jsx ─────────────────────────────────────────────────────
// FIFA-style student dashboard. Grid of player cards + attendance panel.
// Route: /player

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { displayName } from '../utils/studentUtils'
import PlayerCard from '../components/player/PlayerCard'
import AttendancePanel from '../components/player/AttendancePanel'

export default function StudentPlayerPage({ teacher }) {
  const { showToast } = useToast()

  // ── State ────────────────────────────────────────────────────────────────────
  const [assignments, setAssignments] = useState([])
  const [selectedGrade, setSelectedGrade] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [students, setStudents] = useState([])
  const [playerStats, setPlayerStats] = useState({}) // { studentId: stats }
  const [profiles, setProfiles] = useState({}) // { studentId: psychosocial profile }
  const [grades, setGrades] = useState([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState('cards') // 'cards' | 'attendance'
  const [selectedStudent, setSelectedStudent] = useState(null)

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

  // ── Load students + stats when selection changes ──────────────────────────────
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
        .select('student_id, colombian_grade')
        .eq('teacher_id', teacher.id)
        .eq('school_id', teacher.school_id),
    ]).then(([studentsRes, statsRes, profilesRes, gradesRes]) => {
      setStudents(studentsRes.data || [])

      // Index player stats by student_id
      const statsMap = {}
      for (const s of (statsRes.data || [])) statsMap[s.student_id] = s
      setPlayerStats(statsMap)

      // Index profiles by student_id
      const profMap = {}
      for (const p of (profilesRes.data || [])) profMap[p.student_id] = p
      setProfiles(profMap)

      setGrades(gradesRes.data || [])
      setLoading(false)
    })
  }, [selectedGrade, selectedSection, teacher?.school_id, teacher?.id])

  // ── Compute stats from grades if no cached stats ─────────────────────────────
  const getStudentOverall = (studentId) => {
    const cached = playerStats[studentId]
    if (cached?.overall_rating) return cached.overall_rating
    // Compute from grades
    const studentGrades = grades.filter(g => g.student_id === studentId)
    if (!studentGrades.length) return 0
    const avg = studentGrades.reduce((s, g) => s + Number(g.colombian_grade || 0), 0) / studentGrades.length
    return Math.round(((avg - 1.0) / 4.0) * 99)
  }

  const getStudentStats = (studentId) => {
    const cached = playerStats[studentId]
    if (cached?.stats && Object.keys(cached.stats).length) return cached.stats
    // Default stats from academic average
    const overall = getStudentOverall(studentId)
    return { aca: overall, par: 50, cre: 50, lid: 50, dis: 50, col: 50 }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="sp-page">
      {/* Header */}
      <div className="sp-header">
        <div className="sp-header-content">
          <h1 className="sp-header-title">Player Cards</h1>
          <p className="sp-header-subtitle">Perfil integral de cada estudiante</p>
        </div>
        <div className="sp-header-actions">
          <button
            className={`sp-view-btn ${view === 'cards' ? 'sp-view-btn--active' : ''}`}
            onClick={() => setView('cards')}
          >
            🃏 Cards
          </button>
          <button
            className={`sp-view-btn ${view === 'attendance' ? 'sp-view-btn--active' : ''}`}
            onClick={() => setView('attendance')}
          >
            📋 Asistencia
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
        <span className="sp-filter-count">{students.length} jugadores</span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="sp-loading">
          <div className="sp-loading-card" />
          <div className="sp-loading-card" />
          <div className="sp-loading-card" />
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
              onClick={() => setSelectedStudent(student)}
            />
          ))}
          {!students.length && (
            <div className="sp-empty">
              <div className="sp-empty-icon">🃏</div>
              <h3>No hay jugadores</h3>
              <p>Agrega estudiantes en la sección "Mis Estudiantes" para ver sus Player Cards.</p>
            </div>
          )}
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
