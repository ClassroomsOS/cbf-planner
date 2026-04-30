import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import PlannerPage         from './PlannerPage'
import MyPlansPage         from './MyPlansPage'
import CalendarPage        from './CalendarPage'
import NotificationsPage   from './NotificationsPage'
import AdminTeachersPage   from './AdminTeachersPage'
import AIUsagePage         from './AIUsagePage'
import GuideEditorPage     from './GuideEditorPage'
import MessagesPage        from './MessagesPage'
import SettingsPage        from './SettingsPage'
import SuperAdminPage      from './SuperAdminPage'
import ObjectivesPage           from './ObjectivesPage'
import SyllabusPage             from './SyllabusPage'
import NewsPage                 from './NewsPage'
import NewsTimelinePage         from './NewsTimelinePage'
import ReviewRoomPage           from './ReviewRoomPage'
import ExamDashboardPage        from './ExamDashboardPage'
import ExamCreatorPage          from './ExamCreatorPage'
import ExamReviewPage           from './ExamReviewPage'
import StudentsPage             from './StudentsPage'
import PsicosocialPage          from './PsicosocialPage'
import SubjectManagerPage       from './SubjectManagerPage'
import GuideLibraryPage         from './GuideLibraryPage'
import PeriodCoverageDashboard  from './PeriodCoverageDashboard'
import ObservationLoggerPage    from './ObservationLoggerPage'
import PrinciplesPage      from './PrinciplesPage'
import DirectorPage        from './DirectorPage'
import SchedulePage        from './SchedulePage'
import AgendaPage          from './AgendaPage'
import CurriculumPage      from './CurriculumPage'
import ProfileModal        from '../components/ProfileModal'
import { FeaturesProvider, useFeatures } from '../context/FeaturesContext'
import { canManage, canAccessCalendar, isRector, canReadAllPlans, canViewSchedule, canManageAgendas, isCoteacherActive, isSuperAdmin, roleLabel, ROLE_STYLES } from '../utils/roles'
import { setAIContext } from '../utils/AIAssistant'

// ── Wrapper — provides context ────────────────────────────────
export default function DashboardPage({ session, teacher, setTeacher }) {
  return (
    <FeaturesProvider schoolId={teacher.school_id}>
      <DashboardInner session={session} teacher={teacher} setTeacher={setTeacher} />
    </FeaturesProvider>
  )
}

