import { useState } from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import PlannerPage from './PlannerPage'
import MyPlansPage from './MyPlansPage'
import ProfileModal from '../components/ProfileModal'

export default function DashboardPage({ session, teacher, setTeacher }) {
  const [showProfile, setShowProfile] = useState(false)
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const ini = teacher.initials ||
    teacher.full_name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()

  return (
    <div className="app">

      {/* ── Sidebar ── */}
      <div className="sidebar">
        <div className="sb-logo">
          <h1>{teacher.schools?.short_name || 'CBF'} PLANNER</h1>
          <p>{teacher.schools?.name}</p>
        </div>

        <nav className="sb-nav">
          <NavLink to="/" end className={({isActive}) => isActive ? 'active' : ''}>
            <span className="dot" style={{background:'#2E5598'}} />
            Nueva Guía
          </NavLink>
          <NavLink to="/plans" className={({isActive}) => isActive ? 'active' : ''}>
            <span className="dot" style={{background:'#9BBB59'}} />
            Mis Guías
          </NavLink>
        </nav>

        {/* Profile bar */}
        <div className="sb-profile-bar">
          <button className="btn-profile has-profile" onClick={() => setShowProfile(true)}>
            <span className="sb-avatar">{ini}</span>
            <span className="sb-name">{teacher.full_name.split(' ')[0]}</span>
            <span className="prof-edit-icon">✎</span>
          </button>
          <button className="btn-logout" onClick={handleLogout} title="Cerrar sesión">
            ⎋
          </button>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="main">
        <Routes>
          <Route path="/"       element={<PlannerPage teacher={teacher} />} />
          <Route path="/plans"  element={<MyPlansPage teacher={teacher} />} />
        </Routes>
      </div>

      {/* ── Profile modal ── */}
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
