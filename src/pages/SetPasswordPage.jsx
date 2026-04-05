import { useState } from 'react'
import { supabase } from '../supabase'

export default function SetPasswordPage({ onDone }) {
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [success,   setSuccess]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess(true)
    setTimeout(() => onDone(), 2000)
  }

  return (
    <div className="login-bg">
      <div className="login-card">

        <div className="login-header">
          <div className="login-icon">🔑</div>
          <h1>Establece tu contraseña</h1>
          <p>Elige una contraseña para acceder a CBF Planner</p>
        </div>

        {success ? (
          <div className="alert alert-success" style={{ textAlign: 'center', padding: '20px' }}>
            ✅ ¡Contraseña establecida! Ingresando al sistema…
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label>Nueva contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                autoFocus
              />
            </div>
            <div className="form-field">
              <label>Confirmar contraseña</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repite la contraseña"
                required
              />
            </div>

            {error && <div className="alert alert-error">⚠️ {error}</div>}

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? '⏳ Guardando…' : '🔐 Establecer contraseña'}
            </button>
          </form>
        )}

      </div>
    </div>
  )
}
