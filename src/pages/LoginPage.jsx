import { useState } from 'react'
import { supabase } from '../supabase'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode]         = useState('login')   // 'login' | 'register'
  const [loading, setLoading]   = useState(false)
  const [message, setMessage]   = useState(null)
  const [error, setError]       = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      // Check if email domain restriction is active for this school
      const { data: schoolData } = await supabase
        .from('schools')
        .select('features')
        .limit(1)
        .single()
      const restrict    = schoolData?.features?.restrict_email_domain !== false
      const allowedDomain = schoolData?.features?.email_domain || 'redboston.edu.co'
      const emailDomain   = email.toLowerCase().split('@')[1] || ''
      if (restrict && emailDomain !== allowedDomain) {
        setError(`Solo se permiten correos institucionales @${allowedDomain}.`)
        setLoading(false)
        return
      }
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('¡Revisa tu correo para confirmar el registro!')
    }
    setLoading(false)
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/cbf-planner/' }
    })
  }

  return (
    <div className="login-bg">
      <div className="login-card">

        {/* Header */}
        <div className="login-header">
          <div className="login-icon">📋</div>
          <h1>CBF Planner</h1>
          <p>Sistema de Planeación Docente</p>
        </div>

        {/* Google */}
        <button className="btn-google" onClick={handleGoogle}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continuar con Google
        </button>

        <div className="login-divider"><span>o con email</span></div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label>Correo institucional</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="docente@colegio.edu.co"
              required
            />
          </div>
          <div className="form-field">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {error   && <div className="alert alert-error">⚠️ {error}</div>}
          {message && <div className="alert alert-success">✅ {message}</div>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '⏳ Procesando...' :
              mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </form>

        {/* Toggle */}
        <p className="login-toggle">
          {mode === 'login' ? (
            <>¿Primera vez? <button onClick={() => setMode('register')}>Crear cuenta</button></>
          ) : (
            <>¿Ya tienes cuenta? <button onClick={() => setMode('login')}>Iniciar sesión</button></>
          )}
        </p>

      </div>
    </div>
  )
}
