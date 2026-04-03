import { useState } from 'react'
import { supabase } from '../supabase'

export default function ProfileModal({ teacher, onClose, onSave }) {
  const [fullName,   setFullName]   = useState(teacher.full_name || '')
  const [initials,   setInitials]   = useState(teacher.initials || '')
  const [defPeriod,  setDefPeriod]  = useState(teacher.default_period || '1.er Período 2026')
  const [loading,    setLoading]    = useState(false)
  const [saved,      setSaved]      = useState(false)

  // Password change
  const [showPwd,    setShowPwd]    = useState(false)
  const [newPwd,     setNewPwd]     = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdError,   setPwdError]   = useState(null)
  const [pwdSaved,   setPwdSaved]   = useState(false)

  async function handleSave() {
    setLoading(true)
    const updates = {
      full_name:      fullName.trim(),
      initials:       initials.trim().toUpperCase(),
      default_period: defPeriod,
    }
    const { data, error } = await supabase
      .from('teachers')
      .update(updates)
      .eq('id', teacher.id)
      .select('*, schools(*)')
      .single()

    setLoading(false)
    if (!error && data) {
      onSave(data)
      setSaved(true)
      setTimeout(onClose, 900)
    }
  }

  async function handlePasswordChange() {
    setPwdError(null)
    if (newPwd.length < 8) { setPwdError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (newPwd !== confirmPwd) { setPwdError('Las contraseñas no coinciden.'); return }

    const { error } = await supabase.auth.updateUser({ password: newPwd })
    if (error) { setPwdError(error.message); return }

    setPwdSaved(true)
    setNewPwd(''); setConfirmPwd('')
    setTimeout(() => { setPwdSaved(false); setShowPwd(false) }, 2000)
  }

  // Read-only assignment display
  const assignments = teacher.class_subjects || []

  return (
    <div className="prof-overlay open">
      <div className="prof-modal">
        <div className="prof-header">
          <div className="prof-header-icon">👤</div>
          <div>
            <h2>Mi Perfil</h2>
            <p>{teacher.schools?.name}</p>
          </div>
          <button className="prof-close" onClick={onClose} aria-label="Cerrar perfil">✕</button>
        </div>

        <div className="prof-body">

          {/* Datos personales */}
          <div className="prof-section">
            <div className="prof-section-title">📋 Datos personales</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '10px' }}>
              <div className="prof-field">
                <label>Nombre completo</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} />
              </div>
              <div className="prof-field">
                <label>Iniciales</label>
                <input value={initials} onChange={e => setInitials(e.target.value)}
                  maxLength={3}
                  style={{ textTransform: 'uppercase', textAlign: 'center', fontWeight: 700, fontSize: '16px' }} />
              </div>
            </div>
            <div className="prof-field">
              <label>Email</label>
              <input value={teacher.email || ''} disabled style={{ color: '#999' }} />
            </div>
          </div>

          {/* Mis clases (solo lectura — asignadas por admin) */}
          {assignments.length > 0 && (
            <div className="prof-section">
              <div className="prof-section-title">📚 Mis clases asignadas</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {assignments.map((cs, i) =>
                  (cs.subjects || []).map(sub => (
                    <span key={`${i}-${sub}`} style={{
                      fontSize: '11px', fontWeight: 600,
                      background: '#D6E4F0', color: '#1F3864',
                      padding: '3px 10px', borderRadius: '12px',
                    }}>
                      {cs.grade} {cs.section} · {sub}
                    </span>
                  ))
                )}
              </div>
              <div style={{ fontSize: '11px', color: '#aaa', marginTop: '8px', fontStyle: 'italic' }}>
                Las asignaciones las gestiona el coordinador.
              </div>
            </div>
          )}

          {/* Período actual */}
          <div className="prof-section">
            <div className="prof-section-title">⚙️ Preferencias</div>
            <div className="prof-field">
              <label>Período actual</label>
              <select value={defPeriod} onChange={e => setDefPeriod(e.target.value)}>
                {['1.er Período 2026','2.do Período 2026','3.er Período 2026','4.to Período 2026'].map(p =>
                  <option key={p} value={p}>{p}</option>
                )}
              </select>
            </div>
          </div>

          {/* Cambiar contraseña */}
          <div className="prof-section">
            <div className="prof-section-title">🔒 Seguridad</div>
            {!showPwd ? (
              <button className="btn-secondary" onClick={() => setShowPwd(true)}
                style={{ fontSize: '12px' }}>
                🔑 Cambiar contraseña
              </button>
            ) : (
              <div>
                <div className="prof-field">
                  <label>Nueva contraseña</label>
                  <input type="password" value={newPwd}
                    placeholder="Mínimo 8 caracteres"
                    onChange={e => setNewPwd(e.target.value)} />
                </div>
                <div className="prof-field">
                  <label>Confirmar contraseña</label>
                  <input type="password" value={confirmPwd}
                    placeholder="Repite la contraseña"
                    onChange={e => setConfirmPwd(e.target.value)} />
                </div>
                {pwdError && <div className="alert alert-error">{pwdError}</div>}
                {pwdSaved && <div className="alert alert-success">✅ Contraseña actualizada</div>}
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button className="btn-primary btn-save" onClick={handlePasswordChange}>
                    Actualizar
                  </button>
                  <button className="btn-secondary" onClick={() => { setShowPwd(false); setPwdError(null) }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        <div className="prof-footer">
          <div style={{ flex: 1 }} />
          {saved && <span style={{ color: '#9BBB59', fontWeight: 600 }}>✅ Guardado</span>}
          <button className="btn-save-prof" onClick={handleSave} disabled={loading}>
            {loading ? '⏳ Guardando...' : '💾 Guardar perfil'}
          </button>
        </div>
      </div>
    </div>
  )
}
