import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { teacherStatusUpdateSchema, teacherRoleUpdateSchema } from '../utils/validationSchemas'
import { PERIODS, DAYS, DEFAULT_SUBJECTS } from '../utils/constants'
import { canManage, canChangeRole, roleLabel, ROLE_STYLES, LEVEL_LABELS, isSuperAdmin } from '../utils/roles'

// ── Main Page ─────────────────────────────────────────────────
export default function AdminTeachersPage({ teacher: admin }) {
  const { showToast } = useToast()
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
        .select('id, full_name, initials, email, role, level, status')
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

        {/* ── Pending approvals ── */}
        {teachers.filter(t => t.status === 'pending').length > 0 && (
          <div style={{
            background: '#fff9f0', border: '2px solid #F79646',
            borderRadius: '10px', padding: '14px', marginBottom: '16px',
          }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#8a4f00', marginBottom: '10px' }}>
              ⏳ Solicitudes pendientes de aprobación ({teachers.filter(t => t.status === 'pending').length})
            </div>
            {teachers.filter(t => t.status === 'pending').map(t => (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', background: '#fff', borderRadius: '8px',
                border: '1px solid #fde8c8', marginBottom: '6px',
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: '#F79646', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: 700, flexShrink: 0,
                }}>
                  {t.initials || t.full_name.slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1F3864' }}>{t.full_name}</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>{t.email}</div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={async () => {
                      // Validate
                      const validation = teacherStatusUpdateSchema.safeParse({
                        status: 'approved',
                        teacher_id: t.id,
                      })
                      if (!validation.success) {
                        showToast(validation.error.errors[0].message, 'error')
                        return
                      }

                      const { error } = await supabase.from('teachers').update({ status: 'approved' }).eq('id', t.id)
                      if (error) {
                        showToast('Error al aprobar: ' + error.message, 'error')
                        return
                      }

                      setTeachers(prev => prev.map(x => x.id === t.id ? { ...x, status: 'approved' } : x))
                      showToast(`${t.full_name} aprobado exitosamente`, 'success')
                    }}
                    style={{
                      background: '#9BBB59', color: '#fff', border: 'none',
                      padding: '5px 12px', borderRadius: '6px', fontSize: '12px',
                      fontWeight: 700, cursor: 'pointer',
                    }}>
                    ✅ Aprobar
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`¿Rechazar a ${t.full_name}?`)) return

                      // Validate
                      const validation = teacherStatusUpdateSchema.safeParse({
                        status: 'rejected',
                        teacher_id: t.id,
                      })
                      if (!validation.success) {
                        showToast(validation.error.errors[0].message, 'error')
                        return
                      }

                      const { error } = await supabase.from('teachers').update({ status: 'rejected' }).eq('id', t.id)
                      if (error) {
                        showToast('Error al rechazar: ' + error.message, 'error')
                        return
                      }

                      setTeachers(prev => prev.map(x => x.id === t.id ? { ...x, status: 'rejected' } : x))
                      showToast(`${t.full_name} rechazado`, 'info')
                    }}
                    style={{
                      background: '#C0504D', color: '#fff', border: 'none',
                      padding: '5px 12px', borderRadius: '6px', fontSize: '12px',
                      fontWeight: 700, cursor: 'pointer',
                    }}>
                    ❌ Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {teachers.filter(t => t.status !== 'pending').map(t => {
            const tas      = getTeacherAssignments(t.id)
            const roleStyle = ROLE_STYLES[t.role] || ROLE_STYLES.teacher
            const isSelf   = t.id === admin.id
            return (
              <div key={t.id} className="mp-card" onClick={() => !isSelf && openTeacher(t)}
                style={{ cursor: isSelf ? 'default' : 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '50%',
                    background: roleStyle.color,
                    color: '#fff', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontWeight: 700, fontSize: '13px',
                    flexShrink: 0,
                  }}>
                    {t.initials || t.full_name.split(' ').map(w=>w[0]).join('').slice(0,2)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#1F3864', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {t.full_name}
                      <span style={{
                        fontSize: '10px', background: roleStyle.bg, color: roleStyle.color,
                        border: `1px solid ${roleStyle.color}33`,
                        padding: '1px 7px', borderRadius: '10px', fontWeight: 700,
                      }}>
                        {roleStyle.icon} {roleLabel(t.role)}
                      </span>
                      {t.level && (
                        <span style={{ fontSize: '10px', background: '#f5f5f5', color: '#666', padding: '1px 7px', borderRadius: '10px' }}>
                          {LEVEL_LABELS[t.level]}
                        </span>
                      )}
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
                    {tas.length === 0 && !canManage(t.role) && t.role !== 'director' && t.role !== 'psicopedagoga' && (
                      <div style={{ fontSize: '11px', color: '#F79646', marginTop: '4px', fontStyle: 'italic' }}>
                        ⚠️ Sin asignaciones
                      </div>
                    )}
                  </div>
                </div>
                {!isSelf && <span className="mp-arrow">→</span>}
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
    <div className="sb-modal-overlay">
      <div className="sb-modal" style={{ maxWidth: '800px' }}>
        <div className="sb-modal-header">
          <h2>📋 Asignaciones — {teacher.full_name}</h2>
          <button onClick={onClose} aria-label="Cerrar asignaciones">✕</button>
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

          {/* ── Rol y Nivel ── */}
          <RoleAndLevelEditor teacher={teacher} admin={admin} />

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

// ── RoleAndLevelEditor ─────────────────────────────────────────────────────────
// Inline section inside AssignmentModal for changing role and level.
function RoleAndLevelEditor({ teacher, admin }) {
  const { showToast } = useToast()
  const [role,    setRole]    = useState(teacher.role || 'teacher')
  const [level,   setLevel]   = useState(teacher.level || '')
  const [saving,  setSaving]  = useState(false)

  const ALL_ROLES = [
    { value: 'teacher',       label: '👩‍🏫 Docente' },
    { value: 'admin',         label: '🏫 Coordinador' },
    { value: 'director',      label: '📋 Director de Grupo' },
    { value: 'psicopedagoga', label: '💜 Psicopedagoga' },
    ...(isSuperAdmin(admin.role) ? [{ value: 'superadmin', label: '🔑 Superadmin' }] : []),
  ]

  async function handleSave() {
    if (!canChangeRole(admin.role, role)) {
      showToast('No tienes permisos para asignar ese rol.', 'error')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('teachers')
      .update({ role, level: level || null })
      .eq('id', teacher.id)
    setSaving(false)
    if (error) {
      showToast('Error al guardar rol: ' + error.message, 'error')
    } else {
      showToast(`Rol actualizado: ${role}`, 'success')
    }
  }

  const unchanged = role === (teacher.role || 'teacher') && level === (teacher.level || '')

  return (
    <div style={{ background: '#faf9ff', border: '1.5px solid #d6c9f0', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#8064A2', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '10px' }}>
        🔑 Rol y Nivel educativo
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
        <div className="ge-field">
          <label>Rol</label>
          <select value={role} onChange={e => setRole(e.target.value)}>
            {ALL_ROLES.map(r => (
              <option key={r.value} value={r.value}
                disabled={r.value === 'superadmin' && !isSuperAdmin(admin.role)}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="ge-field">
          <label>Nivel <span style={{ color: '#999', fontWeight: 400 }}>(opcional)</span></label>
          <select value={level} onChange={e => setLevel(e.target.value)}>
            <option value="">— Sin asignar —</option>
            <option value="elementary">Primaria</option>
            <option value="middle">Bachillerato Básico</option>
            <option value="high">Bachillerato Superior</option>
          </select>
        </div>
      </div>
      {!unchanged && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary btn-save"
          style={{ fontSize: '12px', padding: '6px 16px' }}
        >
          {saving ? '⏳ Guardando…' : '💾 Guardar rol y nivel'}
        </button>
      )}
    </div>
  )
}
