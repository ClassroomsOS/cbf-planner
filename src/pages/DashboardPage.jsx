import { useState, useEffect, lazy, Suspense, useCallback } from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import PlannerPage         from './PlannerPage'
import MyPlansPage         from './MyPlansPage'
import GuideEditorPage     from './GuideEditorPage'
import MessagesPage        from './MessagesPage'

// Lazy-loaded pages — code splitting to reduce initial bundle
const CalendarPage             = lazy(() => import('./CalendarPage'))
const AcademicCalendarPage     = lazy(() => import('./AcademicCalendarPage'))
const NotificationsPage        = lazy(() => import('./NotificationsPage'))
const AdminTeachersPage        = lazy(() => import('./AdminTeachersPage'))
const AIUsagePage              = lazy(() => import('./AIUsagePage'))
const SettingsPage             = lazy(() => import('./SettingsPage'))
const SuperAdminPage           = lazy(() => import('./SuperAdminPage'))
const AchievementsPage         = lazy(() => import('./AchievementsPage'))
const SyllabusPage             = lazy(() => import('./SyllabusPage'))
const NewsPage                 = lazy(() => import('./NewsPage'))
const NewsTimelinePage         = lazy(() => import('./NewsTimelinePage'))
const ReviewRoomPage           = lazy(() => import('./ReviewRoomPage'))
const ExamDashboardPage        = lazy(() => import('./ExamDashboardPage'))
const ExamCreatorPage          = lazy(() => import('./ExamCreatorPage'))
const ExamViewPage             = lazy(() => import('./ExamViewPage'))
const ExamReviewPage           = lazy(() => import('./ExamReviewPage'))
const ExamRevisionPage         = lazy(() => import('./ExamRevisionPage'))
const StudentsPage             = lazy(() => import('./StudentsPage'))
const PsicosocialPage          = lazy(() => import('./PsicosocialPage'))
const SubjectManagerPage       = lazy(() => import('./SubjectManagerPage'))
const GuideLibraryPage         = lazy(() => import('./GuideLibraryPage'))
const LibraryPage              = lazy(() => import('./LibraryPage'))
const PeriodCoverageDashboard  = lazy(() => import('./PeriodCoverageDashboard'))
const ObservationLoggerPage    = lazy(() => import('./ObservationLoggerPage'))
const PrinciplesPage           = lazy(() => import('./PrinciplesPage'))
const DirectorPage             = lazy(() => import('./DirectorPage'))
const SchedulePage             = lazy(() => import('./SchedulePage'))
const AgendaPage               = lazy(() => import('./AgendaPage'))
const CurriculumPage           = lazy(() => import('./CurriculumPage'))
const GradingHubPage           = lazy(() => import('./GradingHubPage'))
const GradingSessionPage       = lazy(() => import('./GradingSessionPage'))
const GradingDisplayPage       = lazy(() => import('./GradingDisplayPage'))
const GradingHistoryPage       = lazy(() => import('./GradingHistoryPage'))
const GradebookPage            = lazy(() => import('./GradebookPage'))
const QuickGradePage           = lazy(() => import('./QuickGradePage'))
const StudentPlayerPage        = lazy(() => import('./StudentPlayerPage'))
const StudentDetailPage        = lazy(() => import('./StudentDetailPage'))
const QADashboardPage          = lazy(() => import('./QADashboardPage'))
const DevStatusPage            = lazy(() => import('./DevStatusPage'))
const InstrumentPage           = lazy(() => import('./InstrumentPage'))
const DictationPage            = lazy(() => import('./DictationPage'))
const SessionControlPage       = lazy(() => import('./SessionControlPage'))
import ProfileModal        from '../components/ProfileModal'
import { FeaturesProvider, useFeatures } from '../context/FeaturesContext'
import { QAProvider }    from '../qa/QAContext'
import QARunner          from '../qa/QARunner'
import QALauncher        from '../qa/QALauncher'
import { canManage, canAccessCalendar, isRector, canReadAllPlans, canViewSchedule, canManageAgendas, isCoteacherActive, isSuperAdmin, roleLabel, ROLE_STYLES } from '../utils/roles'
import { setAIContext } from '../utils/AIAssistant'
import { getCurrentPeriod, getPeriodProgress } from '../utils/constants'

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
  const [showProfile,    setShowProfile]    = useState(false)
  const [sidebarOpen,    setSidebarOpen]    = useState(false)
  const [showQA,         setShowQA]         = useState(false)
  const [qaLastResults,  setQaLastResults]  = useState({})

  function storeQALast(suiteId, counts) {
    setQaLastResults(prev => ({ ...prev, [suiteId]: counts }))
  }
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
      const { data: sesRows } = await supabase
        .from('exam_sessions')
        .select('id')
        .eq('teacher_id', teacher.id)
      if (!sesRows?.length) { setPendingAIReview(0); return }
      const { count } = await supabase
        .from('exam_responses')
        .select('id', { count: 'exact', head: true })
        .eq('needs_human_review', true)
        .in('session_id', sesRows.map(s => s.id))
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
    <QAProvider>
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

        <PeriodWidget />

        <SidebarNav
          teacher={teacher}
          isAdmin={isAdmin}
          isSuperAdm={isSuperAdm}
          features={features}
          closeSidebar={closeSidebar}
          unread={unread}
          unreadMessages={unreadMessages}
          pendingReview={pendingReview}
          pendingAIReview={pendingAIReview}
          hasDirectorView={hasDirectorView}
          hasScheduleView={hasScheduleView}
          hasAgendas={hasAgendas}
          hasCalendar={hasCalendar}
          isHomeroomOnly={isHomeroomOnly}
          isCoteacherOnly={isCoteacherOnly}
          coteacherActive={coteacherActive}
        />

        <div className="sb-profile-bar">
          {(teacher.role === 'admin' || isSuperAdmin(teacher) || isRector(teacher)) && (
            <button className="btn-qa" title="Modo QA — Verificación guiada"
              onClick={() => { setShowQA(true); closeSidebar() }}>
              🧪
            </button>
          )}
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
        <Suspense fallback={<div style={{padding:'2rem',textAlign:'center'}}>Cargando…</div>}>
        <Routes>
          <Route path="/"            element={<PlannerPage          teacher={teacher} />} />
          <Route path="/plans"       element={<MyPlansPage          teacher={teacher} />} />
          <Route path="/editor/:id"  element={<GuideEditorPage      teacher={teacher} />} />
          <Route path="/news/timeline" element={<NewsTimelinePage    teacher={teacher} />} />
          <Route path="/news"        element={<NewsPage             teacher={teacher} />} />
          <Route path="/achievements"  element={<AchievementsPage     teacher={teacher} />} />
          <Route path="/syllabus"    element={<SyllabusPage        teacher={teacher} />} />
          <Route path="/biblioteca"  element={<LibraryPage         teacher={teacher} />} />
          <Route path="/principles"  element={<PrinciplesPage       teacher={teacher} />} />
          <Route path="/ai-usage"    element={<AIUsagePage          teacher={teacher} />} />
          <Route path="/library"     element={<GuideLibraryPage        teacher={teacher} />} />
          <Route path="/exams"         element={<ExamDashboardPage       teacher={teacher} />} />
          <Route path="/exams/create"  element={<ExamCreatorPage        teacher={teacher} />} />
          <Route path="/exams/review"    element={<ExamReviewPage         teacher={teacher} />} />
          <Route path="/exams/revision"  element={<ExamRevisionPage       teacher={teacher} />} />
          <Route path="/exams/:id"     element={<ExamViewPage           teacher={teacher} />} />
          <Route path="/dictations"    element={<DictationPage           teacher={teacher} />} />
          <Route path="/dictations/session/:sessionId" element={<SessionControlPage teacher={teacher} />} />
          <Route path="/students"      element={<StudentsPage            teacher={teacher} />} />
          <Route path="/player"               element={<StudentPlayerPage   teacher={teacher} />} />
          <Route path="/player/:studentId"    element={<StudentDetailPage   teacher={teacher} />} />
          <Route path="/grades"               element={<GradebookPage       teacher={teacher} />} />
          <Route path="/grades/quick/:id"    element={<QuickGradePage      teacher={teacher} />} />
          <Route path="/instrument/:planId"  element={<InstrumentPage      teacher={teacher} />} />
          <Route path="/grading"             element={<GradingHubPage      teacher={teacher} />} />
          <Route path="/grading/session/:id" element={<GradingSessionPage  teacher={teacher} />} />
          <Route path="/grading/display/:id" element={<GradingDisplayPage  teacher={teacher} />} />
          <Route path="/grading/history"     element={<GradingHistoryPage  teacher={teacher} />} />
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
          {!isAdmin && (
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
              <Route path="/settings"           element={<SettingsPage           teacher={teacher} />} />
              <Route path="/director"           element={<DirectorPage           teacher={teacher} />} />
              <Route path="/academic-calendar"  element={<AcademicCalendarPage   teacher={teacher} />} />
              <Route path="/qa"                 element={<QADashboardPage        teacher={teacher} />} />
              <Route path="/dev-status"         element={<DevStatusPage />} />
              {isSuperAdm && (
                <Route path="/superadmin" element={<SuperAdminPage teacher={teacher} />} />
              )}
            </>
          )}
        </Routes>
        </Suspense>
      </main>

      {showProfile && (
        <ProfileModal
          teacher={teacher}
          onClose={() => setShowProfile(false)}
          onSave={setTeacher}
        />
      )}

      {/* QA system — solo admin/rector/superadmin */}
      {showQA && (
        <QALauncher
          onClose={() => setShowQA(false)}
          lastResults={qaLastResults}
          teacher={teacher}
        />
      )}
      <QARunner onStoreLast={storeQALast} teacher={teacher} />

    </div>
    </QAProvider>
  )
}

