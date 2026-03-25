import { useState } from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import PlannerPage      from './PlannerPage'
import MyPlansPage      from './MyPlansPage'
import CalendarPage     from './CalendarPage'
import GuideEditorPage  from './GuideEditorPage'
import ProfileModal     from '../components/ProfileModal'

export default function DashboardPage({ session, teacher, setTeacher }) {
  const [showProfile, setShowProfile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()

  const isAdmin = teacher.role === 'admin'

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
          {isAdmin && (
            <>
              <div className="sb-nav-divider" />
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
          <Route path="/"              element={<PlannerPage     teacher={teacher} />} />
          <Route path="/plans"         element={<MyPlansPage     teacher={teacher} />} />
          <Route path="/editor/:id"    element={<GuideEditorPage teacher={teacher} />} />
          {isAdmin && (
            <Route path="/calendar"   element={<CalendarPage    teacher={teacher} />} />
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
