import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const GRADE_LEVELS = [
  { label: 'Elementary', grades: ['1.°','2.°','3.°','4.°','5.°'] },
  { label: 'Middle School', grades: ['6.°','7.°','8.°'] },
  { label: 'High School', grades: ['9.°','10.°','11.°'] },
]

const DEFAULT_SUBJECTS = [
  'Language Arts','Science','Cosmovisión Bíblica','Biblical Worldview',
  'Matemáticas','Sociales','Inglés','Ética','Ed. Física','Artes',
]

export default function ProfileSetupPage({ session, onComplete }) {
  const [step, setStep]           = useState(1)
  const [schools, setSchools]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)

  // Form state
  const [schoolId, setSchoolId]   = useState('')
  const [fullName, setFullName]   = useState('')
  const [initials, setInitials]   = useState('')
  const [subjects, setSubjects]   = useState(['Language Arts'])
  const [newSubject, setNewSubject] = useState('')
  const [sections, setSections]   = useState([])  // from selected school
  const [myClasses, setMyClasses] = useState(new Set()) // "8.°|Blue"
  const [defClass, setDefClass]   = useState('')
  const [defSubject, setDefSubject] = useState('')
  const [defPeriod, setDefPeriod] = useState('1.er Período 2026')

  useEffect(() => {
    supabase.from('schools').select('id, name, short_name, sections')
      .then(({ data }) => setSchools(data || []))
  }, [])

  useEffect(() => {
    const school = schools.find(s => s.id === schoolId)
    setSections(school?.sections || [])
    setMyClasses(new Set())
  }, [schoolId])

  function toggleSubject(sub) {
    setSubjects(prev =>
      prev.includes(sub) ? prev.filter(s => s !== sub) : [...prev, sub]
    )
  }

  function addSubject() {
    const v = newSubject.trim()
    if (v && !subjects.includes(v)) setSubjects(prev => [...prev, v])
    setNewSubject('')
  }

  function toggleClass(grade, section) {
    const key = `${grade}|${section}`
    setMyClasses(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function getMyClassLabels() {
    return [...myClasses].map(k => {
      const [g, s] = k.split('|')
      return `${g} ${s}`
    })
  }

  async function handleSave() {
    if (!schoolId || !fullName.trim()) {
      setError('Completa el nombre y el colegio.')
      return
    }
    setLoading(true)
    setError(null)

    const classLabels = getMyClassLabels()
    const { error } = await supabase.from('teachers').insert({
      id:              session.user.id,
      school_id:       schoolId,
      full_name:       fullName.trim(),
      initials:        initials.trim().toUpperCase() ||
                       fullName.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase(),
      email:           session.user.email,
      subjects,
      my_classes:      classLabels,
      default_class:   defClass || classLabels[0] || '',
      default_subject: defSubject || subjects[0] || '',
      default_period:  defPeriod,
    })

    if (error) { setError(error.message); setLoading(false); return }

    // Reload teacher
    const { data } = await supabase
      .from('teachers')
      .select('*, schools(*)')
      .eq('id', session.user.id)
      .single()
    onComplete(data)
    setLoading(false)
  }

  // ── Render steps ─────────────────────────────────────────
  return (
    <div className="setup-bg">
      <div className="setup-card">

        <div className="setup-header">
          <div className="setup-icon">👤</div>
          <h2>Configura tu perfil</h2>
          <p>Solo la primera vez · paso {step} de 3</p>
        </div>

        <div className="setup-steps">
          {[1,2,3].map(n => (
            <div key={n} className={`setup-step-dot ${step >= n ? 'done' : ''}`}>{n}</div>
          ))}
        </div>

        {/* ── Step 1: Personal info + school ── */}
        {step === 1 && (
          <div className="setup-body">
            <div className="form-field">
              <label>Nombre completo</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Ej: Edoardo Bracuto" />
            </div>
            <div className="form-field">
              <label>Iniciales <span className="field-hint">(para tu avatar)</span></label>
              <input value={initials} onChange={e => setInitials(e.target.value)}
                placeholder="EB" maxLength={3}
                style={{textTransform:'uppercase',maxWidth:'80px'}} />
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
          </div>
        )}

        {/* ── Step 2: Subjects + classes ── */}
        {step === 2 && (
          <div className="setup-body">
            <div className="form-section-title">📚 Materias que dictas</div>
            <div className="chips-wrap">
              {DEFAULT_SUBJECTS.map(sub => (
                <div key={sub}
                  className={`chip ${subjects.includes(sub) ? 'selected' : ''}`}
                  onClick={() => toggleSubject(sub)}>
                  {sub}
                </div>
              ))}
            </div>
            <div className="chip-add-row">
              <input value={newSubject} onChange={e => setNewSubject(e.target.value)}
                placeholder="Agregar otra…"
                onKeyDown={e => e.key === 'Enter' && addSubject()} />
              <button onClick={addSubject}>+ Agregar</button>
            </div>

            <div className="form-section-title" style={{marginTop:'18px'}}>
              🏫 Mis clases
              <span className="field-hint"> — secciones de {schools.find(s=>s.id===schoolId)?.short_name}: {sections.join(', ')}</span>
            </div>
            <div className="class-matrix">
              {/* Header */}
              <div className="cm-row cm-header">
                <div className="cm-cell cm-grade-lbl"></div>
                {sections.map(sec => (
                  <div key={sec} className="cm-cell cm-sec-hdr">{sec}</div>
                ))}
              </div>
              {GRADE_LEVELS.map(lvl => (
                <div key={lvl.label}>
                  <div className="cm-level-label">{lvl.label}</div>
                  {lvl.grades.map(grade => (
                    <div key={grade} className="cm-row">
                      <div className="cm-cell cm-grade-lbl">{grade}</div>
                      {sections.map(sec => {
                        const key = `${grade}|${sec}`
                        const checked = myClasses.has(key)
                        return (
                          <div key={sec} className="cm-cell">
                            <div
                              className={`cm-check-lbl ${checked ? 'cm-checked' : ''}`}
                              onClick={() => toggleClass(grade, sec)}>
                              {checked ? '✓' : ''}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 3: Defaults ── */}
        {step === 3 && (
          <div className="setup-body">
            <p style={{fontSize:'13px',color:'#555',marginBottom:'16px'}}>
              Estos valores se precargan automáticamente cada vez que creas una nueva guía.
            </p>
            <div className="form-field">
              <label>Clase predeterminada</label>
              <select value={defClass} onChange={e => setDefClass(e.target.value)}>
                <option value="">— Sin predeterminado —</option>
                {getMyClassLabels().map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Materia predeterminada</label>
              <select value={defSubject} onChange={e => setDefSubject(e.target.value)}>
                <option value="">— Sin predeterminado —</option>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Período actual</label>
              <select value={defPeriod} onChange={e => setDefPeriod(e.target.value)}>
                <option value="1.er Período 2026">1.er Período 2026</option>
                <option value="2.do Período 2026">2.do Período 2026</option>
                <option value="3.er Período 2026">3.er Período 2026</option>
                <option value="4.to Período 2026">4.to Período 2026</option>
              </select>
            </div>

            {error && <div className="alert alert-error">⚠️ {error}</div>}
          </div>
        )}

        {/* Footer buttons */}
        <div className="setup-footer">
          {step > 1 && (
            <button className="btn-secondary" onClick={() => setStep(s => s - 1)}>
              ← Atrás
            </button>
          )}
          <div style={{flex:1}} />
          {step < 3 ? (
            <button className="btn-primary"
              disabled={step === 1 && (!fullName || !schoolId)}
              onClick={() => setStep(s => s + 1)}>
              Siguiente →
            </button>
          ) : (
            <button className="btn-primary btn-save" onClick={handleSave} disabled={loading}>
              {loading ? '⏳ Guardando...' : '✅ Guardar y entrar'}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
