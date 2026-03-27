import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ProfileSetupPage from './pages/ProfileSetupPage'
import PendingPage from './pages/PendingPage'
import RejectedPage from './pages/RejectedPage'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [teacher, setTeacher] = useState(null)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadTeacher(session.user.id)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadTeacher(session.user.id)
      else setTeacher(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadTeacher(userId) {
    const { data } = await supabase
      .from('teachers')
      .select('*, schools(*)')
      .eq('id', userId)
      .single()
    setTeacher(data)
  }

  // Still loading
  if (session === undefined) {
    return (
      <div className="loading-screen">
        <div className="loading-logo">📋</div>
        <div className="loading-text">CBF Planner</div>
        <div className="loading-spinner" />
      </div>
    )
  }

  return (
    <BrowserRouter basename="/cbf-planner">
      <Routes>
        {/* Not logged in → Login */}
        <Route path="/login" element={
          session ? <Navigate to="/" replace /> : <LoginPage />
        } />

        {/* Logged in but no profile yet → Setup */}
        <Route path="/setup" element={
          !session ? <Navigate to="/login" replace /> :
          teacher ? <Navigate to="/" replace /> :
          <ProfileSetupPage session={session} onComplete={setTeacher} />
        } />

        {/* Pending approval */}
        <Route path="/pending" element={
          !session ? <Navigate to="/login" replace /> :
          !teacher ? <Navigate to="/setup" replace /> :
          teacher.status !== 'pending' ? <Navigate to="/" replace /> :
          <PendingPage teacher={teacher} />
        } />

        {/* Main app */}
        <Route path="/*" element={
          !session ? <Navigate to="/login" replace /> :
          !teacher ? <Navigate to="/setup" replace /> :
          teacher.status === 'pending' ? <Navigate to="/pending" replace /> :
          teacher.status === 'rejected' ? <Navigate to="/rejected" replace /> :
          <DashboardPage session={session} teacher={teacher} setTeacher={setTeacher} />
        } />

        {/* Rejected */}
        <Route path="/rejected" element={
          !session ? <Navigate to="/login" replace /> :
          <RejectedPage />
        } />
      </Routes>
    </BrowserRouter>
  )
}