// ── NavSection — collapsible + hideable sidebar group ────────────────────────
function NavSection({ id, title, icon, defaultOpen = true, hidden, onHide, children }) {
  const [open, setOpen] = useState(defaultOpen)
  if (hidden) return null
  return (
    <div className={`sb-section ${open ? 'sb-section-open' : ''}`}>
      <button className="sb-section-toggle" onClick={() => setOpen(!open)}>
        <span className="sb-section-icon">{icon}</span>
        <span className="sb-section-title">{title}</span>
        <span className="sb-section-arrow">{open ? '▾' : '▸'}</span>
      </button>
      {onHide && (
        <button className="sb-section-hide" onClick={onHide} title={`Ocultar sección "${title}"`}>✕</button>
      )}
      {open && <div className="sb-section-items">{children}</div>}
    </div>
  )
}

// ── SidebarNav — grouped collapsible navigation ──────────────────────────────
const HIDDEN_SECTIONS_KEY = 'cbf_sidebar_hidden'

function SidebarNav({
  teacher, isAdmin, isSuperAdm, features, closeSidebar,
  unread, unreadMessages, pendingReview, pendingAIReview,
  hasDirectorView, hasScheduleView, hasAgendas, hasCalendar,
  isHomeroomOnly, isCoteacherOnly, coteacherActive,
}) {
  const [hiddenSections, setHiddenSections] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HIDDEN_SECTIONS_KEY)) || [] }
    catch { return [] }
  })

  function hideSection(id) {
    const next = [...hiddenSections, id]
    setHiddenSections(next)
    localStorage.setItem(HIDDEN_SECTIONS_KEY, JSON.stringify(next))
  }

  function restoreAll() {
    setHiddenSections([])
    localStorage.removeItem(HIDDEN_SECTIONS_KEY)
  }

  const L = ({ to, end, dot, children }) => (
    <NavLink to={to} end={end} className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
      <span className="dot" style={{ background: dot }} />
      {children}
    </NavLink>
  )

  return (
    <nav className="sb-nav">
      {/* ── OPERACIÓN DOCENTE ── */}
      <NavSection id="operacion" title="Operación" icon="📝" defaultOpen={true}
        hidden={hiddenSections.includes('operacion')} onHide={() => hideSection('operacion')}>
        <L to="/principles" dot="#C9A84C">📖 Principios</L>
        <L to="/achievements" dot="#C9A84C">🎯 Logros</L>
        <L to="/biblioteca" dot="#2E5598">📖 Biblioteca CBF</L>
        <L to="/syllabus" dot="#8064A2">📚 Syllabus</L>
        <L to="/news" dot="#C0504D">📋 NEWS Projects</L>
        <L to="/" end dot="#2E5598">📝 Nueva Guía</L>
        <L to="/plans" dot="#9BBB59">📂 Mis Guías</L>
        <L to="/exams" dot="#C0504D">📝 Evaluaciones</L>
        <L to="/dictations" dot="#4BACC6">🎧 Dictados</L>
        {pendingAIReview > 0 && (
          <NavLink to="/exams/review" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
            <span className="dot" style={{ background: '#F59E0B' }} />
            👁 Revisión IA
            <span className="sb-notif-badge">{pendingAIReview}</span>
          </NavLink>
        )}
        <L to="/player" dot="#FFD700">👩‍🎓 Mis Estudiantes BF</L>
        <L to="/grades" dot="#15803D">📊 Calificaciones</L>
        <L to="/psicosocial" dot="#4BACC6">🧠 Área Psicosocial</L>
        {features.messages !== false && (
          <NavLink to="/messages" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
            <span className="dot" style={{ background: '#4BACC6' }} />
            ✉ Mensajes
            {unreadMessages > 0 && <span className="sb-notif-badge" style={{ background: '#4BACC6' }}>{unreadMessages}</span>}
          </NavLink>
        )}
        <L to="/library" dot="#9BBB59">📚 Biblioteca de Guías</L>
        <L to="/ai-usage" dot="#8064A2">🤖 Uso de IA</L>
      </NavSection>

      {/* ── SUPERVISIÓN (rector, homeroom, co-teacher, psicoped) ── */}
      {(hasDirectorView || hasScheduleView || hasAgendas || hasCalendar || (isAdmin && canManage(teacher.role))) && (
        <NavSection id="supervision" title={isAdmin ? 'Supervisión' : 'Mi Rol'} icon="🎓" defaultOpen={true}
          hidden={hiddenSections.includes('supervision')} onHide={() => hideSection('supervision')}>
          {hasDirectorView && (
            <L to="/director" dot="#B8860B">🎓 Vista Rector</L>
          )}
          {canManage(teacher.role) && (
            <L to="/exams/revision" dot="#991B1B">🏛 Aprobar Exámenes</L>
          )}
          {isAdmin && (
            <NavLink to="/sala-revision" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
              <span className="dot" style={{ background: '#C0504D' }} />
              🏛 Sala de Revisión
              {pendingReview > 0 && <span className="sb-notif-badge">{pendingReview}</span>}
            </NavLink>
          )}
          <L to="/schedule" dot="#4BACC6">{hasScheduleView ? '🗓 Horario Institucional' : '🗓 Mi Horario'}</L>
          {hasAgendas && (
            <NavLink to="/agenda" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
              <span className="dot" style={{ background: '#9BBB59' }} />
              {isHomeroomOnly
                ? `🏠 Mi Grupo · ${teacher.homeroom_grade} ${teacher.homeroom_section}`
                : isCoteacherOnly
                  ? `🤝 Co-teacher · ${teacher.coteacher_grade} ${teacher.coteacher_section}${coteacherActive ? ' 🔓' : ''}`
                  : '📋 Agenda Semanal'}
            </NavLink>
          )}
          {hasCalendar && !isAdmin && (
            <L to="/calendar" dot="#C9A84C">📅 Calendario</L>
          )}
          {isAdmin && (
            <>
              <L to="/coverage" dot="#8064A2">🔭 Cobertura eleot®</L>
              <L to="/observations" dot="#C0504D">🔎 Observaciones</L>
              <L to="/curriculum" dot="#4F81BD">📊 Malla Curricular</L>
            </>
          )}
        </NavSection>
      )}

      {/* ── ADMINISTRACIÓN (solo admin/superadmin) ── */}
      {isAdmin && (
        <NavSection id="admin" title="Administración" icon="⚙️" defaultOpen={false}
          hidden={hiddenSections.includes('admin')} onHide={() => hideSection('admin')}>
          <L to="/teachers" dot="#9BBB59">👥 Docentes</L>
          {isAdmin && (
            <NavLink to="/students" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
              <span className="dot" style={{ background: '#8064A2' }} />
              🎓 Estudiantes BF
            </NavLink>
          )}
          <NavLink to="/notifications" className={({ isActive }) => isActive ? 'active' : ''} onClick={closeSidebar}>
            <span className="dot" style={{ background: '#C0504D' }} />
            🔔 Notificaciones
            {unread > 0 && <span className="sb-notif-badge">{unread}</span>}
          </NavLink>
          <L to="/calendar" dot="#C9A84C">📅 Calendario</L>
          <L to="/schedule" dot="#4BACC6">🗓 Horario</L>
          <L to="/subjects" dot="#F79646">📋 Materias</L>
          <L to="/academic-calendar" dot="#4BACC6">📅 Calendario Académico</L>
          <L to="/settings" dot="#555">⚙️ Panel de control</L>
          <L to="/qa" dot="#2563eb">📡 Observabilidad</L>
          <L to="/dev-status" dot="#7c3aed">🗺️ Estado del Sistema</L>
          {isSuperAdm && (
            <L to="/superadmin" dot="#C0504D">🔑 Panel Superadmin</L>
          )}
        </NavSection>
      )}
      {hiddenSections.length > 0 && (
        <button className="sb-restore-btn" onClick={restoreAll}>
          👁 Mostrar secciones ocultas ({hiddenSections.length})
        </button>
      )}
    </nav>
  )
}

// ── PeriodWidget — sidebar progress indicator ──────────────────────────────────
function PeriodWidget() {
  const today   = new Date()
  const period  = getCurrentPeriod(today)
  const progress = period ? getPeriodProgress(period, today) : null

  if (!period || !progress) {
    // Between periods or no dates configured — show nothing
    return null
  }

  const shortEnd = new Date(period.end + 'T12:00:00').toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short'
  })

  return (
    <div className="sb-period-widget">
      <div className="sb-period-header">
        <span className="sb-period-badge">{period.short}</span>
        <span className="sb-period-name">{period.label}</span>
      </div>
      <div className="sb-period-bar-track">
        <div className="sb-period-bar-fill" style={{ width: `${progress.pct}%` }} />
      </div>
      <div className="sb-period-footer">
        <span className="sb-period-weeks">
          {progress.remainingWeeks > 0
            ? `${progress.remainingWeeks} sem. restantes`
            : progress.isComplete ? 'Período finalizado' : 'Última semana'}
        </span>
        <span className="sb-period-end">hasta {shortEnd}</span>
      </div>
    </div>
  )
}
