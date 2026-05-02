// ── StudentPlayerPage.jsx ─────────────────────────────────────────────────────
// FIFA-style student dashboard. Platinum theme, glass cards, expand-to-center.
// Route: /player

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { displayName } from '../utils/studentUtils'
import PlayerCard, { getTier } from '../components/player/PlayerCard'
import RadarChart from '../components/player/RadarChart'
import AttendancePanel from '../components/player/AttendancePanel'

export default function StudentPlayerPage({ teacher }) {
  const { showToast } = useToast()

  // ── State ────────────────────────────────────────────────────────────────────
  const [assignments, setAssignments] = useState([])
  const [selectedGrade, setSelectedGrade] = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [students, setStudents] = useState([])
  const [playerStats, setPlayerStats] = useState({})
  const [profiles, setProfiles] = useState({})
  const [grades, setGrades] = useState([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState('cards')
  const [expandedStudent, setExpandedStudent] = useState(null)
  const [expandAnim, setExpandAnim] = useState(false) // controls CSS class for animation

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

  // ── Load students + stats ─────────────────────────────────────────────────────
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
      const statsMap = {}
      for (const s of (statsRes.data || [])) statsMap[s.student_id] = s
      setPlayerStats(statsMap)
      const profMap = {}
      for (const p of (profilesRes.data || [])) profMap[p.student_id] = p
      setProfiles(profMap)
      setGrades(gradesRes.data || [])
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

  // ── Expand card ────────────────────────────────────────────────────────────────
  const handleExpand = useCallback((student) => {
    setExpandedStudent(student)
    // Trigger animation on next frame
    requestAnimationFrame(() => setExpandAnim(true))
  }, [])

  const handleCollapse = useCallback(() => {
    setExpandAnim(false)
    setTimeout(() => setExpandedStudent(null), 350) // match CSS transition
  }, [])

  // Navigate between students in expanded view
  const handleNav = useCallback((dir) => {
    if (!expandedStudent) return
    const idx = students.findIndex(s => s.id === expandedStudent.id)
    const next = idx + dir
    if (next >= 0 && next < students.length) {
      setExpandAnim(false)
      setTimeout(() => {
        setExpandedStudent(students[next])
        requestAnimationFrame(() => setExpandAnim(true))
      }, 150)
    }
  }, [expandedStudent, students])

  // ── Expanded full view ─────────────────────────────────────────────────────────
  const renderExpandedView = () => {
    if (!expandedStudent) return null
    const s = expandedStudent
    const overall = getStudentOverall(s.id)
    const stats = getStudentStats(s.id)
    const tier = getTier(overall)
    const photo = profiles[s.id]?.photo_url
    const profile = profiles[s.id]
    const name = `${s.first_lastname || ''} ${s.second_lastname || ''} ${s.first_name || ''} ${s.second_name || ''}`.replace(/\s+/g, ' ').trim()
    const idx = students.findIndex(st => st.id === s.id)

    return createPortal(
      <div className={`sp-expand-overlay ${expandAnim ? 'sp-expand-overlay--active' : ''}`} onClick={handleCollapse}>
        <div className={`sp-expand-card sp-expand-card--${tier} ${expandAnim ? 'sp-expand-card--active' : ''}`} onClick={e => e.stopPropagation()}>
          {/* Close */}
          <button className="sp-expand-close" onClick={handleCollapse} type="button">&times;</button>

          {/* Nav arrows */}
          {idx > 0 && (
            <button className="sp-expand-nav sp-expand-nav--prev" onClick={() => handleNav(-1)} type="button">&lsaquo;</button>
          )}
          {idx < students.length - 1 && (
            <button className="sp-expand-nav sp-expand-nav--next" onClick={() => handleNav(1)} type="button">&rsaquo;</button>
          )}

          {/* Content */}
          <div className="sp-expand-inner">
            {/* Left: Avatar + Rating */}
            <div className="sp-expand-left">
              <div className="sp-expand-rating">{overall}</div>
              <div className="sp-expand-avatar">
                {photo ? (
                  <img src={photo} alt={name} className="sp-expand-photo" />
                ) : (
                  <div className="sp-expand-initials">
                    {(s.first_name?.[0] || '') + (s.first_lastname?.[0] || '')}
                  </div>
                )}
              </div>
              <div className="sp-expand-name">{name}</div>
              <div className="sp-expand-meta">{s.grade} {s.section} · {s.student_code}</div>
              {profile?.status && profile.status !== 'no_intervention' && (
                <div className={`sp-expand-status sp-expand-status--${profile.status}`}>
                  {profile.status === 'monitoring' ? 'Monitoreo' : 'Intervención'}
                </div>
              )}
            </div>

            {/* Right: Radar + Stats */}
            <div className="sp-expand-right">
              <div className="sp-expand-radar">
                <RadarChart stats={stats} tier={tier} size={200} />
              </div>
              <div className="sp-expand-stats-grid">
                <StatBlock label="Académico" abbr="ACA" value={stats.aca} />
                <StatBlock label="Participación" abbr="PAR" value={stats.par} />
                <StatBlock label="Creatividad" abbr="CRE" value={stats.cre} />
                <StatBlock label="Liderazgo" abbr="LID" value={stats.lid} />
                <StatBlock label="Disciplina" abbr="DIS" value={stats.dis} />
                <StatBlock label="Colaboración" abbr="COL" value={stats.col} />
              </div>
            </div>
          </div>

          {/* Bottom: Additional info panels */}
          <div className="sp-expand-panels">
            {profile?.flags?.length > 0 && (
              <div className="sp-expand-panel">
                <h4>Rasgos</h4>
                <div className="sp-expand-tags">
                  {profile.flags.map(f => <span key={f} className="sp-expand-tag">{f}</span>)}
                </div>
              </div>
            )}
            <div className="sp-expand-panel">
              <h4>Tier</h4>
              <span className={`sp-expand-tier-badge sp-expand-tier-badge--${tier}`}>
                {tier === 'gold' ? 'Champion' : tier === 'silver' ? 'Elite' : tier === 'bronze' ? 'Rising' : 'Rookie'}
              </span>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="sp-page">
      {/* Header */}
      <div className="sp-header">
        <div className="sp-header-content">
          <h1 className="sp-header-title">Player Cards</h1>
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
              onClick={() => handleExpand(student)}
            />
          ))}
          {!students.length && (
            <div className="sp-empty">
              <div className="sp-empty-icon">🃏</div>
              <h3>No hay jugadores</h3>
              <p>Agrega estudiantes en "Mis Estudiantes" para ver sus Player Cards.</p>
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

      {/* Expanded view portal */}
      {renderExpandedView()}
    </div>
  )
}

function StatBlock({ label, abbr, value = 0 }) {
  const pct = Math.min(value, 99)
  return (
    <div className="sp-expand-stat">
      <div className="sp-expand-stat-header">
        <span className="sp-expand-stat-label">{label}</span>
        <span className="sp-expand-stat-value">{value}</span>
      </div>
      <div className="sp-expand-stat-bar">
        <div className="sp-expand-stat-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
