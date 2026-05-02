// ── MicroActivityModal.jsx ─────────────────────────────────────────────────
// Quick modal to create a micro-activity. Supports individual or group mode.
// When group_mode=true, shows UI to build teams from the student roster.

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabase'
import { displayName } from '../utils/studentUtils'
import { useToast } from '../context/ToastContext'

const CATEGORY_OPTIONS = [
  { value: 'general',     label: '📋 General',      desc: 'Cuaderno, participación, tareas' },
  { value: 'cognitiva',   label: '📝 Cognitiva',   desc: 'Talleres, Quiz, Proyectos' },
  { value: 'digital',     label: '💻 Digital',      desc: 'Cambridge, plataformas digitales' },
  { value: 'axiologica',  label: '✝️ Axiológica',   desc: 'Valores, comportamiento, identidad' },
]

export default function MicroActivityModal({ teacher, grade, section, subject, period, students, onCreated, onClose }) {
  const { showToast } = useToast()
  const [step, setStep] = useState(1) // 1=details, 2=groups (if group_mode)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'cognitiva',
    rubric_type: 'simple',
    group_mode: false,
    activity_date: new Date().toISOString().split('T')[0],
  })

  // Group building state
  const [groups, setGroups] = useState([])
  const [groupSize, setGroupSize] = useState(3)

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  // ── Auto-generate groups ────────────────────────────────────────────────────
  function autoGenerateGroups() {
    const shuffled = [...students].sort(() => Math.random() - 0.5)
    const result = []
    let groupNum = 1
    for (let i = 0; i < shuffled.length; i += groupSize) {
      result.push({
        label: `Equipo ${groupNum}`,
        studentIds: shuffled.slice(i, i + groupSize).map(s => s.id),
      })
      groupNum++
    }
    setGroups(result)
  }

  function removeFromGroup(groupIdx, studentId) {
    setGroups(prev => prev.map((g, i) =>
      i === groupIdx ? { ...g, studentIds: g.studentIds.filter(id => id !== studentId) } : g
    ))
  }

  function addToGroup(groupIdx, studentId) {
    // Remove from any other group first
    setGroups(prev => prev.map((g, i) => ({
      ...g,
      studentIds: i === groupIdx
        ? [...g.studentIds, studentId]
        : g.studentIds.filter(id => id !== studentId),
    })))
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!form.name.trim()) { showToast('Nombre es requerido', 'error'); return }
    setSaving(true)

    // Insert micro_activity
    const { data: micro, error } = await supabase.from('micro_activities').insert({
      school_id: teacher.school_id,
      teacher_id: teacher.id,
      grade, section, subject, period,
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category,
      group_mode: form.group_mode,
      rubric_type: form.rubric_type,
      activity_date: form.activity_date || null,
    }).select().single()

    if (error) { showToast('Error creando actividad', 'error'); setSaving(false); return }

    // Insert groups if group_mode
    if (form.group_mode && groups.length > 0) {
      const groupRows = groups
        .filter(g => g.studentIds.length > 0)
        .map(g => ({
          micro_activity_id: micro.id,
          group_label: g.label,
          student_ids: g.studentIds,
        }))

      if (groupRows.length) {
        const { error: gErr } = await supabase.from('micro_activity_groups').insert(groupRows)
        if (gErr) showToast('Grupos creados con advertencias', 'warning')
      }
    }

    setSaving(false)
    onCreated(micro)
  }

  const studentMap = Object.fromEntries(students.map(s => [s.id, s]))
  const assignedIds = new Set(groups.flatMap(g => g.studentIds))
  const unassigned = students.filter(s => !assignedIds.has(s.id))

  const modal = (
    <div className="mam-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mam-modal">
        <div className="mam-header">
          <h3>+ Nueva Micro-actividad</h3>
          <button className="mam-close" onClick={onClose}>&times;</button>
        </div>

        {step === 1 && (
          <div className="mam-body">
            <div className="mam-field">
              <label>Nombre *</label>
              <input
                value={form.name}
                onChange={e => update('name', e.target.value)}
                placeholder="Ej: Revisión cuaderno U3"
                autoFocus
              />
            </div>

            <div className="mam-field">
              <label>Descripción</label>
              <input
                value={form.description}
                onChange={e => update('description', e.target.value)}
                placeholder="Opcional"
              />
            </div>

            <div className="mam-row">
              <div className="mam-field" style={{ flex: 1 }}>
                <label>Categoría</label>
                <select value={form.category} onChange={e => update('category', e.target.value)}>
                  {CATEGORY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="mam-field" style={{ flex: 1 }}>
                <label>Fecha</label>
                <input type="date" value={form.activity_date} onChange={e => update('activity_date', e.target.value)} />
              </div>
            </div>

            <div className="mam-row">
              <div className="mam-field" style={{ flex: 1 }}>
                <label>Tipo de rúbrica</label>
                <select value={form.rubric_type} onChange={e => update('rubric_type', e.target.value)}>
                  <option value="simple">Simple (Básico → Logrado)</option>
                  <option value="numeric">Numérica (1.0 – 5.0)</option>
                </select>
              </div>
              <div className="mam-field" style={{ flex: 1 }}>
                <label>Modo</label>
                <div className="mam-toggle-row">
                  <button
                    className={`mam-toggle ${!form.group_mode ? 'active' : ''}`}
                    onClick={() => update('group_mode', false)}
                  >👤 Individual</button>
                  <button
                    className={`mam-toggle ${form.group_mode ? 'active' : ''}`}
                    onClick={() => update('group_mode', true)}
                  >👥 Grupal</button>
                </div>
              </div>
            </div>

            <div className="mam-footer">
              {form.group_mode ? (
                <button className="mam-next-btn" onClick={() => { autoGenerateGroups(); setStep(2) }} disabled={!form.name.trim()}>
                  Siguiente → Armar equipos
                </button>
              ) : (
                <button className="mam-save-btn" onClick={handleSave} disabled={saving || !form.name.trim()}>
                  {saving ? 'Guardando...' : '✓ Crear actividad'}
                </button>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mam-body">
            <div className="mam-groups-header">
              <span>Equipos de <strong>{groupSize}</strong> estudiantes</span>
              <div className="mam-group-size">
                {[2,3,4,5].map(n => (
                  <button
                    key={n}
                    className={`mam-size-btn ${groupSize === n ? 'active' : ''}`}
                    onClick={() => { setGroupSize(n); autoGenerateGroups() }}
                  >{n}</button>
                ))}
              </div>
              <button className="mam-shuffle-btn" onClick={autoGenerateGroups}>🔀 Mezclar</button>
            </div>

            <div className="mam-groups-grid">
              {groups.map((group, gi) => (
                <div key={gi} className="mam-group-card">
                  <input
                    className="mam-group-label"
                    value={group.label}
                    onChange={e => setGroups(prev => prev.map((g, i) => i === gi ? { ...g, label: e.target.value } : g))}
                  />
                  <div className="mam-group-members">
                    {group.studentIds.map(sid => {
                      const s = studentMap[sid]
                      if (!s) return null
                      return (
                        <div key={sid} className="mam-member">
                          <span>{displayName(s)}</span>
                          <button onClick={() => removeFromGroup(gi, sid)}>&times;</button>
                        </div>
                      )
                    })}
                  </div>
                  {/* Drop zone for unassigned */}
                  {unassigned.length > 0 && (
                    <select
                      className="mam-add-member"
                      value=""
                      onChange={e => { if (e.target.value) addToGroup(gi, e.target.value) }}
                    >
                      <option value="">+ Agregar...</option>
                      {unassigned.map(s => (
                        <option key={s.id} value={s.id}>{displayName(s)}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>

            {unassigned.length > 0 && (
              <div className="mam-unassigned">
                ⚠️ {unassigned.length} estudiante(s) sin equipo
              </div>
            )}

            <div className="mam-footer">
              <button className="mam-back-btn" onClick={() => setStep(1)}>← Volver</button>
              <button className="mam-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : '✓ Crear con equipos'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
