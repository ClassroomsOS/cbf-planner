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
  const [selected,        setSelected]        = useState(null) // teacher being edited
  const [showModal,       setShowModal]       = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: tData }, { data: aData }, { data: sData }] = await Promise.all([
      supabase.from('teachers')
        .select('id, full_name, initials, email, role, level, status, homeroom_grade, homeroom_section, coteacher_grade, coteacher_section, director_absent_until')
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
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#888', fontWeight: 400, textTransform: 'none' }}>
              {teachers.length} docente{teachers.length !== 1 ? 's' : ''}
            </span>
            <button className="btn-primary" style={{ fontSize: '11px' }}
              onClick={() => setShowCreateModal(true)}>
              ➕ Crear docente
            </button>
          </div>
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
              <div key={t.id} className="mp-card" onClick={() => openTeacher(t)}
                style={{ cursor: 'pointer' }}>
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
                      {t.homeroom_grade && t.homeroom_section && (
                        <span style={{ fontSize: '10px', background: '#e8f7e0', color: '#3a6b1a', padding: '1px 7px', borderRadius: '10px', fontWeight: 700 }}>
                          🏠 {t.homeroom_grade} {t.homeroom_section}
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
                    {tas.length === 0 && !canManage(t.role) && t.role !== 'rector' && t.role !== 'psicopedagoga' && (
                      <div style={{ fontSize: '11px', color: '#F79646', marginTop: '4px', fontStyle: 'italic' }}>
                        ⚠️ Sin asignaciones
                      </div>
                    )}
                  </div>
                </div>
                <span className="mp-arrow">→</span>
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
          allTeachers={teachers}
          isSelf={selected.id === admin.id}
          onClose={() => { setShowModal(false); setSelected(null) }}
          onSave={() => { setShowModal(false); setSelected(null); fetchAll() }}
        />
      )}

      {showCreateModal && (
        <CreateTeacherModal
          admin={admin}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); fetchAll() }}
        />
      )}
    </div>
  )
}

// ── Create Teacher Modal ──────────────────────────────────────
const EDGE_BASE = (import.meta.env.VITE_SUPABASE_URL || 'https://vouxrqsiyoyllxgcriic.supabase.co') + '/functions/v1'

