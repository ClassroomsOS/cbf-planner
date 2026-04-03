import { useState, useEffect } from 'react'
import { z } from 'zod'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'

// Validation schema
const profileSchema = z.object({
  fullName: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .trim()
    .refine(val => val.split(' ').length >= 2, 'Ingresa tu nombre completo (nombre y apellido)'),
  initials: z.string()
    .max(3, 'Las iniciales no pueden exceder 3 caracteres')
    .regex(/^[A-Za-z]*$/, 'Las iniciales solo pueden contener letras')
    .optional(),
  schoolId: z.string()
    .uuid('Debes seleccionar un colegio válido'),
})

export default function ProfileSetupPage({ session, onComplete }) {
  const { showToast } = useToast()
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
    setError(null)

    // Validate input
    const validation = profileSchema.safeParse({
      fullName: fullName.trim(),
      initials: initials.trim(),
      schoolId,
    })

    if (!validation.success) {
      const firstError = validation.error.errors[0].message
      setError(firstError)
      showToast(firstError, 'error')
      return
    }

    setLoading(true)

    const { error: insertError } = await supabase.from('teachers').insert({
      id:        session.user.id,
      school_id: schoolId,
      full_name: fullName.trim(),
      initials:  initials.trim().toUpperCase() ||
                 fullName.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      email:     session.user.email,
      subjects:  [],
      class_subjects: [],
      default_period: '1.er Período 2026',
      status:    'pending',
      role:      'teacher',
    })

    if (insertError) {
      setError(insertError.message)
      showToast('Error al crear el perfil: ' + insertError.message, 'error')
      setLoading(false)
      return
    }

    const { data, error: fetchError } = await supabase
      .from('teachers')
      .select('*, schools(*)')
      .eq('id', session.user.id)
      .single()

    if (fetchError) {
      setError(fetchError.message)
      showToast('Error al cargar el perfil: ' + fetchError.message, 'error')
      setLoading(false)
      return
    }

    showToast('Perfil creado exitosamente. Esperando aprobación del coordinador.', 'success', 5000)
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

          <div style={{ background: '#fff9f0', border: '1px solid #F79646', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: '#8a4f00', marginTop: '8px' }}>
            ⏳ Tu cuenta quedará pendiente de aprobación por el coordinador antes de poder acceder.
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
