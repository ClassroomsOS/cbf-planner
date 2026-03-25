import { useState } from 'react'
import { supabase } from '../supabase'

const DEFAULT_SUBJECTS = [
  'Language Arts','Science','Cosmovisión Bíblica','Biblical Worldview',
  'Matemáticas','Sociales','Inglés','Ética','Ed. Física','Artes',
]

export default function ProfileModal({ teacher, onClose, onSave }) {
  const [fullName,   setFullName]   = useState(teacher.full_name || '')
  const [initials,   setInitials]   = useState(teacher.initials || '')
  const [subjects,   setSubjects]   = useState(teacher.subjects || [])
  const [defClass,   setDefClass]   = useState(teacher.default_class || '')
  const [defSubject, setDefSubject] = useState(teacher.default_subject || '')
  const [defPeriod,  setDefPeriod]  = useState(teacher.default_period || '')
  const [newSub,     setNewSub]     = useState('')
  const [loading,    setLoading]    = useState(false)
  const [saved,      setSaved]      = useState(false)

  // class_subjects: [{grade, section, subjects:[]}]
  const [classSubjects, setClassSubjects] = useState(teacher.class_subjects || [])

  // Derive class labels for defaults dropdown
  const classLabels = classSubjects.map(cs => `${cs.grade} ${cs.section}`)

  // ── Subjects ─────────────────────────────────────────────
  function toggleSubject(sub) {
    setSubjects(prev =>
      prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]
    )
  }

  function addSubject() {
    const v = newSub.trim()
    if (v && !subjects.includes(v)) setSubjects(prev => [...prev, v])
    setNewSub('')
  }

  // ── Class subjects ────────────────────────────────────────
  function toggleSubjectInClass(grade, section, sub) {
    setClassSubjects(prev =>
      prev.map(cs => {
        if (cs.grade !== grade || cs.section !== section) return cs
        const newSubs = cs.subjects.includes(sub)
          ? cs.subjects.filter(s => s !== sub)
          : [...cs.subjects, sub]
        return { ...cs, subjects: newSubs }
      })
    )
  }

  // ── Save ─────────────────────────────────────────────────
  async function handleSave() {
    setLoading(true)
    const updates = {
      full_name:       fullName.trim(),
      initials:        initials.trim().toUpperCase(),
      subjects,
      class_subjects:  classSubjects,
      default_class:   defClass,
      default_subject: defSubject,
      default_period:  defPeriod,
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

  return (
    <div className="prof-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="prof-modal">
        <div className="prof-header">
          <div className="prof-header-icon">👤</div>
          <div>
            <h2>Mi Perfil</h2>
            <p>{teacher.schools?.name}</p>
          </div>
          <button className="prof-close" onClick={onClose}>✕</button>
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

          {/* Materias */}
          <div className="prof-section">
            <div className="prof-section-title">📚 Materias</div>
            <div className="chips-wrap">
              {DEFAULT_SUBJECTS.map(sub => (
                <div key={sub}
                  className={`chip ${subjects.includes(sub) ? 'selected' : ''}`}
                  onClick={() => toggleSubject(sub)}>
                  {sub}
                </div>
              ))}
              {subjects.filter(s => !DEFAULT_SUBJECTS.includes(s)).map(sub => (
                <div key={sub} className="chip selected" onClick={() => toggleSubject(sub)}>
                  {sub} <span style={{ marginLeft: '4px', opacity: .7 }}>✕</span>
                </div>
              ))}
            </div>
            <div className="chip-add-row">
              <input value={newSub} onChange={e => setNewSub(e.target.value)}
                placeholder="Agregar materia…"
                onKeyDown={e => e.key === 'Enter' && addSubject()} />
              <button onClick={addSubject}>+ Agregar</button>
            </div>
          </div>

          {/* Materias por clase */}
          {classSubjects.length > 0 && (
            <div className="prof-section">
              <div className="prof-section-title">🗂️ Materias por clase</div>
              <div className="csa-container">
                {classSubjects.map(cs => (
                  <div key={`${cs.grade}-${cs.section}`} className="csa-row">
                    <div className="csa-label">{cs.grade} {cs.section}</div>
                    <div className="chips-wrap" style={{ flex: 1 }}>
                      {subjects.map(sub => (
                        <div
                          key={sub}
                          className={`chip chip-sm ${cs.subjects.includes(sub) ? 'selected' : ''}`}
                          onClick={() => toggleSubjectInClass(cs.grade, cs.section, sub)}>
                          {sub}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Valores por defecto */}
          <div className="prof-section">
            <div className="prof-section-title">⚙️ Valores por defecto</div>
            <div className="prof-defaults">
              <div className="prof-field">
                <label>Clase predeterminada</label>
                <select value={defClass} onChange={e => setDefClass(e.target.value)}>
                  <option value="">— Sin predeterminado —</option>
                  {classLabels.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="prof-field">
                <label>Materia predeterminada</label>
                <select value={defSubject} onChange={e => setDefSubject(e.target.value)}>
                  <option value="">— Sin predeterminado —</option>
                  {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="prof-field">
                <label>Período actual</label>
                <select value={defPeriod} onChange={e => setDefPeriod(e.target.value)}>
                  {['1.er Período 2026','2.do Período 2026','3.er Período 2026','4.to Período 2026'].map(p =>
                    <option key={p} value={p}>{p}</option>
                  )}
                </select>
              </div>
            </div>
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