function CreateTeacherModal({ admin, onClose, onCreated }) {
  const { showToast } = useToast()
  const [form,         setForm]         = useState({ full_name: '', email: '', role: 'teacher', level: '' })
  const [saving,       setSaving]       = useState(false)
  const [recoveryUrl,  setRecoveryUrl]  = useState(null)
  const [emailSent,    setEmailSent]    = useState(false)
  const [copied,       setCopied]       = useState(false)

  function updateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleCreate() {
    if (!form.full_name.trim() || !form.email.trim()) {
      showToast('Nombre y email son requeridos', 'error')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(form.email.trim())) {
      showToast('Ingresa un email válido', 'error')
      return
    }
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${EDGE_BASE}/admin-create-teacher`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey':        import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({
          email:     form.email.trim().toLowerCase(),
          full_name: form.full_name.trim(),
          role:      form.role,
          level:     form.level || null,
          school_id: admin.school_id,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        showToast(json.error || 'Error al crear el docente', 'error')
        return
      }
      if (json.recovery_url) {
        setRecoveryUrl(json.recovery_url)
        setEmailSent(json.email_sent || false)
      } else {
        showToast(`Docente ${form.full_name} creado`, 'success')
        onCreated()
      }
    } finally {
      setSaving(false)
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(recoveryUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '20px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '460px',
        boxShadow: '0 20px 60px rgba(0,0,0,.2)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1F3864, #2E5598)',
          padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontSize: '18px' }}>👤</span>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '14px' }}>Crear nuevo docente</div>
          <button onClick={onClose} style={{
            marginLeft: 'auto', background: 'rgba(255,255,255,.15)', border: 'none',
            color: '#fff', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer',
            fontSize: '13px',
          }}>✕</button>
        </div>

        <div style={{ padding: '20px' }}>
          {recoveryUrl ? (
            /* ── Success state ── */
            <div>
              <div style={{
                background: '#eef7e0', border: '1px solid #9BBB59', borderRadius: '10px',
                padding: '14px', marginBottom: '16px',
              }}>
                <div style={{ fontWeight: 700, color: '#3a6b1a', marginBottom: '4px' }}>
                  ✅ Docente creado exitosamente
                </div>
                {emailSent ? (
                  <div style={{ fontSize: '12px', color: '#555' }}>
                    📧 Se envió un correo a <strong>{form.email}</strong> con el enlace para establecer su contraseña.
                    Si no llega, usa el enlace de respaldo abajo.
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#555' }}>
                    Comparte este enlace con <strong>{form.full_name}</strong> para que establezca su contraseña.
                    El enlace expira en 24 horas.
                  </div>
                )}
              </div>
              <div style={{
                background: '#f5f5f5', borderRadius: '8px', padding: '10px 12px',
                fontSize: '11px', color: '#555', wordBreak: 'break-all',
                marginBottom: '12px', lineHeight: 1.5,
              }}>
                {recoveryUrl}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-primary" style={{ fontSize: '12px', flex: 1 }}
                  onClick={copyLink}>
                  {copied ? '✅ ¡Copiado!' : '📋 Copiar enlace'}
                </button>
                <button className="btn-secondary" style={{ fontSize: '12px' }}
                  onClick={onCreated}>
                  Cerrar
                </button>
              </div>
            </div>
          ) : (
            /* ── Form ── */
            <>
              <div className="ge-field" style={{ marginBottom: '12px' }}>
                <label>Nombre completo *</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={e => updateField('full_name', e.target.value)}
                  placeholder="Ej. María González"
                  autoFocus
                />
              </div>
              <div className="ge-field" style={{ marginBottom: '12px' }}>
                <label>Email institucional *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => updateField('email', e.target.value)}
                  placeholder="docente@colegio.edu.co"
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <div className="ge-field" style={{ flex: 1 }}>
                  <label>Rol</label>
                  <select value={form.role} onChange={e => updateField('role', e.target.value)}>
                    <option value="teacher">Docente</option>
                    <option value="admin">Administrador</option>
                    <option value="rector">Rector</option>
                    <option value="psicopedagoga">Psicopedagoga</option>
                  </select>
                </div>
                <div className="ge-field" style={{ flex: 1 }}>
                  <label>Nivel</label>
                  <select value={form.level} onChange={e => updateField('level', e.target.value)}>
                    <option value="">— Todos —</option>
                    <option value="elementary">Primaria</option>
                    <option value="middle">Bachillerato Básico</option>
                    <option value="high">Bachillerato Superior</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button className="btn-secondary" style={{ fontSize: '12px' }} onClick={onClose}>
                  Cancelar
                </button>
                <button className="btn-primary btn-save" style={{ fontSize: '12px' }}
                  onClick={handleCreate} disabled={saving || !form.full_name.trim() || !form.email.trim()}>
                  {saving ? '⏳ Creando…' : '➕ Crear docente'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Assignment Modal ──────────────────────────────────────────
function AssignmentModal({ teacher, admin, school, allAssignments, allTeachers, isSelf, onClose, onSave }) {
  const { showToast } = useToast()
  const sections = school?.sections || []

  // This teacher's assignments
  const [myAssignments, setMyAssignments] = useState(
    allAssignments.filter(a => a.teacher_id === teacher.id)
      .map(a => ({ ...a, _dirty: false }))
  )

  // Form for new assignment
  const [newGrade,         setNewGrade]         = useState('')
  const [newSection,       setNewSection]       = useState('')
  const [newSubject,       setNewSubject]       = useState('')
  const [newCustomSubject, setNewCustomSubject] = useState('')
  const [newClassroom,     setNewClassroom]     = useState('')
  const [saving,           setSaving]           = useState(false)
  const [errors,           setErrors]           = useState([])
  const [warnings,         setWarnings]         = useState([])

  const GRADE_LEVELS = ['1.°','2.°','3.°','4.°','5.°','6.°','7.°','8.°','9.°','10.°','11.°']

  // ── Conflict detection ────────────────────────────────────
  function detectConflicts(grade, section, subject, schedule = {}, classroom = '') {
    const errs = [], warns = []

    // 1. BLOQUEO: materia duplicada en mismo grado+sección
    const duplicate = allAssignments.find(a =>
      a.grade === grade &&
      a.section === section &&
      a.subject === subject &&
      a.teacher_id !== teacher.id
    )
    if (duplicate) {
      errs.push(`❌ ${grade} ${section} · ${subject} ya está asignado a otro docente.`)
    }

    if (Object.keys(schedule).length > 0) {
      // 2. ADVERTENCIA: conflicto de horario personal del docente
      myAssignments.forEach(existing => {
        if (existing.grade === grade && existing.section === section && existing.subject === subject) return
        DAYS.forEach(({ key }) => {
          const newPeriods   = schedule[key] || []
          const existPeriods = existing.schedule?.[key] || []
          const clash = newPeriods.filter(p => existPeriods.includes(p))
          if (clash.length) {
            warns.push(`⚠️ ${key.toUpperCase()}: período ${clash.join('+')} ya está ocupado por ${existing.grade} ${existing.section} · ${existing.subject}`)
          }
        })
      })

      // 3. ADVERTENCIA: mismo grado+sección mismo período (otro docente)
      allAssignments.forEach(a => {
        if (a.teacher_id === teacher.id) return
        if (a.grade !== grade || a.section !== section) return
        DAYS.forEach(({ key }) => {
          const newPeriods   = schedule[key] || []
          const otherPeriods = a.schedule?.[key] || []
          const clash = newPeriods.filter(p => otherPeriods.includes(p))
          if (clash.length) {
            warns.push(`⚠️ ${grade} ${section} ${key.toUpperCase()} período ${clash.join('+')}: otro docente también está en ese salón.`)
          }
        })
      })

      // 4. BLOQUEO: mismo salón físico mismo período (cualquier grado/docente)
      if (classroom) {
        allAssignments.forEach(a => {
          if (!a.classroom || a.classroom !== classroom) return
          if (a.grade === grade && a.section === section && a.subject === subject) return
          DAYS.forEach(({ key }) => {
            const newPeriods   = schedule[key] || []
            const otherPeriods = a.schedule?.[key] || []
            const clash = newPeriods.filter(p => otherPeriods.includes(p))
            if (clash.length) {
              errs.push(`❌ Salón ${classroom}: conflicto con ${a.grade} ${a.section} · ${a.subject} el ${key.toUpperCase()} período ${clash.join('+')}`)
            }
          })
        })
      }
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

  function updateClassroom(assignmentId, classroom) {
    setMyAssignments(prev => prev.map(a =>
      a.id !== assignmentId ? a : { ...a, classroom, _dirty: true }
    ))
  }

  // ── Add new assignment ────────────────────────────────────
  async function handleAdd() {
    const subject = newCustomSubject.trim() || newSubject
    if (!newGrade || !newSection || !subject) return
    setSaving(true)
    setErrors([]); setWarnings([])

    const { errs, warns } = detectConflicts(newGrade, newSection, subject)
    if (errs.length) {
      setErrors(errs)
      errs.forEach(e => showToast(e, 'error'))
      setSaving(false)
      return
    }
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
        classroom:  newClassroom.trim() || null,
      })
      .select()
      .single()

    setSaving(false)
    if (error) {
      showToast('Error al agregar: ' + error.message, 'error')
      return
    }
    if (data) {
      setMyAssignments(prev => [...prev, { ...data, _dirty: false }])
      setNewGrade(''); setNewSection(''); setNewSubject(''); setNewCustomSubject(''); setNewClassroom('')
    }
  }

  // ── Save schedule changes ────────────────────────────────
  async function handleSaveSchedules() {
    setSaving(true)
    setErrors([]); setWarnings([])

    const dirty = myAssignments.filter(a => a._dirty)
    let allWarns = []

    for (const a of dirty) {
      const { errs, warns } = detectConflicts(a.grade, a.section, a.subject, a.schedule, a.classroom || '')
      if (errs.length) { setErrors(errs); setSaving(false); return }
      allWarns = [...allWarns, ...warns]
    }

    if (allWarns.length) setWarnings(allWarns)

    // Save all dirty assignments
    await Promise.all(dirty.map(a =>
      supabase.from('teacher_assignments')
        .update({ schedule: a.schedule, classroom: a.classroom || null, updated_at: new Date().toISOString() })
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

          {/* ── Datos del docente ── */}
          <TeacherProfileEditor teacher={teacher} isSelf={isSelf} />

          {/* ── Rol y Nivel ── */}
          {isSelf
            ? <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#888', marginBottom: '16px' }}>
                ℹ️ No puedes cambiar tu propio rol. Pide a otro administrador que lo haga.
              </div>
            : <RoleAndLevelEditor teacher={teacher} admin={admin} />
          }

          {/* ── Director de Grupo (homeroom) ── */}
          <HomeroomEditor teacher={teacher} sections={sections} />

          {/* ── Co-teacher ── */}
          <CoteacherEditor teacher={teacher} teachers={allTeachers} sections={sections} />

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
            <div className="ge-field" style={{ marginBottom: '8px' }}>
              <label>Salón (opcional)</label>
              <input type="text" value={newClassroom}
                placeholder="Ej: 301, Lab Cómputo, Sala B"
                onChange={e => setNewClassroom(e.target.value)} />
            </div>
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
                <div style={{ padding: '4px 8px 6px', borderBottom: '1px solid #eee' }}>
                  <input
                    type="text"
                    value={a.classroom || ''}
                    placeholder="🏠 Salón (opcional, ej: 301)"
                    onChange={e => updateClassroom(a.id, e.target.value)}
                    style={{
                      fontSize: '11px', padding: '3px 8px', border: '1px solid #dde5f0',
                      borderRadius: '6px', width: '100%', background: '#fafbff',
                    }}
                  />
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

        <div className="sb-modal-footer" style={{ flexDirection: 'column', gap: '10px', alignItems: 'stretch' }}>
          {!isSelf && <DeleteTeacherZone teacher={teacher} onDeleted={onSave} />}
          <div style={{ display: 'flex', gap: '8px' }}>
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
    </div>
  )
}

// ── HomeroomEditor ────────────────────────────────────────────────────────────
// Assigns (or clears) a teacher as homeroom director of a grade+section.
function HomeroomEditor({ teacher, sections }) {
  const { showToast }  = useToast()
  const GRADE_LEVELS   = ['1.°','2.°','3.°','4.°','5.°','6.°','7.°','8.°','9.°','10.°','11.°']
  const [grade,   setGrade]   = useState(teacher.homeroom_grade   || '')
  const [section, setSection] = useState(teacher.homeroom_section || '')
  const [saving,  setSaving]  = useState(false)

  const unchanged = grade   === (teacher.homeroom_grade   || '') &&
                    section === (teacher.homeroom_section || '')

  async function handleSave() {
    if (grade && !section) { showToast('Selecciona también la sección', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('teachers')
      .update({ homeroom_grade: grade || null, homeroom_section: section || null })
      .eq('id', teacher.id)
    setSaving(false)
    if (error) showToast('Error al guardar: ' + error.message, 'error')
    else {
      teacher.homeroom_grade   = grade   || null
      teacher.homeroom_section = section || null
      showToast(grade ? `Director de ${grade} ${section} asignado` : 'Dirección de grupo removida', 'success')
    }
  }

  return (
    <div style={{ background: '#f0f7ee', border: '1.5px solid #9BBB59', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#3a6b1a', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '10px' }}>
        🏠 Director de Grupo
      </div>
      <div style={{ fontSize: '11px', color: '#555', marginBottom: '10px' }}>
        El docente tendrá acceso directo a la agenda semanal de su grupo y podrá editarla y marcarla como lista.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
        <div className="ge-field">
          <label>Grado</label>
          <select value={grade} onChange={e => { setGrade(e.target.value); setSection('') }}>
            <option value="">— Sin dirección —</option>
            {GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="ge-field">
          <label>Sección</label>
          <select value={section} onChange={e => setSection(e.target.value)} disabled={!grade}>
            <option value="">— Sección —</option>
            {sections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      {!unchanged && (
        <button className="btn-primary" style={{ fontSize: '12px' }}
          onClick={handleSave} disabled={saving}>
          {saving ? '⏳ Guardando…' : '💾 Guardar dirección de grupo'}
        </button>
      )}
      {unchanged && teacher.homeroom_grade && (
        <div style={{ fontSize: '11px', color: '#3a6b1a', fontWeight: 600 }}>
          ✅ Director actual: {teacher.homeroom_grade} {teacher.homeroom_section}
        </div>
      )}
    </div>
  )
}

// ── CoteacherEditor ───────────────────────────────────────────────────────────
// Assigns a teacher as co-teacher of a grade+section, and controls the
// director_absent_until date that grants write access to the agenda.
function CoteacherEditor({ teacher, teachers, sections }) {
  const { showToast }   = useToast()
  const GRADE_LEVELS    = ['1.°','2.°','3.°','4.°','5.°','6.°','7.°','8.°','9.°','10.°','11.°']
  const [grade,         setGrade]         = useState(teacher.coteacher_grade         || '')
  const [section,       setSection]       = useState(teacher.coteacher_section       || '')
  const [absentUntil,   setAbsentUntil]   = useState(teacher.director_absent_until   || '')
  const [saving,        setSaving]        = useState(false)

  const isActive = absentUntil && new Date(absentUntil + 'T23:59:59') >= new Date()

  // Find the homeroom director of this grade+section
  const homeroomDirector = grade && section
    ? (teachers || []).find(t => t.homeroom_grade === grade && t.homeroom_section === section && t.id !== teacher.id)
    : null

  const unchanged = grade         === (teacher.coteacher_grade         || '') &&
                    section       === (teacher.coteacher_section       || '') &&
                    absentUntil   === (teacher.director_absent_until   || '')

  async function handleSave() {
    if (grade && !section) { showToast('Selecciona también la sección', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('teachers').update({
      coteacher_grade:       grade        || null,
      coteacher_section:     section      || null,
      director_absent_until: absentUntil  || null,
    }).eq('id', teacher.id)
    setSaving(false)
    if (error) { showToast('Error al guardar: ' + error.message, 'error'); return }
    teacher.coteacher_grade       = grade        || null
    teacher.coteacher_section     = section      || null
    teacher.director_absent_until = absentUntil  || null
    showToast(grade ? `Co-teacher de ${grade} ${section} asignado` : 'Co-teacher removido', 'success')
  }

  return (
    <div style={{
      background: '#f0f4ff', border: '1.5px solid #bfcfff',
      borderRadius: '10px', padding: '14px', marginBottom: '16px',
    }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#2E5598',
        textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '8px' }}>
        🤝 Co-teacher de grupo
      </div>
      <div style={{ fontSize: '11px', color: '#555', marginBottom: '10px', lineHeight: 1.5 }}>
        El docente puede ver la agenda del grupo siempre. Puede editarla solo si el director está ausente
        y la fecha de ausencia está activa.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div className="ge-field">
          <label>Grupo (grado)</label>
          <select value={grade} onChange={e => { setGrade(e.target.value); setSection('') }}>
            <option value="">— Sin co-dirección —</option>
            {GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="ge-field">
          <label>Sección</label>
          <select value={section} onChange={e => setSection(e.target.value)} disabled={!grade}>
            <option value="">— Sección —</option>
            {sections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Director del grupo */}
      {homeroomDirector && (
        <div style={{
          fontSize: '11px', color: '#3a6b1a', background: '#f0f7ee',
          border: '1px solid #9BBB59', borderRadius: '6px', padding: '5px 10px',
          marginBottom: '10px',
        }}>
          🏠 Director del grupo: <strong>{homeroomDirector.full_name}</strong>
        </div>
      )}

      {/* Absence date — only visible if group is assigned */}
      {grade && section && (
        <div className="ge-field" style={{ marginBottom: '10px' }}>
          <label>
            Director ausente hasta
            {isActive && (
              <span style={{
                marginLeft: 8, fontSize: '10px', fontWeight: 700,
                color: '#C0504D', background: '#fdf0f0',
                border: '1px solid #C0504D44', borderRadius: '4px', padding: '1px 6px',
              }}>🔓 ACTIVO — puede editar</span>
            )}
          </label>
          <input type="date" value={absentUntil}
            onChange={e => setAbsentUntil(e.target.value)}
            min={new Date().toISOString().slice(0, 10)} />
          <span style={{ fontSize: '10px', color: '#aaa', marginTop: '2px', display: 'block' }}>
            {absentUntil
              ? isActive
                ? `El co-teacher tiene acceso de edición hasta el ${new Date(absentUntil).toLocaleDateString('es-CO', { day: '2-digit', month: 'long' })}`
                : 'La fecha de ausencia ya pasó — solo tiene acceso de lectura'
              : 'Sin fecha activa — solo puede ver la agenda (sin editar)'}
          </span>
        </div>
      )}

      {!unchanged && (
        <button className="btn-primary" style={{ fontSize: '12px' }}
          onClick={handleSave} disabled={saving}>
          {saving ? '⏳ Guardando…' : '💾 Guardar co-teacher'}
        </button>
      )}
      {unchanged && teacher.coteacher_grade && (
        <div style={{ fontSize: '11px', color: '#2E5598', fontWeight: 600 }}>
          ✅ Co-teacher de: {teacher.coteacher_grade} {teacher.coteacher_section}
          {isActive ? ' · 🔓 Ausencia activa' : ' · 🔒 Solo lectura'}
        </div>
      )}
    </div>
  )
}

// ── RoleAndLevelEditor ─────────────────────────────────────────────────────────
// Inline section inside AssignmentModal for changing role and level.
function RoleAndLevelEditor({ teacher, admin }) {
  const { showToast } = useToast()
  const [role,       setRole]       = useState(teacher.role || 'teacher')
  const [level,      setLevel]      = useState(teacher.level || '')
  const [aiLimit,    setAiLimit]    = useState(String(teacher.ai_monthly_limit || 0))
  const [saving,     setSaving]     = useState(false)

  const ALL_ROLES = [
    { value: 'teacher',       label: '👩‍🏫 Docente' },
    { value: 'admin',         label: '🏫 Coordinador' },
    { value: 'rector',        label: '🎓 Rector' },
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
      .update({ role, level: level || null, ai_monthly_limit: parseInt(aiLimit) || 0 })
      .eq('id', teacher.id)
    setSaving(false)
    if (error) {
      showToast('Error al guardar: ' + error.message, 'error')
    } else {
      showToast(`Guardado: rol ${role}, límite IA ${parseInt(aiLimit) || 0} tok/mes`, 'success')
    }
  }

  const unchanged = role === (teacher.role || 'teacher')
    && level === (teacher.level || '')
    && parseInt(aiLimit) === (teacher.ai_monthly_limit || 0)

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
      <div className="ge-field" style={{ marginBottom: 10 }}>
        <label>⚡ Límite mensual de IA <span style={{ color: '#999', fontWeight: 400 }}>(tokens · 0 = ilimitado)</span></label>
        <input type="number" min="0" step="10000" value={aiLimit}
          onChange={e => setAiLimit(e.target.value)}
          placeholder="0 = ilimitado"
          style={{ maxWidth: '180px' }} />
        {parseInt(aiLimit) > 0 && (
          <span style={{ fontSize: '11px', color: '#8064A2', marginLeft: '8px' }}>
            ≈ {Math.floor(parseInt(aiLimit) / 2000)} generaciones completas
          </span>
        )}
      </div>
      {!unchanged && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary btn-save"
          style={{ fontSize: '12px', padding: '6px 16px' }}
        >
          {saving ? '⏳ Guardando…' : '💾 Guardar rol, nivel y límite IA'}
        </button>
      )}
    </div>
  )
}

// ── TeacherProfileEditor ──────────────────────────────────────────────────────
// Edits full_name and initials of a teacher.
function TeacherProfileEditor({ teacher, isSelf }) {
  const { showToast } = useToast()
  const [fullName,  setFullName]  = useState(teacher.full_name  || '')
  const [initials,  setInitials]  = useState(teacher.initials   || '')
  const [saving,    setSaving]    = useState(false)

  const unchanged = fullName === (teacher.full_name || '') &&
                    initials === (teacher.initials   || '')

  async function handleSave() {
    if (!fullName.trim()) { showToast('El nombre no puede estar vacío', 'error'); return }
    setSaving(true)
    const { error } = await supabase
      .from('teachers')
      .update({ full_name: fullName.trim(), initials: initials.trim().toUpperCase().slice(0, 3) || null })
      .eq('id', teacher.id)
    setSaving(false)
    if (error) {
      showToast('Error al guardar: ' + error.message, 'error')
    } else {
      teacher.full_name = fullName.trim()
      teacher.initials  = initials.trim().toUpperCase().slice(0, 3) || null
      showToast('Datos del docente actualizados', 'success')
    }
  }

  return (
    <div style={{ background: '#f8faff', border: '1.5px solid #d0ddf0', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#2E5598', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '10px' }}>
        👤 Datos del docente
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 10 }}>
        <div className="ge-field">
          <label>Nombre completo</label>
          <input type="text" value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Ej. María González"
            readOnly={isSelf} style={isSelf ? { background: '#f5f5f5', color: '#888' } : {}} />
        </div>
        <div className="ge-field">
          <label>Iniciales <span style={{ color: '#999', fontWeight: 400 }}>(máx. 3)</span></label>
          <input type="text" value={initials}
            onChange={e => setInitials(e.target.value.toUpperCase().slice(0, 3))}
            placeholder="MG"
            readOnly={isSelf} style={isSelf ? { background: '#f5f5f5', color: '#888' } : {}} />
        </div>
      </div>
      <div className="ge-field" style={{ marginBottom: isSelf ? 0 : 10 }}>
        <label>Email institucional <span style={{ color: '#999', fontWeight: 400 }}>(no editable)</span></label>
        <input type="email" value={teacher.email || ''} readOnly
          style={{ background: '#f5f5f5', color: '#888', cursor: 'default' }} />
      </div>
      {!isSelf && !unchanged && (
        <button className="btn-primary btn-save" style={{ fontSize: '12px', padding: '6px 16px' }}
          onClick={handleSave} disabled={saving}>
          {saving ? '⏳ Guardando…' : '💾 Guardar nombre'}
        </button>
      )}
    </div>
  )
}

// ── DeleteTeacherZone ─────────────────────────────────────────────────────────
// Shows a danger zone to delete a teacher only if they have no lesson_plans or news_projects.
// NOTE: deletes from DB only. Auth user deletion requires Edge Function (future).
function DeleteTeacherZone({ teacher, onDeleted }) {
  const { showToast }  = useToast()
  const [checked,  setChecked]  = useState(false)   // has check run?
  const [canDelete, setCanDelete] = useState(false)
  const [counts,   setCounts]   = useState({ plans: 0, news: 0 })
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function checkContent() {
    setExpanded(true)
    if (checked) return
    const [{ count: plans }, { count: news }] = await Promise.all([
      supabase.from('lesson_plans').select('id', { count: 'exact', head: true }).eq('teacher_id', teacher.id),
      supabase.from('news_projects').select('id', { count: 'exact', head: true }).eq('teacher_id', teacher.id),
    ])
    const p = plans || 0, n = news || 0
    setCounts({ plans: p, news: n })
    setCanDelete(p === 0 && n === 0)
    setChecked(true)
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar permanentemente a ${teacher.full_name}?\n\nEsta acción no se puede deshacer.`)) return
    setDeleting(true)
    // Delete assignments first, then teacher row
    await supabase.from('teacher_assignments').delete().eq('teacher_id', teacher.id)
    const { error } = await supabase.from('teachers').delete().eq('id', teacher.id)
    if (error) {
      showToast('Error al eliminar: ' + error.message, 'error')
      setDeleting(false)
      return
    }
    showToast(`${teacher.full_name} eliminado del sistema`, 'success')
    onDeleted()
  }

  return (
    <div style={{ marginTop: '24px' }}>
      <div
        onClick={checkContent}
        style={{
          background: expanded ? '#fff0f0' : '#fdf5f5',
          border: '1.5px solid #f0c0c0', borderRadius: '10px',
          padding: '12px 16px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🗑</span>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#C0504D' }}>
              Eliminar docente
            </div>
            <div style={{ fontSize: '11px', color: '#999' }}>
              Solo si no tiene guías ni proyectos NEWS
            </div>
          </div>
        </div>
        <span style={{ fontSize: '12px', color: '#C0504D', fontWeight: 700 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {expanded && (
        <div style={{
          marginTop: '12px', background: '#fff5f5', border: '1.5px solid #f0c0c0',
          borderRadius: '10px', padding: '14px',
        }}>
          {!checked ? (
            <div style={{ fontSize: '12px', color: '#888' }}>Verificando contenido…</div>
          ) : canDelete ? (
            <>
              <div style={{ fontSize: '12px', color: '#3a6b1a', fontWeight: 600, marginBottom: '10px' }}>
                ✅ Este docente no tiene guías ni proyectos NEWS. Puede eliminarse.
              </div>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '12px' }}>
                Se eliminarán también sus asignaciones de clase. El acceso al sistema quedará bloqueado.
              </div>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  background: '#C0504D', color: '#fff', border: 'none',
                  borderRadius: '8px', padding: '8px 20px', fontSize: '12px',
                  fontWeight: 700, cursor: deleting ? 'default' : 'pointer',
                  opacity: deleting ? 0.7 : 1,
                }}>
                {deleting ? '⏳ Eliminando…' : `🗑 Eliminar a ${teacher.full_name}`}
              </button>
            </>
          ) : (
            <div style={{ fontSize: '12px', color: '#7B1A1A' }}>
              <div style={{ fontWeight: 700, marginBottom: '6px' }}>
                ❌ No se puede eliminar este docente.
              </div>
              <div style={{ color: '#555' }}>
                Tiene contenido activo en el sistema:
                {counts.plans > 0 && <span style={{ display: 'block', marginTop: '4px' }}>📝 {counts.plans} guía{counts.plans !== 1 ? 's' : ''} de clase</span>}
                {counts.news > 0  && <span style={{ display: 'block', marginTop: '4px' }}>📋 {counts.news} proyecto{counts.news !== 1 ? 's' : ''} NEWS</span>}
              </div>
              <div style={{ marginTop: '10px', fontSize: '11px', color: '#888' }}>
                Para eliminar el docente, primero debe eliminarse todo su contenido,
                o reasignarse a otro docente.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
