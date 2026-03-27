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
import ProfileModal        from '../components/ProfileModal'

export default function DashboardPage({ session, teacher, setTeacher }) {
  const [showProfile, setShowProfile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()

  const isAdmin = teacher.role === 'admin'
  const [unread,        setUnread]        = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)

  useEffect(() => {
    fetchUnread()
    fetchUnreadMessages()
    const interval = setInterval(() => {
      fetchUnread()
      fetchUnreadMessages()
    }, 60000)
    return () => clearInterval(interval)
  }, [teacher.id, isAdmin])

  async function fetchUnread() {
    const query = supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('read', false)
      .eq('school_id', teacher.school_id)
    if (isAdmin) {
      query.eq('to_role', 'admin')
    } else {
      query.eq('from_id', teacher.id).eq('to_role', 'teacher')
    }
    const { count } = await query
    setUnread(count || 0)
  }

  async function fetchUnreadMessages() {
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('to_id', teacher.id)
      .eq('read', false)
    setUnreadMessages(count || 0)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  function closeSidebar() { setSidebarOpen(false) }

  const ini = teacher.initials ||
    teacher.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="app">
      <button className="btn-hamburger"
        onClick={() => setSidebarOpen(o => !o)} aria-label="Abrir menú">☰</button>

      <div className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={closeSidebar} />

      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sb-logo">
          <h1>{teacher.schools?.short_name || 'CBF'} PLANNER</h1>
          <p>{teacher.schools?.name}</p>
        </div>

        <nav className="sb-nav">
          <NavLink to="/" end
            className={({ isActive }) => isActive ? 'active' : ''}
            onClick={closeSidebar}>
            <span className="dot" style={{ background: '#2E5598' }} />
            Nueva Guía
          </NavLink>
          <NavLink to="/plans"
            className={({ isActive }) => isActive ? 'active' : ''}
            onClick={closeSidebar}>
            <span className="dot" style={{ background: '#9BBB59' }} />
            Mis Guías
          </NavLink>

          <div className="sb-nav-divider" />

          <NavLink to="/messages"
            className={({ isActive }) => isActive ? 'active' : ''}
            onClick={closeSidebar}>
            <span className="dot" style={{ background: '#4BACC6' }} />
            Mensajes
            {unreadMessages > 0 && (
              <span className="sb-notif-badge" style={{ background: '#4BACC6' }}>
                {unreadMessages}
              </span>
            )}
          </NavLink>

          <NavLink to="/ai-usage"
            className={({ isActive }) => isActive ? 'active' : ''}
            onClick={closeSidebar}>
            <span className="dot" style={{ background: '#8064A2' }} />
            Uso de IA
          </NavLink>

          {isAdmin && (
            <>
              <div className="sb-nav-divider" />
              <NavLink to="/teachers"
                className={({ isActive }) => isActive ? 'active' : ''}
                onClick={closeSidebar}>
                <span className="dot" style={{ background: '#9BBB59' }} />
                Docentes
              </NavLink>
              <NavLink to="/notifications"
                className={({ isActive }) => isActive ? 'active' : ''}
                onClick={closeSidebar}>
                <span className="dot" style={{ background: '#C0504D' }} />
                Notificaciones
                {unread > 0 && <span className="sb-notif-badge">{unread}</span>}
              </NavLink>
              <NavLink to="/calendar"
                className={({ isActive }) => isActive ? 'active' : ''}
                onClick={closeSidebar}>
                <span className="dot" style={{ background: '#C9A84C' }} />
                Calendario
                <span className="sb-admin-badge">Admin</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="sb-profile-bar">
          <button className="btn-profile has-profile"
            onClick={() => { setShowProfile(true); closeSidebar() }}>
            <span className="sb-avatar">{ini}</span>
            <span className="sb-name">{teacher.full_name.split(' ')[0]}</span>
            <span className="prof-edit-icon">✎</span>
          </button>
          <button className="btn-logout" onClick={handleLogout} title="Cerrar sesión">⎋</button>
        </div>
      </div>

      <div className="main">
        <Routes>
          <Route path="/"           element={<PlannerPage     teacher={teacher} />} />
          <Route path="/plans"      element={<MyPlansPage     teacher={teacher} />} />
          <Route path="/editor/:id" element={<GuideEditorPage teacher={teacher} />} />
          <Route path="/ai-usage"   element={<AIUsagePage     teacher={teacher} />} />
          <Route path="/messages"   element={<MessagesPage    teacher={teacher} onUpdate={fetchUnreadMessages} />} />
          {isAdmin && (
            <>
              <Route path="/calendar"      element={<CalendarPage      teacher={teacher} />} />
              <Route path="/notifications" element={<NotificationsPage teacher={teacher} onRead={() => setUnread(0)} />} />
              <Route path="/teachers"      element={<AdminTeachersPage teacher={teacher} />} />
            </>
          )}
        </Routes>
      </div>

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
