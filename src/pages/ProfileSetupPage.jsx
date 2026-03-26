import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function ProfileSetupPage({ session, onComplete }) {
  const [schools,  setSchools]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [schoolId, setSchoolId] = useState('')
  const [fullName, setFullName] = useState('')
  const [initials, setInitials] = useState('')

  useEffect(() => {
    supabase.from('schools').select('id, name, short_name')
      .then(({ data }) => setSchools(data || []))
  }, [])

  async function handleSave() {
    if (!schoolId || !fullName.trim()) {
      setError('Completa tu nombre y selecciona el colegio.')
      return
    }
    setLoading(true)
    setError(null)

    const { error: insertError } = await supabase.from('teachers').insert({
      id:        session.user.id,
      school_id: schoolId,
      full_name: fullName.trim(),
      initials:  initials.trim().toUpperCase() ||
                 fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      email:     session.user.email,
      subjects:  [],
      class_subjects: [],
      default_period: '1.er Período 2026',
    })

    if (insertError) { setError(insertError.message); setLoading(false); return }

    const { data } = await supabase
      .from('teachers')
      .select('*, schools(*)')
      .eq('id', session.user.id)
      .single()
    onComplete(data)
    setLoading(false)
  }

  return (
    <div className="setup-bg">
      <div className="setup-card">

        <div className="setup-header">
          <div className="setup-icon">👤</div>
          <h2>Configura tu perfil</h2>
          <p>Solo la primera vez · el coordinador asignará tus clases</p>
        </div>

        <div className="setup-body">
          <div className="form-field">
            <label>Nombre completo</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Ej: María González" />
          </div>
          <div className="form-field">
            <label>Iniciales <span className="field-hint">(para tu avatar)</span></label>
            <input value={initials} onChange={e => setInitials(e.target.value)}
              placeholder="MG" maxLength={3}
              style={{ textTransform: 'uppercase', maxWidth: '80px' }} />
          </div>
          <div className="form-field">
            <label>Colegio</label>
            <select value={schoolId} onChange={e => setSchoolId(e.target.value)}>
              <option value="">— Selecciona tu colegio —</option>
              {schools.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {error && <div className="alert alert-error">⚠️ {error}</div>}

          <div style={{ background: '#f0f4ff', border: '1px solid #c5d5f0', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: '#2E5598', marginTop: '8px' }}>
            ℹ️ Una vez registrado, el coordinador asignará tus clases y materias.
            Mientras tanto podrás explorar la app.
          </div>
        </div>

        <div className="setup-footer">
          <div style={{ flex: 1 }} />
          <button className="btn-primary btn-save"
            disabled={!fullName || !schoolId || loading}
            onClick={handleSave}>
            {loading ? '⏳ Guardando...' : '✅ Entrar'}
          </button>
        </div>
      </div>
    </div>
  )
}