// ── Inner — consumes context ──────────────────────────────────
function DashboardInner({ session, teacher, setTeacher }) {
  const [showProfile, setShowProfile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const isAdmin      = canManage(teacher.role)        // admin + superadmin + rector
  const isSuperAdm   = isSuperAdmin(teacher.role)
  const hasCalendar = canAccessCalendar(teacher.role) // admin + superadmin + psicopedagoga
  const hasDirectorView = isRector(teacher.role)
  const hasScheduleView = canViewSchedule(teacher.role)   // admin + superadmin + rector + psicopedagoga
  const hasAgendas      = canManageAgendas(teacher.role) || !!teacher.homeroom_grade || !!teacher.coteacher_grade
  const isHomeroomOnly  = !!teacher.homeroom_grade && !canManageAgendas(teacher.role) && !teacher.coteacher_grade
  const isCoteacherOnly = !!teacher.coteacher_grade && !canManageAgendas(teacher.role) && !teacher.homeroom_grade
  const coteacherActive = isCoteacherActive(teacher)
  const { features } = useFeatures()

  // Set AI context once so callClaude() can log usage and enforce limits
  useEffect(() => {
    setAIContext({
      schoolId:     teacher.school_id,
      teacherId:    teacher.id,
      monthlyLimit: teacher.ai_monthly_limit || 0,
    })
  }, [teacher.id])

  const [unread,           setUnread]           = useState(0)
  const [unreadMessages,   setUnreadMessages]   = useState(0)
  const [pendingReview,    setPendingReview]    = useState(0)
  const [pendingAIReview,  setPendingAIReview]  = useState(0)

  // Fetch unread counts
  async function fetchUnread() {
    try {
      let query = supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('read', false)
        .eq('school_id', teacher.school_id)
      query = isAdmin ? query.eq('to_role', 'admin') : query.eq('to_id', teacher.id)
      // directors receive teacher notifications (not admin)

      const { count } = await query
      setUnread(count || 0)
    } catch { setUnread(0) }
  }

  async function fetchUnreadMessages() {
    try {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('to_id', teacher.id)
        .eq('read', false)
      setUnreadMessages(count || 0)
    } catch { setUnreadMessages(0) }
  }

  async function fetchPendingReview() {
    if (!isAdmin) return
    try {
      const { count } = await supabase
        .from('lesson_plans')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'submitted')
      setPendingReview(count || 0)
    } catch { setPendingReview(0) }
  }

  async function fetchPendingAIReview() {
    try {
      const { data: qRows } = await supabase
        .from('questions')
        .select('id')
        .in('assessment_id',
          (await supabase.from('assessments').select('id').eq('created_by', teacher.id)).data?.map(a => a.id) || []
        )
      if (!qRows?.length) { setPendingAIReview(0); return }
      const { count } = await supabase
        .from('ai_evaluations')
        .select('id', { count: 'exact', head: true })
        .eq('requires_review', true)
        .in('question_id', qRows.map(q => q.id))
      setPendingAIReview(count || 0)
    } catch { setPendingAIReview(0) }
  }

  // ── Real-time subscriptions ─────────────────────────────────────────────────
  // Replaces 60s polling with instant updates via Supabase Realtime.
  // Subscriptions listen to INSERT/UPDATE/DELETE on notifications and messages.
  // RLS policies are respected automatically by Realtime.
  //
  // Performance impact:
  // - Before: 20-30 users × 2 queries/min = 40-60 queries/min
  // - After:  2 subscriptions/user, updates only when data changes
  // - Reduces DB load by ~95% and provides instant UX updates
  useEffect(() => {
    // Initial fetch
    fetchUnread()
    fetchUnreadMessages()
    fetchPendingReview()
    fetchPendingAIReview()

    // Subscribe to notifications changes
    const notificationsChannel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'notifications',
          filter: `school_id=eq.${teacher.school_id}`,
        },
        () => {
          // Refetch count when any notification changes
          fetchUnread()
        }
      )
      .subscribe()

    // Subscribe to messages changes
    const messagesChannel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'messages',
          filter: `to_id=eq.${teacher.id}`,
        },
        () => {
          // Refetch count when any message changes
          fetchUnreadMessages()
        }
      )
      .subscribe()

    // Subscribe to lesson_plans status changes (admin only — drives pending review badge)
    let plansChannel = null
    if (isAdmin) {
      plansChannel = supabase
        .channel('plans-status-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lesson_plans' },
          () => fetchPendingReview())
        .subscribe()
    }

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(notificationsChannel)
      supabase.removeChannel(messagesChannel)
      if (plansChannel) supabase.removeChannel(plansChannel)
    }
  }, [teacher.id, teacher.school_id, isAdmin])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  function closeSidebar() { setSidebarOpen(false) }

  const ini = teacher.initials ||
    (teacher.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'

  return (
    <div className="app">
      {/* Skip to main content link for keyboard navigation */}
      <a href="#main-content" className="skip-link">
        Saltar al contenido principal
      </a>

      <button className="btn-hamburger"
        onClick={() => setSidebarOpen(o => !o)} aria-label="Abrir menú">☰</button>

      <div className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={closeSidebar} />

      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sb-logo">
          <h1>{teacher.schools?.short_name || 'CBF'} PLANNER</h1>
          <p>{teacher.schools?.name}</p>
        </div>

        <nav className="sb-nav">
          {/* ── PLANIFICACIÓN (flujo pedagógico) ── */}
          <NavLink to="/principles" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
            <span className="dot" style={{ background: '#C9A84C' }} />
            📖 Principios
          </NavLink>
          <NavLink to="/objectives" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
            <span className="dot" style={{ background: '#C9A84C' }} />
            🎯 Objetivos
          </NavLink>
          <NavLink to="/syllabus" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
            <span className="dot" style={{ background: '#8064A2' }} />
            📚 Syllabus
          </NavLink>
          <NavLink to="/news" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
            <span className="dot" style={{ background: '#C0504D' }} />
            📋 NEWS Projects
          </NavLink>
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
            <span className="dot" style={{ background: '#2E5598' }} />
            📝 Nueva Guía
          </NavLink>
          <NavLink to="/plans" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
            <span className="dot" style={{ background: '#9BBB59' }} />
            📂 Mis Guías
          </NavLink>
          <NavLink to="/exams" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
            <span className="dot" style={{ background: '#C0504D' }} />
            📝 Evaluaciones
          </NavLink>
          {pendingAIReview > 0 && (
            <NavLink to="/exams/review" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
              <span className="dot" style={{ background: '#F59E0B' }} />
              👁 Revisión IA
              <span className="sb-notif-badge">{pendingAIReview}</span>
            </NavLink>
          )}
          <NavLink to="/students" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
            <span className="dot" style={{ background: '#8064A2' }} />
            👩‍🎓 Mis Estudiantes
          </NavLink>
          <NavLink to="/psicosocial" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
            <span className="dot" style={{ background: '#4BACC6' }} />
            🧠 Área Psicosocial
          </NavLink>

          <div className="sb-nav-divider" />

          {/* ── COMUNICACIÓN ── */}
          {features.messages !== false && (
            <NavLink to="/messages" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
              <span className="dot" style={{ background: '#4BACC6' }} />
              Mensajes
              {unreadMessages > 0 && (
                <span className="sb-notif-badge" style={{ background: '#4BACC6' }}>{unreadMessages}</span>
              )}
            </NavLink>
          )}

          <NavLink to="/library" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
            <span className="dot" style={{ background: '#9BBB59' }} />
            📚 Biblioteca de Guías
          </NavLink>
          <NavLink to="/ai-usage" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
            <span className="dot" style={{ background: '#8064A2' }} />
            Uso de IA
          </NavLink>

          {/* ── RECTOR standalone link — solo si NO es isAdmin (rector ya ve /director en el bloque admin) ── */}
          {hasDirectorView && !isAdmin && (
            <>
              <div className="sb-nav-divider" />
              <NavLink to="/director" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
                <span className="dot" style={{ background: '#B8860B' }} />
                🎓 Vista Rector
              </NavLink>
            </>
          )}
          {hasScheduleView && !isAdmin && (
            <>
              <div className="sb-nav-divider" />
              <NavLink to="/schedule" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
                <span className="dot" style={{ background: '#4BACC6' }} />
                🗓 Horario Institucional
              </NavLink>
            </>
          )}
          {hasAgendas && !isAdmin && (
            <>
              <div className="sb-nav-divider" />
              <NavLink to="/agenda" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
                <span className="dot" style={{ background: '#9BBB59' }} />
                {isHomeroomOnly
                  ? `🏠 Mi Grupo · ${teacher.homeroom_grade} ${teacher.homeroom_section}`
                  : isCoteacherOnly
                    ? `🤝 Co-teacher · ${teacher.coteacher_grade} ${teacher.coteacher_section}${coteacherActive ? ' 🔓' : ''}`
                    : '📋 Agenda Semanal'}
              </NavLink>
            </>
          )}

          {/* ── CALENDARIO (admin + psicopedagoga) ── */}
          {hasCalendar && !isAdmin && (
            <>
              <div className="sb-nav-divider" />
              <NavLink to="/calendar" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
                <span className="dot" style={{ background: '#C9A84C' }} />
                Calendario
                <span className="sb-admin-badge">Psicoped.</span>
              </NavLink>
            </>
          )}

          {/* ── ADMINISTRACIÓN (admin + superadmin) ── */}
          {isAdmin && (
            <>
              <div className="sb-nav-divider" />
              <NavLink to="/teachers" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
                <span className="dot" style={{ background: '#9BBB59' }} />
                Docentes
              </NavLink>
              <NavLink to="/notifications" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
                <span className="dot" style={{ background: '#C0504D' }} />
                Notificaciones
                {unread > 0 && <span className="sb-notif-badge">{unread}</span>}
              </NavLink>
              <NavLink to="/calendar" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
                <span className="dot" style={{ background: '#C9A84C' }} />
                Calendario
                <span className="sb-admin-badge">Admin</span>
              </NavLink>
              <NavLink to="/schedule" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
                <span className="dot" style={{ background: '#4BACC6' }} />
                🗓 Horario
                <span className="sb-admin-badge">Admin</span>
              </NavLink>
              <NavLink to="/agenda" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
                <span className="dot" style={{ background: '#9BBB59' }} />
                📋 Agenda Semanal
                <span className="sb-admin-badge">Admin</span>
              </NavLink>
              <NavLink to="/curriculum" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
                <span className="dot" style={{ background: '#4F81BD' }} />
                📊 Malla Curricular
                <span className="sb-admin-badge">Admin</span>
              </NavLink>
              <NavLink to="/sala-revision" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
                <span className="dot" style={{ background: '#C0504D' }} />
                🏛 Sala de Revisión
                {pendingReview > 0
                  ? <span className="sb-notif-badge">{pendingReview}</span>
                  : <span className="sb-admin-badge">Admin</span>
                }
              </NavLink>
              <NavLink to="/subjects" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
                <span className="dot" style={{ background: '#F79646' }} />
                📋 Materias
                <span className="sb-admin-badge">Admin</span>
              </NavLink>
              <NavLink to="/library" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
                <span className="dot" style={{ background: '#9BBB59' }} />
                📚 Biblioteca
                <span className="sb-admin-badge">Admin</span>
              </NavLink>
              <NavLink to="/coverage" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
                <span className="dot" style={{ background: '#8064A2' }} />
                🔭 Cobertura eleot®
                <span className="sb-admin-badge">Admin</span>
              </NavLink>
              <NavLink to="/observations" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
                <span className="dot" style={{ background: '#C0504D' }} />
                🔎 Observaciones
                <span className="sb-admin-badge">Admin</span>
              </NavLink>
              <NavLink to="/settings" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
                <span className="dot" style={{ background: '#555' }} />
                ⚙️ Panel de control
                <span className="sb-admin-badge">Admin</span>
              </NavLink>
              {isSuperAdm && (
                <NavLink to="/superadmin" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
                  <span className="dot" style={{ background: '#C0504D' }} />
                  🔑 Panel Superadmin
                  <span className="sb-admin-badge" style={{ background: '#C0504D' }}>Superadmin</span>
                </NavLink>
              )}
            </>
          )}
        </nav>

        <div className="sb-profile-bar">
          <button className="btn-profile has-profile"
            onClick={() => { setShowProfile(true); closeSidebar() }}>
            <span className="sb-avatar">{ini}</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
              <span className="sb-name">{teacher.full_name.split(' ')[0]}</span>
              {teacher.role !== 'teacher' && (
                <span style={{
                  fontSize: '9px', fontWeight: 700, letterSpacing: '.4px',
                  color: ROLE_STYLES[teacher.role]?.color || '#888',
                  textTransform: 'uppercase', lineHeight: 1,
                }}>
                  {roleLabel(teacher.role)}
                </span>
              )}
            </div>
            <span className="prof-edit-icon">✎</span>
          </button>
          <button className="btn-logout" onClick={handleLogout} title="Cerrar sesión">⎋</button>
        </div>
      </div>

      <main id="main-content" className="main">
        <Routes>
          <Route path="/"            element={<PlannerPage          teacher={teacher} />} />
          <Route path="/plans"       element={<MyPlansPage          teacher={teacher} />} />
          <Route path="/editor/:id"  element={<GuideEditorPage      teacher={teacher} />} />
          <Route path="/news/timeline" element={<NewsTimelinePage    teacher={teacher} />} />
          <Route path="/news"        element={<NewsPage             teacher={teacher} />} />
          <Route path="/objectives"  element={<ObjectivesPage      teacher={teacher} />} />
          <Route path="/syllabus"    element={<SyllabusPage        teacher={teacher} />} />
          <Route path="/principles"  element={<PrinciplesPage       teacher={teacher} />} />
          <Route path="/ai-usage"    element={<AIUsagePage          teacher={teacher} />} />
          <Route path="/library"     element={<GuideLibraryPage        teacher={teacher} />} />
          <Route path="/exams"         element={<ExamDashboardPage       teacher={teacher} />} />
          <Route path="/exams/create"  element={<ExamCreatorPage        teacher={teacher} />} />
          <Route path="/exams/review"  element={<ExamReviewPage         teacher={teacher} />} />
          <Route path="/students"      element={<StudentsPage            teacher={teacher} />} />
          <Route path="/psicosocial"   element={<PsicosocialPage         teacher={teacher} />} />
          <Route path="/coverage"    element={<PeriodCoverageDashboard teacher={teacher} />} />
          <Route path="/observations" element={<ObservationLoggerPage  teacher={teacher} />} />
          <Route path="/messages"   element={<MessagesPage         teacher={teacher} onUpdate={fetchUnreadMessages} />} />
          {hasDirectorView && (
            <Route path="/director" element={<DirectorPage teacher={teacher} />} />
          )}
          {hasCalendar && !isAdmin && (
            <Route path="/calendar" element={<CalendarPage teacher={teacher} />} />
          )}
          {hasScheduleView && !isAdmin && (
            <Route path="/schedule" element={<SchedulePage teacher={teacher} />} />
          )}
          {hasAgendas && !isAdmin && (
            <Route path="/agenda" element={<AgendaPage teacher={teacher} />} />
          )}
          {isAdmin && (
            <>
              <Route path="/calendar"      element={<CalendarPage      teacher={teacher} />} />
              <Route path="/schedule"      element={<SchedulePage      teacher={teacher} />} />
              <Route path="/agenda"      element={<AgendaPage      teacher={teacher} />} />
              <Route path="/curriculum"      element={<CurriculumPage          teacher={teacher} />} />
              <Route path="/sala-revision" element={<ReviewRoomPage          teacher={teacher} />} />
              <Route path="/subjects"      element={<SubjectManagerPage      teacher={teacher} />} />
              <Route path="/notifications" element={<NotificationsPage teacher={teacher} onRead={() => setUnread(0)} />} />
              <Route path="/teachers"      element={<AdminTeachersPage teacher={teacher} />} />
              <Route path="/settings"      element={<SettingsPage      teacher={teacher} />} />
              <Route path="/director"      element={<DirectorPage      teacher={teacher} />} />
              {isSuperAdm && (
                <Route path="/superadmin" element={<SuperAdminPage teacher={teacher} />} />
              )}
            </>
          )}
        </Routes>
      </main>

      {showProfile && (
        <ProfileModal
          teacher={teacher}
          onClose={() => setShowProfile(false)}
          onSave={setTeacher}
        />
      )}
    </div>
  )
}
