import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastProvider } from './context/ToastContext'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ProfileSetupPage from './pages/ProfileSetupPage'
import PendingPage from './pages/PendingPage'
import RejectedPage from './pages/RejectedPage'
import SetPasswordPage from './pages/SetPasswordPage'

export default function App() {
  const [session,    setSession]    = useState(undefined) // undefined = loading
  const [teacher,    setTeacher]    = useState(null)
  const [loadError,  setLoadError]  = useState(false)
  const [isRecovery, setIsRecovery] = useState(false)
  const [loginError, setLoginError] = useState(null)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadTeacher(session.user.id)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true)
        setSession(session)
        return
      }

      // Validate domain for Google OAuth sign-ins
      if (event === 'SIGNED_IN' && session) {
        const provider = session.user.app_metadata?.provider
        const providers = session.user.app_metadata?.providers || []
        const isGoogle = provider === 'google' || providers.includes('google')
        if (isGoogle) {
          const { data: schoolData } = await supabase
            .from('schools').select('features').limit(1).single()
          const restrict     = schoolData?.features?.restrict_email_domain !== false
          const allowedDomain = schoolData?.features?.email_domain || 'redboston.edu.co'
          const emailDomain  = session.user.email?.toLowerCase().split('@')[1] || ''
          if (restrict && emailDomain !== allowedDomain) {
            await supabase.auth.signOut()
            setLoginError(`Solo se permiten cuentas Google @${allowedDomain}. Tu cuenta no está autorizada.`)
            setSession(null)
            return
          }
        }
      }

      setSession(session)
      if (session) loadTeacher(session.user.id)
      else setTeacher(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadTeacher(userId) {
    const { data, error } = await supabase
      .from('teachers')
      .select('*, schools(*)')
      .eq('id', userId)
      .single()
    if (error) { setLoadError(true); return }
    setTeacher(data)
  }

  // Password recovery flow (docente using recovery link)
  if (isRecovery) {
    return (
      <ErrorBoundary>
        <ToastProvider>
          <SetPasswordPage onDone={() => {
            setIsRecovery(false)
            if (session) loadTeacher(session.user.id)
          }} />
        </ToastProvider>
      </ErrorBoundary>
    )
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

  // Error loading teacher profile (network issue, RLS, etc.)
  if (loadError) {
    return (
      <div className="loading-screen">
        <div className="loading-logo">⚠️</div>
        <div className="loading-text">No se pudo cargar tu perfil</div>
        <p style={{ color: '#888', fontSize: 13, margin: '8px 0 20px' }}>
          Verifica tu conexión a internet e intenta de nuevo.
        </p>
        <button
          onClick={() => { setLoadError(false); loadTeacher(session?.user?.id) }}
          style={{ padding: '10px 24px', background: '#1A3A8F', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}
        >
          🔄 Reintentar
        </button>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter basename="/cbf-planner">
          <Routes>
          {/* Not logged in → Login */}
          <Route path="/login" element={
            session ? <Navigate to="/" replace /> : <LoginPage loginError={loginError} />
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
      </ToastProvider>
    </ErrorBoundary>
  )
}
