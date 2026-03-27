import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

// ── Períodos disponibles ──────────────────────────────────────
const PERIODS = [
  { id: '1st', label: '1st', time: '6:45–7:40' },
  { id: '2nd', label: '2nd', time: '8:00–8:55' },
  { id: '3rd', label: '3rd', time: '8:55–9:50' },
  { id: '4th', label: '4th', time: '9:50–10:45' },
  { id: '5th', label: '5th', time: '11:15–12:15' },
  { id: '6th', label: '6th', time: '12:15–1:15' },
  { id: '7th', label: '7th', time: '1:30–2:15' },
]

const DAYS = [
  { key: 'mon', label: 'Lun' },
  { key: 'tue', label: 'Mar' },
  { key: 'wed', label: 'Mié' },
  { key: 'thu', label: 'Jue' },
  { key: 'fri', label: 'Vie' },
]

const DEFAULT_SUBJECTS = [
  'Language Arts','Science','Cosmovisión Bíblica','Biblical Worldview',
  'Matemáticas','Sociales','Inglés','Ética','Ed. Física','Artes',
]

// ── Main Page ─────────────────────────────────────────────────
export default function AdminTeachersPage({ teacher: admin }) {
  const [teachers,     setTeachers]     = useState([])
  const [assignments,  setAssignments]  = useState([])
  const [school,       setSchool]       = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [selected,     setSelected]     = useState(null) // teacher being edited
  const [showModal,    setShowModal]    = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: tData }, { data: aData }, { data: sData }] = await Promise.all([
      supabase.from('teachers')
        .select('id, full_name, initials, email, role')
        .eq('school_id', admin.school_id)
        .order('full_name'),
      supabase.from('teacher_assignments')
        .select('*')
        .eq('school_id', admin.school_id),
      supabase.from('schools')
        .select('*')
        .eq('id', admin.school_id)
        .single(),
    ])
    setTeachers(tData || [])
    setAssignments(aData || [])
    setSchool(sData)
    setLoading(false)
  }

  function getTeacherAssignments(teacherId) {
    return assignments.filter(a => a.teacher_id === teacherId)
  }

  function openTeacher(t) {
    setSelected(t)
    setShowModal(true)
  }

  if (loading) return (
    <div className="ge-loading">
      <div className="loading-spinner" />
      <p>Cargando docentes…</p>
    </div>
  )

  return (
    <div className="planner-wrap">
      <div className="card">
        <div className="card-title">
          <div className="badge">👥</div>
          Docentes — {school?.short_name || ''}
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#888', fontWeight: 400, textTransform: 'none' }}>
            {teachers.length} docente{teachers.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {teachers.map(t => {
            const tas = getTeacherAssignments(t.id)
            const isAdmin = t.role === 'admin'
            return (
              <div key={t.id} className="mp-card" onClick={() => openTeacher(t)}
                style={{ cursor: isAdmin && t.id === admin.id ? 'default' : 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '50%',
                    background: isAdmin ? '#2E5598' : '#9BBB59',
                    color: '#fff', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontWeight: 700, fontSize: '13px',
                    flexShrink: 0,
                  }}>
                    {t.initials || t.full_name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#1F3864' }}>
                      {t.full_name}
                      {isAdmin && <span style={{ marginLeft: '8px', fontSize: '10px', background: '#2E5598', color: '#fff', padding: '1px 7px', borderRadius: '10px' }}>Admin</span>}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{t.email}</div>
                    {tas.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                        {tas.map(a => (
                          <span key={a.id} style={{
                            fontSize: '10px', fontWeight: 600,
                            background: '#D6E4F0', color: '#1F3864',
                            padding: '2px 8px', borderRadius: '10px',
                          }}>
                            {a.grade} {a.section} · {a.subject}
                          </span>
                        ))}
                      </div>
                    )}
                    {tas.length === 0 && !isAdmin && (
                      <div style={{ fontSize: '11px', color: '#F79646', marginTop: '4px', fontStyle: 'italic' }}>
                        ⚠️ Sin asignaciones
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', flexShrink: 0 }}>
                  {!isAdmin && <span className="mp-arrow">→</span>}
                  {t.id !== admin.id && (
                    <button
                      onClick={async e => {
                        e.stopPropagation()
                        const newRole = t.role === 'admin' ? 'teacher' : 'admin'
                        if (!confirm(`¿Cambiar rol de ${t.full_name} a ${newRole === 'admin' ? 'Admin' : 'Docente'}?`)) return
                        await supabase.from('teachers').update({ role: newRole }).eq('id', t.id)
                        setTeachers(prev => prev.map(x => x.id === t.id ? { ...x, role: newRole } : x))
                      }}
                      style={{
                        fontSize: '10px', padding: '3px 8px', borderRadius: '6px',
                        border: `1px solid ${isAdmin ? '#C0504D' : '#2E5598'}`,
                        background: 'transparent',
                        color: isAdmin ? '#C0504D' : '#2E5598',
                        cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
                      }}>
                      {isAdmin ? '↓ Quitar admin' : '↑ Hacer admin'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {showModal && selected && (
        <AssignmentModal
          teacher={selected}
          admin={admin}
          school={school}
          allAssignments={assignments}
          onClose={() => { setShowModal(false); setSelected(null) }}
          onSave={() => { setShowModal(false); setSelected(null); fetchAll() }}
        />
      )}
    </div>
  )
}

// ── Assignment Modal ──────────────────────────────────────────
function AssignmentModal({ teacher, admin, school, allAssignments, onClose, onSave }) {
  const sections = school?.sections || []

  // This teacher's assignments
  const [myAssignments, setMyAssignments] = useState(
    allAssignments.filter(a => a.teacher_id === teacher.id)
      .map(a => ({ ...a, _dirty: false }))
  )

  // Form for new assignment
  const [newGrade,   setNewGrade]   = useState('')
  const [newSection, setNewSection] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [newCustomSubject, setNewCustomSubject] = useState('')
  const [saving,     setSaving]     = useState(false)
  const [errors,     setErrors]     = useState([])
  const [warnings,   setWarnings]   = useState([])

  const GRADE_LEVELS = ['1.°','2.°','3.°','4.°','5.°','6.°','7.°','8.°','9.°','10.°','11.°']

  // ── Conflict detection ────────────────────────────────────
  function detectConflicts(grade, section, subject, schedule = {}) {
    const errs = [], warns = []

    // 1. BLOQUEO: materia duplicada en mismo grado+sección
    const duplicate = allAssignments.find(a =>
      a.grade === grade &&
      a.section === section &&
      a.subject === subject &&
      a.teacher_id !== teacher.id
    )
    if (duplicate) {
      const owner = allAssignments.find(a => a.id === duplicate.id)
      errs.push(`❌ ${grade} ${section} · ${subject} ya está asignado a otro docente.`)
    }

    // 2. ADVERTENCIA: conflicto de horario personal
    if (Object.keys(schedule).length > 0) {
      myAssignments.forEach(existing => {
        if (existing.grade === grade && existing.section === section && existing.subject === subject) return
        DAYS.forEach(({ key }) => {
          const newPeriods = schedule[key] || []
          const existPeriods = existing.schedule?.[key] || []
          const clash = newPeriods.filter(p => existPeriods.includes(p))
          if (clash.length) {
            warns.push(`⚠️ ${key.toUpperCase()}: período ${clash.join('+')} ya está ocupado por ${existing.grade} ${existing.section} · ${existing.subject}`)
          }
        })
      })

      // 3. ADVERTENCIA: mismo salón mismo período (otro docente)
      allAssignments.forEach(a => {
        if (a.teacher_id === teacher.id) return
        if (a.grade !== grade || a.section !== section) return
        DAYS.forEach(({ key }) => {
          const newPeriods  = schedule[key] || []
          const otherPeriods = a.schedule?.[key] || []
          const clash = newPeriods.filter(p => otherPeriods.includes(p))
          if (clash.length) {
            warns.push(`⚠️ ${grade} ${section} ${key.toUpperCase()} período ${clash.join('+')}: otro docente también está en ese salón.`)
          }
        })
      })
    }

    return { errs, warns }
  }

  // ── Schedule editor for an assignment ────────────────────
  function togglePeriod(assignmentId, dayKey, periodId) {
    setMyAssignments(prev => prev.map(a => {
      if (a.id !== assignmentId) return a
      const current = a.schedule?.[dayKey] || []
      const next = current.includes(periodId)
        ? current.filter(p => p !== periodId)
        : [...current, periodId].sort()
      return { ...a, schedule: { ...a.schedule, [dayKey]: next }, _dirty: true }
    }))
  }

  // ── Add new assignment ────────────────────────────────────
  async function handleAdd() {
    const subject = newCustomSubject.trim() || newSubject
    if (!newGrade || !newSection || !subject) return
    setSaving(true)
    setErrors([]); setWarnings([])

    const { errs, warns } = detectConflicts(newGrade, newSection, subject)
    if (errs.length) { setErrors(errs); setSaving(false); return }
    if (warns.length) setWarnings(warns)

    const { data, error } = await supabase
      .from('teacher_assignments')
      .insert({
        school_id:  admin.school_id,
        teacher_id: teacher.id,
        grade:      newGrade,
        section:    newSection,
        subject,
        schedule:   {},
      })
      .select()
      .single()

    setSaving(false)
    if (!error && data) {
      setMyAssignments(prev => [...prev, { ...data, _dirty: false }])
      setNewGrade(''); setNewSection(''); setNewSubject(''); setNewCustomSubject('')
    }
  }

  // ── Save schedule changes ────────────────────────────────
  async function handleSaveSchedules() {
    setSaving(true)
    setErrors([]); setWarnings([])

    const dirty = myAssignments.filter(a => a._dirty)
    let allWarns = []

    for (const a of dirty) {
      const { errs, warns } = detectConflicts(a.grade, a.section, a.subject, a.schedule)
      if (errs.length) { setErrors(errs); setSaving(false); return }
      allWarns = [...allWarns, ...warns]
    }

    if (allWarns.length) setWarnings(allWarns)

    // Save all dirty assignments
    await Promise.all(dirty.map(a =>
      supabase.from('teacher_assignments')
        .update({ schedule: a.schedule, updated_at: new Date().toISOString() })
        .eq('id', a.id)
    ))

    // Also update teacher's class_subjects for backward compat
    const classSubjects = myAssignments.reduce((acc, a) => {
      const existing = acc.find(cs => cs.grade === a.grade && cs.section === a.section)
      if (existing) {
        if (!existing.subjects.includes(a.subject)) existing.subjects.push(a.subject)
      } else {
        acc.push({ grade: a.grade, section: a.section, subjects: [a.subject] })
      }
      return acc
    }, [])

    await supabase.from('teachers')
      .update({ class_subjects: classSubjects })
      .eq('id', teacher.id)

    setSaving(false)
    onSave()
  }

  // ── Remove assignment ────────────────────────────────────
  async function handleRemove(id) {
    await supabase.from('teacher_assignments').delete().eq('id', id)
    setMyAssignments(prev => prev.filter(a => a.id !== id))
  }

  const hasDirty = myAssignments.some(a => a._dirty)

  return (
    <div className="sb-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sb-modal" style={{ maxWidth: '800px' }}>
        <div className="sb-modal-header">
          <h2>📋 Asignaciones — {teacher.full_name}</h2>
          <button onClick={onClose}>✕</button>
        </div>

        <div className="sb-modal-body">

          {/* Errors & Warnings */}
          {errors.map((e, i) => (
            <div key={i} className="alert alert-error" style={{ marginBottom: '8px' }}>{e}</div>
          ))}
          {warnings.map((w, i) => (
            <div key={i} style={{ background: '#FFF3CD', border: '1px solid #F79646', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', color: '#856404', marginBottom: '8px' }}>
              {w}
            </div>
          ))}

          {/* Add new assignment */}
          <div style={{ background: '#f8faff', border: '1.5px solid #dde5f0', borderRadius: '10px', padding: '14px', marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#2E5598', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '10px' }}>
              ➕ Agregar asignación
            </div>
            <div className="ge-grid-3" style={{ marginBottom: '8px' }}>
              <div className="ge-field">
                <label>Grado</label>
                <select value={newGrade} onChange={e => setNewGrade(e.target.value)}>
                  <option value="">— Grado —</option>
                  {GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="ge-field">
                <label>Sección</label>
                <select value={newSection} onChange={e => setNewSection(e.target.value)}>
                  <option value="">— Sección —</option>
                  {sections.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="ge-field">
                <label>Materia</label>
                <select value={newSubject} onChange={e => { setNewSubject(e.target.value); setNewCustomSubject('') }}>
                  <option value="">— Materia —</option>
                  {DEFAULT_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  <option value="__custom">Otra…</option>
                </select>
              </div>
            </div>
            {newSubject === '__custom' && (
              <div className="ge-field" style={{ marginBottom: '8px' }}>
                <label>Nombre de la materia</label>
                <input type="text" value={newCustomSubject}
                  placeholder="Ej: Cosmovisión Bíblica"
                  onChange={e => setNewCustomSubject(e.target.value)} />
              </div>
            )}
            <button className="btn-primary btn-save"
              disabled={!newGrade || !newSection || (!newSubject && !newCustomSubject.trim()) || saving}
              onClick={handleAdd}>
              ➕ Agregar
            </button>
          </div>

          {/* Current assignments with schedule editor */}
          {myAssignments.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px' }}>
              <p>Este docente no tiene asignaciones aún.</p>
            </div>
          ) : (
            myAssignments.map(a => (
              <div key={a.id} className="asgn-card">
                <div className="asgn-card-header">
                  <span className="asgn-title">{a.grade} {a.section} · <strong>{a.subject}</strong></span>
                  {a._dirty && <span style={{ fontSize: '10px', color: '#F79646', fontWeight: 700 }}>● Cambios sin guardar</span>}
                  <button className="btn-icon-danger" style={{ marginLeft: 'auto' }}
                    onClick={() => handleRemove(a.id)} title="Eliminar asignación">🗑</button>
                </div>

                {/* Schedule grid */}
                <div className="asgn-schedule">
                  <div className="asgn-sch-header">
                    <div className="asgn-period-col">Período</div>
                    {DAYS.map(d => (
                      <div key={d.key} className="asgn-day-col">{d.label}</div>
                    ))}
                  </div>
                  {PERIODS.map(p => (
                    <div key={p.id} className="asgn-sch-row">
                      <div className="asgn-period-col">
                        <span className="asgn-period-num">{p.label}</span>
                        <span className="asgn-period-time">{p.time}</span>
                      </div>
                      {DAYS.map(d => {
                        const active = (a.schedule?.[d.key] || []).includes(p.id)
                        return (
                          <div key={d.key} className="asgn-day-col">
                            <div
                              className={`asgn-cell ${active ? 'active' : ''}`}
                              onClick={() => togglePeriod(a.id, d.key, p.id)}>
                              {active ? '✓' : ''}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="sb-modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cerrar</button>
          <div style={{ flex: 1 }} />
          {hasDirty && (
            <button className="btn-primary btn-save" onClick={handleSaveSchedules} disabled={saving}>
              {saving ? '⏳ Guardando…' : '💾 Guardar horarios'}
            </button>
          )}
          {!hasDirty && myAssignments.length > 0 && (
            <button className="btn-primary btn-save" onClick={onSave}>
              ✅ Listo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
