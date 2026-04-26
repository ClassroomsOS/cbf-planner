import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  no_intervention: { label: 'Sin intervención', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', dot: '#22c55e' },
  monitoring:      { label: 'En seguimiento',   color: '#d97706', bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b' },
  intervention:    { label: 'Intervención activa', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', dot: '#ef4444' },
  closed:          { label: 'Caso cerrado',     color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', dot: '#9ca3af' },
}

const SUPPORT_CFG = {
  standard:  { label: 'Apoyo básico',    color: '#4BACC6', bg: '#e8f7fb' },
  enhanced:  { label: 'Apoyo reforzado', color: '#F79646', bg: '#fff5eb' },
  intensive: { label: 'Apoyo intensivo', color: '#C0504D', bg: '#fff0f0' },
}

const OBS_TYPE_CFG = {
  academic:   { label: 'Académico',  color: '#2E5598', icon: '📚' },
  behavioral: { label: 'Conductual', color: '#C0504D', icon: '⚠️' },
  emotional:  { label: 'Emocional',  color: '#8064A2', icon: '💜' },
  family:     { label: 'Familiar',   color: '#C9A84C', icon: '🏠' },
  health:     { label: 'Salud',      color: '#4BACC6', icon: '🏥' },
  other:      { label: 'Otro',       color: '#888',    icon: '📝' },
}

const FLAG_CATEGORIES = {
  'Cognitivo / Aprendizaje': {
    color: '#2E5598',
    flags: ['Dislexia', 'TDAH', 'Discalculia', 'Disgrafía',
            'Trastorno procesamiento auditivo', 'Altas capacidades',
            'Trastorno del lenguaje', 'Dificultad lectora'],
  },
  'Emocional / Conductual': {
    color: '#C0504D',
    flags: ['Ansiedad', 'Depresión', 'Regulación emocional',
            'Conducta disruptiva', 'Timidez extrema', 'Fobia escolar'],
  },
  'Social': {
    color: '#8064A2',
    flags: ['Riesgo de acoso (víctima)', 'Riesgo de acoso (agresor)',
            'Aislamiento social', 'Dificultades de integración'],
  },
  'Familiar': {
    color: '#C9A84C',
    flags: ['Situación familiar crítica', 'Cambio de hogar / custodia',
            'Duelo reciente', 'Violencia intrafamiliar'],
  },
  'Salud': {
    color: '#4BACC6',
    flags: ['Enfermedad crónica', 'Discapacidad física',
            'Hospitalizaciones frecuentes', 'Medicación regular'],
  },
}

const ACCOMMODATION_PRESETS = {
  'Evaluación': [
    'Tiempo extendido (50% adicional)',
    'Sede separada para evaluaciones',
    'Evaluación oral en lugar de escrita',
    'Fragmentar la evaluación en partes',
    'Leer las instrucciones en voz alta',
    'Uso de calculadora permitido',
    'Texto en letra más grande (fuente 14+)',
  ],
  'En clase': [
    'Ubicar en primera fila, cerca del docente',
    'No llamar en público si no levanta la mano',
    'Instrucciones paso a paso (no múltiples a la vez)',
    'Verificar comprensión de forma individual antes de iniciar',
    'Pausas activas cada 20 minutos',
    'Apoyo visual: esquemas, diagramas, colores',
    'Trabajo en pareja preferencial',
    'Permitir uso de auriculares anti-ruido',
  ],
  'Tareas y trabajos': [
    'Reducir cantidad de ejercicios (50% del total)',
    'Formato alternativo: grabación de voz o presentación oral',
    'Tiempo extendido para entregar trabajos',
    'Tarea diferenciada: menor complejidad',
    'Copiar apuntes si no puede escribir a tiempo',
  ],
  'Comunicación': [
    'Notificar con anticipación cambios de rutina',
    'Comunicación semanal con padres / acudiente',
    'Enviar temas con anticipación al examen',
    'No exponer trabajos sin consentimiento previo',
  ],
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('')
}

const CURRENT_YEAR = new Date().getFullYear()

// ── Avatar ────────────────────────────────────────────────────────────────────
function StudentAvatar({ name, photoUrl, size = 44, status }) {
  const sc = STATUS_CFG[status] || STATUS_CFG.monitoring
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: photoUrl ? 'transparent' : '#e0e6f0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.36, fontWeight: 700, color: '#2E5598',
        overflow: 'hidden', border: `2px solid ${sc.border}`,
      }}>
        {photoUrl
          ? <img src={photoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initials(name)
        }
      </div>
      {/* Status dot */}
      <div style={{
        position: 'absolute', bottom: 1, right: 1,
        width: size * 0.28, height: size * 0.28, borderRadius: '50%',
        background: sc.dot, border: '2px solid #fff',
      }} />
    </div>
  )
}

// ── Perfil Tab ────────────────────────────────────────────────────────────────
function PerfilTab({ student, profile, canEdit, onSave, schoolId }) {
  const fileRef = useRef(null)
  const [form, setForm] = useState({
    status:             profile?.status             || 'monitoring',
    support_level:      profile?.support_level      || 'standard',
    flags:              profile?.flags              || [],
    teacher_notes:      profile?.teacher_notes      || '',
    confidential_notes: profile?.confidential_notes || '',
    photo_url:          profile?.photo_url          || '',
  })
  const [saving,      setSaving]      = useState(false)
  const [customFlag,  setCustomFlag]  = useState('')
  const [uploading,   setUploading]   = useState(false)
  const { showToast } = useToast()

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function toggleFlag(flag) {
    set('flags', form.flags.includes(flag)
      ? form.flags.filter(f => f !== flag)
      : [...form.flags, flag])
  }

  function addCustomFlag() {
    const f = customFlag.trim()
    if (!f || form.flags.includes(f)) return
    set('flags', [...form.flags, f])
    setCustomFlag('')
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      // Compress to canvas 200x200
      const bmp = await createImageBitmap(file)
      const canvas = document.createElement('canvas')
      canvas.width = 200; canvas.height = 200
      const ctx = canvas.getContext('2d')
      const side = Math.min(bmp.width, bmp.height)
      const ox = (bmp.width - side) / 2, oy = (bmp.height - side) / 2
      ctx.drawImage(bmp, ox, oy, side, side, 0, 0, 200, 200)
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85))

      const path = `students/${schoolId}/${student.id}.jpg`
      const { error: upErr } = await supabase.storage
        .from('guide-images')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage.from('guide-images').getPublicUrl(path)
      set('photo_url', publicUrl + '?t=' + Date.now())
    } catch (err) {
      showToast('Error al subir la foto: ' + err.message, 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  const sc = STATUS_CFG[form.status]
  const sl = SUPPORT_CFG[form.support_level]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Status + Support level */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div style={fieldLabel}>Estado del caso</div>
          <select value={form.status} onChange={e => set('status', e.target.value)}
            disabled={!canEdit}
            style={{ ...selectSt, borderColor: sc.border, color: sc.color, background: sc.bg, fontWeight: 700 }}>
            {Object.entries(STATUS_CFG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={fieldLabel}>Nivel de apoyo</div>
          <select value={form.support_level} onChange={e => set('support_level', e.target.value)}
            disabled={!canEdit}
            style={{ ...selectSt, borderColor: sl.color + '60', color: sl.color, background: sl.bg, fontWeight: 700 }}>
            {Object.entries(SUPPORT_CFG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Photo upload */}
      {canEdit && (
        <div>
          <div style={fieldLabel}>Foto del estudiante</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <StudentAvatar name={student.name} photoUrl={form.photo_url} size={64} status={form.status} />
            <div>
              <button type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{ padding: '7px 14px', border: '1.5px solid #d0d8e8', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#555', fontWeight: 600 }}>
                {uploading ? 'Subiendo...' : '📷 Cambiar foto'}
              </button>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>JPG o PNG · se recorta a 200×200</div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
            </div>
          </div>
        </div>
      )}

      {/* Flags */}
      <div>
        <div style={fieldLabel}>Factores de riesgo / necesidades identificadas</div>
        {Object.entries(FLAG_CATEGORIES).map(([cat, { color, flags }]) => (
          <div key={cat} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5 }}>
              {cat}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {flags.map(flag => {
                const selected = form.flags.includes(flag)
                return (
                  <button key={flag} type="button"
                    onClick={() => canEdit && toggleFlag(flag)}
                    style={{
                      padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: canEdit ? 'pointer' : 'default',
                      border: selected ? `2px solid ${color}` : '2px solid #e0e6f0',
                      background: selected ? color + '18' : '#fff',
                      color: selected ? color : '#888',
                    }}>
                    {selected ? '✓ ' : ''}{flag}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {/* Custom flag */}
        {canEdit && (
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input
              value={customFlag}
              onChange={e => setCustomFlag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomFlag()}
              placeholder="Agregar factor personalizado..."
              style={{ flex: 1, padding: '6px 10px', border: '1.5px dashed #d0d8e8', borderRadius: 8, fontSize: 13 }} />
            <button type="button" onClick={addCustomFlag}
              style={{ padding: '6px 14px', border: 'none', borderRadius: 8, background: '#2E5598', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
              + Agregar
            </button>
          </div>
        )}

        {/* Custom flags display */}
        {form.flags.filter(f => !Object.values(FLAG_CATEGORIES).flatMap(c => c.flags).includes(f)).length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5 }}>
              Personalizados
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {form.flags.filter(f => !Object.values(FLAG_CATEGORIES).flatMap(c => c.flags).includes(f)).map(flag => (
                <button key={flag} type="button"
                  onClick={() => canEdit && toggleFlag(flag)}
                  style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: canEdit ? 'pointer' : 'default', border: '2px solid #888', background: '#88881A', color: '#fff' }}>
                  ✓ {flag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Teacher notes */}
      <div>
        <div style={fieldLabel}>
          Notas para el docente
          <span style={{ fontWeight: 400, color: '#aaa', fontSize: 11, marginLeft: 6 }}>· visible a todos los docentes de la institución</span>
        </div>
        <textarea
          value={form.teacher_notes}
          onChange={e => set('teacher_notes', e.target.value)}
          disabled={!canEdit}
          rows={4}
          placeholder="Describe qué debe saber el docente sobre este estudiante para el aula. Esta nota será visible a todos los profesores."
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 13, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, background: canEdit ? '#fff' : '#f9fafb' }} />
      </div>

      {/* Confidential notes */}
      <div>
        <div style={fieldLabel}>
          Notas confidenciales
          <span style={{ fontWeight: 400, color: '#C0504D', fontSize: 11, marginLeft: 6 }}>· solo psicopedagoga, rector y coordinador</span>
        </div>
        <textarea
          value={form.confidential_notes}
          onChange={e => set('confidential_notes', e.target.value)}
          disabled={!canEdit}
          rows={4}
          placeholder="Diagnósticos, situación familiar, información sensible del historial del estudiante..."
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, background: canEdit ? '#fff' : '#f9fafb' }} />
      </div>

      {canEdit && (
        <button onClick={handleSave} disabled={saving}
          style={{ alignSelf: 'flex-end', padding: '10px 28px', border: 'none', borderRadius: 8, background: saving ? '#aaa' : '#1A6B3A', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          {saving ? 'Guardando...' : 'Guardar perfil'}
        </button>
      )}
    </div>
  )
}

// ── Seguimiento Tab ───────────────────────────────────────────────────────────
function SeguimientoTab({ studentId, observations, canEdit, onAdd, onDelete }) {
  const emptyForm = { obs_date: new Date().toISOString().slice(0, 10), obs_type: 'academic', description: '', action_taken: '', next_steps: '', next_followup: '' }
  const [form,    setForm]    = useState(emptyForm)
  const [saving,  setSaving]  = useState(false)
  const [showForm, setShowForm] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  const handleAdd = async () => {
    if (!form.description.trim()) return
    setSaving(true)
    await onAdd(form)
    setForm(emptyForm)
    setShowForm(false)
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {canEdit && (
        <button type="button" onClick={() => setShowForm(v => !v)}
          style={{ alignSelf: 'flex-start', padding: '8px 18px', border: 'none', borderRadius: 8, background: showForm ? '#f0f2f8' : '#2E5598', color: showForm ? '#555' : '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          {showForm ? '✕ Cancelar' : '+ Nueva observación'}
        </button>
      )}

      {/* Add form */}
      {showForm && (
        <div style={{ padding: 16, background: '#f7f9ff', borderRadius: 10, border: '1px solid #d0d8e8', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={fieldLabel}>Fecha</div>
              <input type="date" value={form.obs_date} onChange={e => set('obs_date', e.target.value)}
                style={inputSt} />
            </div>
            <div>
              <div style={fieldLabel}>Tipo</div>
              <select value={form.obs_type} onChange={e => set('obs_type', e.target.value)} style={selectSt}>
                {Object.entries(OBS_TYPE_CFG).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <div style={fieldLabel}>Descripción de la observación *</div>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={3} placeholder="¿Qué se observó? ¿Cuál fue la situación?"
              style={{ ...inputSt, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <div>
            <div style={fieldLabel}>Acción tomada</div>
            <textarea value={form.action_taken} onChange={e => set('action_taken', e.target.value)}
              rows={2} placeholder="¿Qué se hizo al respecto?"
              style={{ ...inputSt, resize: 'vertical', lineHeight: 1.6 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={fieldLabel}>Próximos pasos</div>
              <textarea value={form.next_steps} onChange={e => set('next_steps', e.target.value)}
                rows={2} placeholder="¿Qué sigue?"
                style={{ ...inputSt, resize: 'vertical', lineHeight: 1.6 }} />
            </div>
            <div>
              <div style={fieldLabel}>Próximo seguimiento</div>
              <input type="date" value={form.next_followup} onChange={e => set('next_followup', e.target.value)}
                style={inputSt} />
            </div>
          </div>
          <button onClick={handleAdd} disabled={saving || !form.description.trim()}
            style={{ alignSelf: 'flex-end', padding: '9px 24px', border: 'none', borderRadius: 8, background: saving ? '#aaa' : '#2E5598', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            {saving ? 'Guardando...' : 'Registrar observación'}
          </button>
        </div>
      )}

      {/* Timeline */}
      {observations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#ccc' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
          <div style={{ fontSize: 13, color: '#aaa' }}>No hay observaciones registradas aún</div>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Timeline line */}
          <div style={{ position: 'absolute', left: 19, top: 0, bottom: 0, width: 2, background: '#e0e6f0' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {observations.map(obs => {
              const tc = OBS_TYPE_CFG[obs.obs_type] || OBS_TYPE_CFG.other
              return (
                <div key={obs.id} style={{ display: 'flex', gap: 14 }}>
                  {/* Icon */}
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                    background: tc.color + '18', border: `2px solid ${tc.color}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                    zIndex: 1, position: 'relative',
                  }}>
                    {tc.icon}
                  </div>
                  {/* Card */}
                  <div style={{ flex: 1, background: '#fff', border: `1px solid ${tc.color}30`, borderRadius: 10, padding: '12px 14px', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: tc.color, background: tc.color + '15', borderRadius: 4, padding: '2px 7px' }}>
                          {tc.label}
                        </span>
                        <span style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>
                          {new Date(obs.obs_date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        {obs.next_followup && (
                          <span style={{ fontSize: 11, color: '#4BACC6', background: '#e8f7fb', borderRadius: 4, padding: '2px 7px', fontWeight: 600 }}>
                            📅 Próximo: {new Date(obs.next_followup + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                      {canEdit && (
                        <button type="button" onClick={() => onDelete(obs.id)}
                          style={{ width: 22, height: 22, border: '1px solid #ffcdd2', borderRadius: 4, background: '#fff5f5', cursor: 'pointer', fontSize: 10, color: '#c33', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          ✕
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: '#1a2340', lineHeight: 1.6, marginBottom: obs.action_taken || obs.next_steps ? 8 : 0 }}>
                      {obs.description}
                    </div>
                    {obs.action_taken && (
                      <div style={{ fontSize: 12, color: '#555', marginTop: 6, padding: '6px 10px', background: '#f7f9ff', borderRadius: 6, borderLeft: `3px solid ${tc.color}` }}>
                        <strong>Acción:</strong> {obs.action_taken}
                      </div>
                    )}
                    {obs.next_steps && (
                      <div style={{ fontSize: 12, color: '#555', marginTop: 6, padding: '6px 10px', background: '#fffbeb', borderRadius: 6, borderLeft: '3px solid #f59e0b' }}>
                        <strong>Próximos pasos:</strong> {obs.next_steps}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Plan Docente Tab ──────────────────────────────────────────────────────────
function PlanDocenteTab({ student, plans, canEdit, onSavePlan, onArchivePlan }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    subject: '',
    period: '',
    accommodations: [],
  })
  const [customText, setCustomText] = useState('')
  const [saving, setSaving] = useState(false)

  function toggleAccommodation(category, text) {
    const existing = form.accommodations.find(a => a.text === text)
    if (existing) {
      setForm(f => ({ ...f, accommodations: f.accommodations.filter(a => a.text !== text) }))
    } else {
      setForm(f => ({ ...f, accommodations: [...f.accommodations, { category, text, is_predefined: true }] }))
    }
  }

  function addCustom() {
    const t = customText.trim()
    if (!t) return
    setForm(f => ({ ...f, accommodations: [...f.accommodations, { category: 'Personalizado', text: t, is_predefined: false }] }))
    setCustomText('')
  }

  const handleSave = async () => {
    if (form.accommodations.length === 0) return
    setSaving(true)
    await onSavePlan(form)
    setForm({ subject: '', period: '', accommodations: [] })
    setShowForm(false)
    setSaving(false)
  }

  const activePlans = plans.filter(p => p.status === 'active')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {canEdit && (
        <button type="button" onClick={() => setShowForm(v => !v)}
          style={{ alignSelf: 'flex-start', padding: '8px 18px', border: 'none', borderRadius: 8, background: showForm ? '#f0f2f8' : '#1A6B3A', color: showForm ? '#555' : '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          {showForm ? '✕ Cancelar' : '+ Nuevo plan de acomodaciones'}
        </button>
      )}

      {/* Plan form */}
      {showForm && (
        <div style={{ padding: 16, background: '#f7f9ff', borderRadius: 10, border: '1px solid #d0d8e8', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={fieldLabel}>Materia (opcional — dejar vacío = todas)</div>
              <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="ej. Language Arts"
                style={inputSt} />
            </div>
            <div>
              <div style={fieldLabel}>Período (opcional)</div>
              <select value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} style={selectSt}>
                <option value="">Todo el año</option>
                {[1, 2, 3, 4].map(p => <option key={p} value={p}>Período {p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div style={fieldLabel}>Acomodaciones a aplicar</div>
            {Object.entries(ACCOMMODATION_PRESETS).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#2E5598', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 }}>{cat}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {items.map(item => {
                    const selected = form.accommodations.some(a => a.text === item)
                    return (
                      <label key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', padding: '5px 8px', borderRadius: 6, background: selected ? '#eef3ff' : 'transparent' }}>
                        <input type="checkbox" checked={selected} onChange={() => toggleAccommodation(cat, item)}
                          style={{ marginTop: 2, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: selected ? '#2E5598' : '#555', fontWeight: selected ? 600 : 400 }}>{item}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
            {/* Custom accommodation */}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input value={customText} onChange={e => setCustomText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustom()}
                placeholder="Acomodación personalizada..."
                style={{ ...inputSt, flex: 1 }} />
              <button type="button" onClick={addCustom}
                style={{ padding: '7px 14px', border: 'none', borderRadius: 8, background: '#2E5598', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                + Agregar
              </button>
            </div>
          </div>

          {form.accommodations.length > 0 && (
            <div style={{ padding: '10px 14px', background: '#fff', border: '1px solid #d0d8e8', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 8 }}>Vista previa — {form.accommodations.length} acomodación(es)</div>
              {form.accommodations.map((a, i) => (
                <div key={i} style={{ fontSize: 12, color: '#1a2340', padding: '2px 0', display: 'flex', gap: 6 }}>
                  <span style={{ color: '#1A6B3A', flexShrink: 0 }}>✓</span> {a.text}
                </div>
              ))}
            </div>
          )}

          <button onClick={handleSave} disabled={saving || form.accommodations.length === 0}
            style={{ alignSelf: 'flex-end', padding: '9px 24px', border: 'none', borderRadius: 8, background: saving ? '#aaa' : '#1A6B3A', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            {saving ? 'Guardando...' : 'Crear plan'}
          </button>
        </div>
      )}

      {/* Active plans */}
      {activePlans.length === 0 && !showForm ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#ccc' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
          <div style={{ fontSize: 13, color: '#aaa' }}>No hay planes de acomodación activos</div>
        </div>
      ) : activePlans.map(plan => (
        <div key={plan.id} style={{ border: '1px solid #b8e4cc', borderRadius: 12, overflow: 'hidden' }}>
          {/* Plan header */}
          <div style={{ padding: '12px 16px', background: '#edfaf3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1A6B3A' }}>
                Plan de acomodaciones {plan.subject ? `· ${plan.subject}` : '(todas las materias)'}
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                {plan.period ? `Período ${plan.period}` : 'Todo el año'} · {plan.academic_year}
                {' · '}{plan.accommodations?.length || 0} acomodaciones
              </div>
            </div>
            {canEdit && (
              <button type="button" onClick={() => onArchivePlan(plan.id)}
                title="Archivar plan"
                style={{ padding: '5px 12px', border: '1px solid #aaa', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#666' }}>
                Archivar
              </button>
            )}
          </div>

          {/* Accommodation list — "what the teacher sees" */}
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Group by category */}
            {Object.entries(
              (plan.accommodations || []).reduce((acc, a) => {
                const cat = a.category || 'General'
                if (!acc[cat]) acc[cat] = []
                acc[cat].push(a)
                return acc
              }, {})
            ).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5 }}>{cat}</div>
                {items.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '3px 0' }}>
                    <span style={{ color: '#1A6B3A', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: 13, color: '#1a2340', lineHeight: 1.5 }}>{a.text}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Student Detail Panel ──────────────────────────────────────────────────────
function StudentDetail({ student, canEdit, teacher }) {
  const { showToast } = useToast()
  const [activeTab,    setActiveTab]    = useState('perfil')
  const [profile,      setProfile]      = useState(null)
  const [observations, setObservations] = useState([])
  const [plans,        setPlans]        = useState([])
  const [loading,      setLoading]      = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [profRes, obsRes, planRes] = await Promise.all([
      supabase.from('student_psychosocial_profiles').select('*').eq('student_id', student.id).maybeSingle(),
      supabase.from('student_observations').select('*').eq('student_id', student.id).order('obs_date', { ascending: false }),
      supabase.from('student_accommodation_plans').select('*').eq('student_id', student.id).eq('academic_year', CURRENT_YEAR).order('created_at', { ascending: false }),
    ])
    setProfile(profRes.data || null)
    setObservations(obsRes.data || [])
    setPlans(planRes.data || [])
    setLoading(false)
  }, [student.id])

  useEffect(() => { load() }, [load])

  const sc = STATUS_CFG[profile?.status || 'monitoring']
  const sl = SUPPORT_CFG[profile?.support_level || 'standard']

  const handleSaveProfile = async (form) => {
    const payload = {
      student_id:         student.id,
      school_id:          teacher.school_id,
      created_by:         teacher.id,
      ...form,
    }
    const { error } = profile
      ? await supabase.from('student_psychosocial_profiles').update(payload).eq('student_id', student.id)
      : await supabase.from('student_psychosocial_profiles').upsert(payload, { onConflict: 'student_id' })
    if (error) { showToast(error.message, 'error'); return }
    showToast('Perfil guardado', 'success')
    load()
  }

  const handleAddObs = async (form) => {
    const { error } = await supabase.from('student_observations').insert({
      school_id:  teacher.school_id,
      student_id: student.id,
      created_by: teacher.id,
      ...form,
      next_followup: form.next_followup || null,
    })
    if (error) { showToast(error.message, 'error'); return }
    showToast('Observación registrada', 'success')
    load()
  }

  const handleDeleteObs = async (id) => {
    if (!confirm('¿Eliminar esta observación?')) return
    const { error } = await supabase.from('student_observations').delete().eq('id', id)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Observación eliminada', 'success')
    load()
  }

  const handleSavePlan = async (form) => {
    const { error } = await supabase.from('student_accommodation_plans').insert({
      school_id:    teacher.school_id,
      student_id:   student.id,
      created_by:   teacher.id,
      academic_year: CURRENT_YEAR,
      subject:      form.subject || null,
      period:       form.period  || null,
      accommodations: form.accommodations,
      status:       'active',
    })
    if (error) { showToast(error.message, 'error'); return }
    showToast('Plan creado', 'success')
    load()
  }

  const handleArchivePlan = async (id) => {
    const { error } = await supabase.from('student_accommodation_plans').update({ status: 'archived' }).eq('id', id)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Plan archivado', 'success')
    load()
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 14 }}>
      Cargando...
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Student header */}
      <div style={{ padding: '20px 24px', background: '#fff', borderBottom: '1px solid #e0e6f0' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <StudentAvatar name={student.name} photoUrl={profile?.photo_url} size={64} status={profile?.status || 'monitoring'} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1a2340' }}>{student.name}</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
              {student.grade} · Cód. {student.student_code}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: sc.color, background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 20, padding: '3px 10px' }}>
                {sc.label}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: sl.color, background: sl.bg, borderRadius: 20, padding: '3px 10px', border: `1px solid ${sl.color}40` }}>
                {sl.label}
              </span>
              {profile?.flags?.slice(0, 3).map(f => (
                <span key={f} style={{ fontSize: 11, color: '#555', background: '#f0f2f8', borderRadius: 20, padding: '3px 10px' }}>{f}</span>
              ))}
              {(profile?.flags?.length || 0) > 3 && (
                <span style={{ fontSize: 11, color: '#888', background: '#f0f2f8', borderRadius: 20, padding: '3px 10px' }}>+{profile.flags.length - 3} más</span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginTop: 16, borderBottom: '2px solid #e0e6f0' }}>
          {[
            { id: 'perfil',      label: '🧠 Perfil' },
            { id: 'seguimiento', label: `📋 Seguimiento (${observations.length})` },
            { id: 'plan',        label: `📄 Plan Docente (${plans.filter(p => p.status === 'active').length})` },
          ].map(tab => (
            <button key={tab.id} type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
                fontSize: 13, fontWeight: activeTab === tab.id ? 700 : 400,
                color: activeTab === tab.id ? '#2E5598' : '#888',
                borderBottom: activeTab === tab.id ? '2px solid #2E5598' : '2px solid transparent',
                marginBottom: -2,
              }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {activeTab === 'perfil' && (
          <PerfilTab
            student={student}
            profile={profile}
            canEdit={canEdit}
            onSave={handleSaveProfile}
            schoolId={teacher.school_id}
          />
        )}
        {activeTab === 'seguimiento' && (
          <SeguimientoTab
            studentId={student.id}
            observations={observations}
            canEdit={canEdit}
            onAdd={handleAddObs}
            onDelete={handleDeleteObs}
          />
        )}
        {activeTab === 'plan' && (
          <PlanDocenteTab
            student={student}
            plans={plans}
            canEdit={canEdit}
            onSavePlan={handleSavePlan}
            onArchivePlan={handleArchivePlan}
          />
        )}
      </div>
    </div>
  )
}

// ── Shared micro-styles ───────────────────────────────────────────────────────
const fieldLabel = { fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.3px' }
const selectSt   = { width: '100%', padding: '8px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 13, background: '#fff', boxSizing: 'border-box' }
const inputSt    = { width: '100%', padding: '8px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' }

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PsicosocialPage({ teacher }) {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const canEdit = ['psicopedagoga', 'admin', 'superadmin', 'rector'].includes(teacher.role)

  const [students,      setStudents]      = useState([])
  const [selected,      setSelected]      = useState(null)
  const [filterGrade,   setFilterGrade]   = useState('')
  const [filterStatus,  setFilterStatus]  = useState('')
  const [profilesMap,   setProfilesMap]   = useState({})  // student_id → profile stub
  const [loadingList,   setLoadingList]   = useState(true)
  const [searchText,    setSearchText]    = useState('')

  // Load all students in the school
  const loadStudents = useCallback(async () => {
    setLoadingList(true)
    const { data, error } = await supabase
      .from('school_students')
      .select('id, name, email, grade, section, student_code')
      .eq('school_id', teacher.school_id)
      .order('grade').order('name')
    if (error) { showToast(error.message, 'error'); setLoadingList(false); return }
    setStudents(data || [])

    // Load profile stubs (status + flags + photo) for all students
    const { data: profiles } = await supabase
      .from('student_psychosocial_profiles')
      .select('student_id, status, support_level, flags, photo_url')
      .eq('school_id', teacher.school_id)
    const map = {}
    ;(profiles || []).forEach(p => { map[p.student_id] = p })
    setProfilesMap(map)
    setLoadingList(false)
  }, [teacher.school_id])  // eslint-disable-line

  useEffect(() => { loadStudents() }, [loadStudents])

  // Refresh profiles map after save
  const refreshProfiles = useCallback(async () => {
    const { data } = await supabase
      .from('student_psychosocial_profiles')
      .select('student_id, status, support_level, flags, photo_url')
      .eq('school_id', teacher.school_id)
    const map = {}
    ;(data || []).forEach(p => { map[p.student_id] = p })
    setProfilesMap(map)
  }, [teacher.school_id])

  const grades = [...new Set(students.map(s => s.grade))].sort()

  const filtered = students.filter(s => {
    if (filterGrade  && s.grade !== filterGrade) return false
    if (filterStatus) {
      const p = profilesMap[s.id]
      const pStatus = p?.status || 'no_profile'
      if (filterStatus === 'no_profile' && p) return false
      if (filterStatus !== 'no_profile' && pStatus !== filterStatus) return false
    }
    if (searchText) {
      return s.name.toLowerCase().includes(searchText.toLowerCase()) ||
             s.student_code?.toLowerCase().includes(searchText.toLowerCase())
    }
    return true
  })

  // Counts for filter badges
  const counts = {
    no_profile:      students.filter(s => !profilesMap[s.id]).length,
    no_intervention: students.filter(s => profilesMap[s.id]?.status === 'no_intervention').length,
    monitoring:      students.filter(s => profilesMap[s.id]?.status === 'monitoring').length,
    intervention:    students.filter(s => profilesMap[s.id]?.status === 'intervention').length,
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f4f6fb', overflow: 'hidden' }}>

      {/* ── LEFT — Student list ── */}
      <div style={{ width: 300, minWidth: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', background: '#fff', borderRight: '1px solid #e0e6f0' }}>

        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e0e6f0' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1F3864', marginBottom: 10 }}>
            🧠 Área Psicosocial
          </div>
          <input
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Buscar estudiante..."
            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 13 }} />
        </div>

        {/* Filters */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #e0e6f0', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)}
            style={{ padding: '6px 10px', border: '1px solid #d0d8e8', borderRadius: 7, fontSize: 12 }}>
            <option value="">Todos los grados</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[
              { key: '',              label: 'Todos',   color: '#888',    bg: '#f0f2f8' },
              { key: 'intervention',  label: `🔴 ${counts.intervention}`,  color: STATUS_CFG.intervention.color,  bg: STATUS_CFG.intervention.bg  },
              { key: 'monitoring',    label: `🟡 ${counts.monitoring}`,    color: STATUS_CFG.monitoring.color,    bg: STATUS_CFG.monitoring.bg    },
              { key: 'no_profile',    label: `⬜ ${counts.no_profile}`,    color: '#888',    bg: '#f9fafb' },
            ].map(f => (
              <button key={f.key} type="button"
                onClick={() => setFilterStatus(f.key)}
                style={{
                  padding: '3px 9px', borderRadius: 12, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: filterStatus === f.key ? `2px solid ${f.color}` : '2px solid #e0e6f0',
                  background: filterStatus === f.key ? f.bg : '#fff',
                  color: filterStatus === f.key ? f.color : '#888',
                }}>
                {f.label || 'Todos'}
              </button>
            ))}
          </div>
        </div>

        {/* Student list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingList ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#aaa', fontSize: 13 }}>Cargando...</div>
          ) : students.length === 0 ? (
            <div style={{ margin: 16, padding: '18px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10 }}>
              <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 10 }}>👩‍🎓</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 6, textAlign: 'center' }}>
                No hay estudiantes en el roster
              </div>
              <div style={{ fontSize: 12, color: '#b45309', lineHeight: 1.6, marginBottom: 14, textAlign: 'center' }}>
                Primero debes registrar los estudiantes del colegio en "Mis Estudiantes" para poder crear perfiles psicosociales.
              </div>
              <button type="button"
                onClick={() => navigate('/students')}
                style={{ display: 'block', width: '100%', padding: '9px 0', border: 'none', borderRadius: 8, background: '#2E5598', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Ir a Mis Estudiantes →
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#aaa', fontSize: 13 }}>Sin resultados para este filtro</div>
          ) : filtered.map(s => {
            const p = profilesMap[s.id]
            const sc = STATUS_CFG[p?.status || 'monitoring']
            const isSelected = selected?.id === s.id
            return (
              <div key={s.id}
                onClick={() => { setSelected(s); refreshProfiles() }}
                style={{
                  padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center',
                  cursor: 'pointer', transition: 'background .1s',
                  background: isSelected ? '#eef3ff' : 'transparent',
                  borderLeft: isSelected ? '3px solid #2E5598' : '3px solid transparent',
                  borderBottom: '1px solid #f0f3fa',
                }}>
                <StudentAvatar name={s.name} photoUrl={p?.photo_url} size={38} status={p?.status || 'monitoring'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 600, color: '#1a2340', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>{s.grade}</div>
                  {p ? (
                    <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: sc.color, background: sc.bg, borderRadius: 4, padding: '1px 5px' }}>
                        {sc.label}
                      </span>
                      {p.flags?.slice(0, 2).map(f => (
                        <span key={f} style={{ fontSize: 9, color: '#555', background: '#f0f2f8', borderRadius: 4, padding: '1px 5px' }}>{f}</span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 9, color: '#ccc', marginTop: 3, fontStyle: 'italic' }}>Sin perfil</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer stats */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid #e0e6f0', fontSize: 11, color: '#aaa', display: 'flex', justifyContent: 'space-between' }}>
          <span>{filtered.length} estudiante{filtered.length !== 1 ? 's' : ''}</span>
          <span>{Object.keys(profilesMap).length} con perfil</span>
        </div>
      </div>

      {/* ── RIGHT — Detail panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🧠</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#aaa', marginBottom: 8 }}>Selecciona un estudiante</div>
            <div style={{ fontSize: 13, color: '#ccc', textAlign: 'center', maxWidth: 300 }}>
              Haz clic en un estudiante de la lista para ver su perfil psicosocial, historial de seguimiento y plan de acomodaciones.
            </div>
            {!canEdit && (
              <div style={{ marginTop: 16, padding: '8px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
                Vista de lectura — solo la psicopedagoga puede editar perfiles
              </div>
            )}
          </div>
        ) : (
          <StudentDetail
            key={selected.id}
            student={selected}
            canEdit={canEdit}
            teacher={teacher}
          />
        )}
      </div>
    </div>
  )
}
