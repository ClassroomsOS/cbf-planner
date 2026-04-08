import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import useSyllabus from '../hooks/useSyllabus'
import useAchievements from '../hooks/useAchievements'
import { useToast } from '../context/ToastContext'
import { combinedGrade } from '../utils/constants'

// ── Constants ─────────────────────────────────────────────────────────────────

const CONTENT_TYPES = [
  { value: 'grammar',    label: 'Gramática',    icon: '📐', color: '#2E5598' },
  { value: 'vocabulary', label: 'Vocabulario',   icon: '📚', color: '#4BACC6' },
  { value: 'skill',      label: 'Habilidad',     icon: '⚒️', color: '#C0504D' },
  { value: 'value',      label: 'Valor',         icon: '❤️', color: '#C9A84C' },
  { value: 'concept',    label: 'Concepto',      icon: '💡', color: '#8064A2' },
  { value: 'other',      label: 'Otro',          icon: '📎', color: '#888'   },
]

const RESOURCE_TYPES = [
  { value: 'textbook',      label: 'Libro de texto' },
  { value: 'cambridge_one', label: 'Cambridge One' },
  { value: 'workbook',      label: 'Workbook' },
  { value: 'digital',       label: 'Recurso digital' },
  { value: 'other',         label: 'Otro' },
]

function ctInfo(v) {
  return CONTENT_TYPES.find(c => c.value === v) || CONTENT_TYPES[CONTENT_TYPES.length - 1]
}

const CURRENT_YEAR = new Date().getFullYear()
const WEEKS = Array.from({ length: 16 }, (_, i) => i + 1)

// ── Topic Form Modal ──────────────────────────────────────────────────────────

function TopicFormModal({ topic, assignments, goals = [], defaultWeek, defaultPeriod, onSave, onClose }) {
  const subjects = [...new Set(assignments.map(a => a.subject))].sort()

  const [form, setForm] = useState(topic || {
    subject: assignments[0]?.subject || '',
    grade: combinedGrade(assignments[0]),
    period: defaultPeriod || 1,
    week_number: defaultWeek || 1,
    topic: '',
    content_type: 'concept',
    description: '',
    resources: [],
    indicator_id: null,
    academic_year: CURRENT_YEAR,
  })
  const [saving, setSaving] = useState(false)

  // Grados disponibles filtrados por la materia seleccionada
  const grades = [...new Set(
    assignments
      .filter(a => !form.subject || a.subject === form.subject)
      .map(a => combinedGrade(a))
  )].sort()

  function set(k, v) {
    setForm(f => {
      const next = { ...f, [k]: v }
      // Al cambiar materia, auto-seleccionar el primer grado válido y limpiar indicador
      if (k === 'subject') {
        const validGrades = [...new Set(
          assignments.filter(a => a.subject === v).map(a => combinedGrade(a))
        )].sort()
        if (validGrades.length > 0 && !validGrades.includes(f.grade)) {
          next.grade = validGrades[0]
        }
        next.indicator_id = null  // limpiar indicador al cambiar materia
      }
      if (k === 'grade' || k === 'period') {
        next.indicator_id = null  // limpiar indicador si cambia grado o período
      }
      return next
    })
  }

  // Indicadores filtrados por materia, grado y período del form
  const filteredIndicators = goals
    .filter(g => {
      if (g.subject !== form.subject) return false
      if (String(g.period) !== String(form.period)) return false
      // Exact match first; fallback: base grade match for legacy data
      if (g.grade === form.grade) return true
      const gBase = g.grade.replace(/\s+\S+$/, '').trim()
      const fBase = form.grade.replace(/\s+\S+$/, '').trim()
      return gBase === fBase
    })
    .flatMap(g => g.indicators || [])

  const addResource = () => {
    set('resources', [...(form.resources || []), { type: 'textbook', ref: '' }])
  }
  const updateResource = (i, k, v) => {
    const r = [...(form.resources || [])]
    r[i] = { ...r[i], [k]: v }
    set('resources', r)
  }
  const removeResource = (i) => {
    set('resources', (form.resources || []).filter((_, idx) => idx !== i))
  }

  const handleSave = async () => {
    if (!form.topic.trim())   return alert('El tema no puede estar vacío.')
    if (!form.subject.trim()) return alert('Selecciona una asignatura.')
    setSaving(true)
    await onSave({
      ...form,
      resources: (form.resources || []).filter(r => r.ref?.trim()),
    })
    setSaving(false)
  }

  const ct = ctInfo(form.content_type)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(30,40,60,.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 680,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,.2)', overflow: 'hidden',
      }}>

        <div style={{
          padding: '16px 24px', borderBottom: '1px solid #e0e6f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h3 style={{ margin: 0, fontSize: 17, color: '#1F3864', fontWeight: 700 }}>
            {topic?.id ? 'Editar Contenido' : 'Nuevo Contenido del Syllabus'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Subject + Grade */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555', fontWeight: 600 }}>
              Asignatura
              <select value={form.subject} onChange={e => set('subject', e.target.value)}
                style={{ padding: '8px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 14 }}>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555', fontWeight: 600 }}>
              Grado
              <select value={form.grade} onChange={e => set('grade', e.target.value)}
                style={{ padding: '8px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 14 }}>
                {grades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
          </div>

          {/* Period + Week */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555', fontWeight: 600 }}>
              Período
              <select value={form.period} onChange={e => set('period', +e.target.value)}
                style={{ padding: '8px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 14 }}>
                {[1, 2, 3, 4].map(p => <option key={p} value={p}>{p}.° Período</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555', fontWeight: 600 }}>
              Semana
              <select value={form.week_number || ''} onChange={e => set('week_number', +e.target.value)}
                style={{ padding: '8px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 14 }}>
                <option value="">Sin semana</option>
                {WEEKS.map(w => <option key={w} value={w}>Semana {w}</option>)}
              </select>
            </label>
          </div>

          {/* Content type selector */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 8 }}>Tipo de contenido</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {CONTENT_TYPES.map(c => (
                <button key={c.value} type="button"
                  onClick={() => set('content_type', c.value)}
                  style={{
                    padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    border: form.content_type === c.value ? `2px solid ${c.color}` : '2px solid #e0e6f0',
                    background: form.content_type === c.value ? c.color + '18' : '#fff',
                    color: form.content_type === c.value ? c.color : '#888',
                  }}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Topic name */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555', fontWeight: 600 }}>
            Tema / Contenido
            <input value={form.topic} onChange={e => set('topic', e.target.value)}
              placeholder="ej. Simple Past — Regular & Irregular Verbs"
              style={{
                padding: '8px 10px', border: `1px solid ${ct.color}40`,
                borderRadius: 8, fontSize: 14,
              }} />
          </label>

          {/* Description */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555', fontWeight: 600 }}>
            Descripción (opcional)
            <textarea value={form.description || ''} onChange={e => set('description', e.target.value)}
              rows={2} placeholder="Detalle adicional sobre el contenido..."
              style={{ padding: '8px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }} />
          </label>

          {/* Linked indicator — filtrado por materia + grado + período */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555', fontWeight: 600 }}>
            Indicador que jalona este contenido
            {filteredIndicators.length === 0 ? (
              <div style={{ fontSize: 11, color: '#aaa', fontStyle: 'italic', padding: '6px 0' }}>
                Sin indicadores para {form.subject} · {form.grade} · Período {form.period}
              </div>
            ) : (
              <select value={form.indicator_id || ''} onChange={e => set('indicator_id', e.target.value || null)}
                style={{ padding: '8px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 13 }}>
                <option value="">Sin indicador vinculado</option>
                {filteredIndicators.map(i => (
                  <option key={i.id} value={i.id}>
                    [{i.dimension === 'cognitive' ? '🧠' : i.dimension === 'procedural' ? '⚒️' : '❤️'}] {i.text.slice(0, 60)}{i.text.length > 60 ? '…' : ''}
                  </option>
                ))}
              </select>
            )}
          </label>

          {/* Resources */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Recursos</span>
              <button type="button" onClick={addResource}
                style={{ padding: '4px 10px', border: '1.5px dashed #4BACC6', borderRadius: 6, background: '#f0f9fc', color: '#4BACC6', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                + Agregar
              </button>
            </div>
            {(form.resources || []).map((r, i) => (
              <div key={i} style={{ marginBottom: 8, padding: '8px 10px', background: '#f7f9ff', borderRadius: 8, border: '1px solid #e0e6f0' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <select value={r.type} onChange={e => updateResource(i, 'type', e.target.value)}
                    style={{ flex: 1, padding: '5px 8px', border: '1px solid #d0d8e8', borderRadius: 6, fontSize: 12 }}>
                    {RESOURCE_TYPES.map(rt => <option key={rt.value} value={rt.value}>{rt.label}</option>)}
                  </select>
                  <button type="button" onClick={() => removeResource(i)}
                    style={{ padding: '4px 8px', border: 'none', background: '#ffecec', color: '#c33', borderRadius: 6, cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>
                    ✕
                  </button>
                </div>
                <input value={r.ref || ''} onChange={e => updateResource(i, 'ref', e.target.value)}
                  placeholder="ej. Cambridge One pp. 6-11 · Unidad 3"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '5px 8px', border: '1px solid #d0d8e8', borderRadius: 6, fontSize: 12 }} />
              </div>
            ))}
            {(form.resources || []).length === 0 && (
              <p style={{ margin: 0, fontSize: 12, color: '#aaa', fontStyle: 'italic' }}>
                Sin recursos aún. Agrega libros de texto, Cambridge One, etc.
              </p>
            )}
          </div>
        </div>

        <div style={{
          padding: '14px 24px', borderTop: '1px solid #e0e6f0',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
        }}>
          <button onClick={onClose}
            style={{ padding: '9px 20px', border: '1px solid #d0d8e8', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14 }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{
              padding: '9px 20px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14,
              background: saving ? '#aaa' : ct.color, color: '#fff', fontWeight: 700,
            }}>
            {saving ? 'Guardando...' : 'Guardar Contenido'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Period color palette ──────────────────────────────────────────────────────
const PERIOD_COLORS = {
  1: { accent: '#2E5598', light: '#eef3ff', border: '#c5d5f0' },
  2: { accent: '#1A6B3A', light: '#edfaf3', border: '#b8e4cc' },
  3: { accent: '#8064A2', light: '#f4f0ff', border: '#d4c8ef' },
  4: { accent: '#C0504D', light: '#fff3f3', border: '#f0c8c8' },
}
function periodOfWeek(w) {
  if (w <= 4)  return 1
  if (w <= 8)  return 2
  if (w <= 12) return 3
  return 4
}

// ── Week Column ───────────────────────────────────────────────────────────────

function WeekColumn({ week, topics, onNew, onEdit, onDelete, onCopy, onPaste, isCopied, hasPaste }) {
  const period = periodOfWeek(week)
  const pc     = PERIOD_COLORS[period]
  const accentColor = isCopied ? '#4BACC6' : pc.accent

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: `1px solid ${isCopied ? '#4BACC6' : pc.border}`,
      width: 260,
      minWidth: 260,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      boxShadow: isCopied
        ? '0 0 0 2px #4BACC640'
        : '0 1px 4px rgba(30,40,80,.06)',
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: '9px 12px 8px',
        borderBottom: `2px solid ${accentColor}`,
        background: isCopied ? '#EBF7FC' : pc.light,
        borderRadius: '12px 12px 0 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          {/* Week badge */}
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: accentColor, color: '#fff',
            fontSize: 12, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {week}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: accentColor, lineHeight: 1.1 }}>
              Semana {week}
            </div>
            <div style={{ fontSize: 9, color: accentColor + 'AA', fontWeight: 600, lineHeight: 1 }}>
              {topics.length > 0 ? `${topics.length} contenido${topics.length !== 1 ? 's' : ''}` : 'Sin contenidos'}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          {hasPaste && (
            <button type="button" onClick={() => onPaste(week)}
              title="Pegar contenidos copiados"
              style={{
                padding: '3px 8px', border: `1.5px solid #4BACC6`, borderRadius: 6,
                background: '#EBF7FC', color: '#4BACC6', cursor: 'pointer',
                fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
              }}>⬇ Pegar</button>
          )}
          {topics.length > 0 && (
            <button type="button" onClick={() => onCopy(week)}
              title={isCopied ? 'Semana copiada' : 'Copiar semana'}
              style={{
                width: 24, height: 24, border: 'none', borderRadius: 6,
                background: isCopied ? '#4BACC6' : accentColor + '20',
                color: isCopied ? '#fff' : accentColor,
                cursor: 'pointer', fontSize: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>📋</button>
          )}
          <button type="button" onClick={() => onNew(week)}
            title="Agregar contenido"
            style={{
              width: 24, height: 24, border: 'none', borderRadius: 6,
              background: accentColor, color: '#fff',
              cursor: 'pointer', fontSize: 16, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700,
            }}>+</button>
        </div>
      </div>

      {/* ── Topics ── */}
      <div style={{
        padding: '8px', display: 'flex', flexDirection: 'column', gap: 6,
        flex: 1, minHeight: 72,
      }}>
        {topics.length === 0 && (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: '#ccc', fontStyle: 'italic', textAlign: 'center',
            padding: '12px 4px',
          }}>
            Sin contenidos
          </div>
        )}
        {topics.map(t => {
          const ct = ctInfo(t.content_type)
          return (
            <div key={t.id} style={{
              padding: '8px 10px', borderRadius: 8,
              background: ct.color + '0E',
              border: `1px solid ${ct.color}30`,
              position: 'relative',
            }}>
              {/* Type badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 9, fontWeight: 700, color: ct.color,
                background: ct.color + '18', borderRadius: 4, padding: '1px 5px',
                marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.3px',
              }}>
                {ct.icon} {ct.label}
              </div>

              {/* Topic name */}
              <div style={{
                fontSize: 12, color: '#1a2340', fontWeight: 600,
                lineHeight: 1.35, marginBottom: 2,
                overflow: 'hidden', display: '-webkit-box',
                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>
                {t.topic}
              </div>

              {/* Description */}
              {t.description && (
                <div style={{
                  fontSize: 11, color: '#666', lineHeight: 1.3, marginTop: 2,
                  overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>
                  {t.description}
                </div>
              )}

              {/* Footer chips */}
              {(t.resources?.length > 0 || t.indicator) && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
                  {t.resources?.length > 0 && (
                    <span style={{ fontSize: 9, color: '#4BACC6', background: '#e8f7fb', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>
                      📎 {t.resources.length} recurso{t.resources.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {t.indicator && (
                    <span style={{ fontSize: 9, color: '#8064A2', background: '#f4f0ff', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>
                      🎯 Indicador
                    </span>
                  )}
                </div>
              )}

              {/* Edit / Delete */}
              <div style={{
                position: 'absolute', top: 6, right: 6,
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <button type="button" onClick={() => onEdit(t)}
                  style={{
                    width: 20, height: 20, border: '1px solid #d0d8e8', borderRadius: 4,
                    background: '#fff', cursor: 'pointer', fontSize: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555',
                  }}>✎</button>
                <button type="button" onClick={() => onDelete(t.id)}
                  style={{
                    width: 20, height: 20, border: '1px solid #ffcdd2', borderRadius: 4,
                    background: '#fff5f5', cursor: 'pointer', fontSize: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c33',
                  }}>✕</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SyllabusPage({ teacher }) {
  const { showToast } = useToast()

  // Filters
  const [filterSubject, setFilterSubject] = useState('')
  const [filterGrade,   setFilterGrade]   = useState('')
  const [filterPeriod,  setFilterPeriod]  = useState(1)

  // Assignments
  const [assignments, setAssignments] = useState([])

  // Modal
  const [topicModal, setTopicModal] = useState(null)  // null | 'new' | topicObj | { week }

  // Clipboard: copy/paste semanas
  const [copiedWeek, setCopiedWeek] = useState(null)  // { fromWeek, topics[] } | null

  // Hooks
  const {
    topics, byWeek, loading, error, refetch,
    createTopic, updateTopic, deleteTopic,
  } = useSyllabus(teacher, {
    subject: filterSubject || undefined,
    grade:   filterGrade   || undefined,
    period:  filterPeriod,
    academic_year: CURRENT_YEAR,
  })

  // Load ALL goals (all subjects) so the modal can filter by form.subject/grade/period
  const { goals } = useAchievements(teacher, {
    academic_year: CURRENT_YEAR,
  })

  // Load assignments
  useEffect(() => {
    if (!teacher?.id) return
    supabase
      .from('teacher_assignments')
      .select('subject, grade, section')
      .eq('teacher_id', teacher.id)
      .eq('school_id', teacher.school_id)
      .then(({ data }) => {
        const rows = data || []
        setAssignments(rows)
        if (!filterSubject && rows.length > 0) setFilterSubject(rows[0].subject)
        if (!filterGrade   && rows.length > 0) setFilterGrade(rows[0].grade) // grado base sin sección
      })
  }, [teacher?.id])

  const uniqueSubjects = useMemo(() =>
    [...new Set(assignments.map(a => a.subject))].sort(), [assignments]
  )
  const uniqueGrades = useMemo(() =>
    [...new Set(assignments.map(a => combinedGrade(a)))].sort(), [assignments]
  )

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSaveTopic = async (form) => {
    const isEdit = !!form.id
    const normalized = { ...form, grade: form.grade }
    const { error: err } = isEdit
      ? await updateTopic(form.id, normalized)
      : await createTopic(normalized)
    if (err) { showToast(err, 'error'); return }
    showToast(isEdit ? 'Contenido actualizado' : 'Contenido agregado', 'success')
    setTopicModal(null)
  }

  const handleDeleteTopic = async (id) => {
    if (!confirm('¿Eliminar este contenido?')) return
    const { error: err } = await deleteTopic(id)
    if (err) { showToast(err, 'error'); return }
    showToast('Contenido eliminado', 'success')
  }

  // ── Copy / Paste semana ────────────────────────────────────────────────────
  const handleCopyWeek = (week) => {
    const topics = byWeek[week] || []
    if (!topics.length) return
    setCopiedWeek({ fromWeek: week, topics })
    showToast(`Semana ${week} copiada — ${topics.length} contenido${topics.length !== 1 ? 's' : ''}`, 'info')
  }

  const handlePasteWeek = async (toWeek) => {
    if (!copiedWeek?.topics?.length) return
    const results = await Promise.all(
      copiedWeek.topics.map(t => {
        // strip id, timestamps y campos joined (indicator) — solo columnas reales de la tabla
        const { id, week_number, created_at, updated_at, indicator, ...rest } = t
        return createTopic({ ...rest, week_number: toWeek })
      })
    )
    const failed = results.filter(r => r.error).length
    if (failed) {
      showToast(`${failed} contenido(s) no se pudieron pegar`, 'error')
    } else {
      showToast(`${copiedWeek.topics.length} contenido${copiedWeek.topics.length !== 1 ? 's' : ''} pegado${copiedWeek.topics.length !== 1 ? 's' : ''} en Semana ${toWeek}`, 'success')
    }
  }

  // Topic modal with pre-filled week
  const openNewTopic = (week) => {
    setTopicModal({
      isNew: true,
      subject: filterSubject,
      grade: filterGrade,
      period: filterPeriod,
      week_number: week,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f4f6fb' }}>

      {/* ── Header ── */}
      <div style={{
        padding: '16px 24px', background: '#fff', borderBottom: '1px solid #e0e6f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: '#1F3864', fontWeight: 700 }}>📚 Syllabus de Contenidos</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#888' }}>
            Plan de estudios por semana — {CURRENT_YEAR}
          </p>
        </div>
        <button onClick={() => setTopicModal({ isNew: true, subject: filterSubject, grade: filterGrade, period: filterPeriod })}
          style={{
            padding: '10px 20px', background: '#2E5598', color: '#fff',
            border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>
          + Nuevo Contenido
        </button>
      </div>

      {/* ── Filters ── */}
      <div style={{
        padding: '12px 24px', background: '#fff', borderBottom: '1px solid #e0e6f0',
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 13 }}>
          <option value="">Asignatura...</option>
          {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 13 }}>
          <option value="">Grado...</option>
          {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={filterPeriod} onChange={e => setFilterPeriod(+e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 13 }}>
          {[1, 2, 3, 4].map(p => <option key={p} value={p}>{p}.° Período</option>)}
        </select>
        <span style={{ fontSize: 13, color: '#888', marginLeft: 8 }}>
          {topics.length} contenido{topics.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Kanban grid by week ── */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', padding: '16px 24px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: '#888', fontSize: 15 }}>
            Cargando syllabus...
          </div>
        )}
        {error && (
          <div style={{ padding: 16, background: '#fff0f0', borderRadius: 10, border: '1px solid #ffcdd2', color: '#c33', fontSize: 14 }}>
            Error: {error}
          </div>
        )}
        {!loading && !error && (
          <>
            {/* Week 0 = topics without week */}
            {(byWeek[0] || []).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#aaa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  Sin semana asignada
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {(byWeek[0] || []).map(t => {
                    const ct = ctInfo(t.content_type)
                    return (
                      <div key={t.id} style={{
                        padding: '8px 12px', borderRadius: 8, background: '#fff',
                        border: `1px solid ${ct.color}30`, fontSize: 13, color: '#1F3864',
                      }}>
                        {ct.icon} {t.topic}
                        <button type="button" onClick={() => setTopicModal(t)}
                          style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 12 }}>✎</button>
                        <button type="button" onClick={() => handleDeleteTopic(t.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c33', fontSize: 12 }}>✕</button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Weeks 1–16 */}
            {!filterSubject && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#aaa' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📚</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#888' }}>
                  Selecciona una asignatura para ver el syllabus
                </div>
              </div>
            )}
            {filterSubject && (
              <>
                {/* Copy banner */}
                {copiedWeek && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: '#EBF7FC', border: '1px solid #4BACC6',
                    borderRadius: 8, padding: '8px 14px', marginBottom: 14,
                    fontSize: 13, color: '#0E6E8C',
                  }}>
                    <span>📋 Semana {copiedWeek.fromWeek} copiada — {copiedWeek.topics.length} contenido{copiedWeek.topics.length !== 1 ? 's' : ''}. Presiona <strong>⬇ Pegar</strong> en cualquier semana.</span>
                    <button type="button" onClick={() => setCopiedWeek(null)}
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#4BACC6', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>✕</button>
                  </div>
                )}

                {/* Kanban — scroll horizontal */}
                <div style={{
                  overflowX: 'auto', overflowY: 'visible',
                  paddingBottom: 16,
                  /* scrollbar siempre visible en webkit */
                  WebkitOverflowScrolling: 'touch',
                }}>
                  {/* Period groups side by side */}
                  <div style={{ display: 'flex', gap: 0, width: 'max-content' }}>
                    {[1, 2, 3, 4].map(p => {
                      const pc       = PERIOD_COLORS[p]
                      const pWeeks   = WEEKS.filter(w => periodOfWeek(w) === p)
                      const pTopics  = pWeeks.reduce((acc, w) => acc + (byWeek[w]?.length || 0), 0)
                      return (
                        <div key={p} style={{
                          display: 'flex', flexDirection: 'column',
                          borderRight: p < 4 ? '2px dashed #e0e6f0' : 'none',
                          paddingRight: p < 4 ? 16 : 0,
                          marginRight: p < 4 ? 16 : 0,
                        }}>
                          {/* Period label */}
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
                          }}>
                            <div style={{
                              height: 3, width: 28, borderRadius: 2, background: pc.accent,
                            }} />
                            <span style={{
                              fontSize: 11, fontWeight: 800, color: pc.accent,
                              textTransform: 'uppercase', letterSpacing: '.6px',
                            }}>
                              {p}.° Período
                            </span>
                            <span style={{
                              fontSize: 10, color: pc.accent + '99', fontWeight: 600,
                            }}>
                              · {pTopics} contenido{pTopics !== 1 ? 's' : ''}
                            </span>
                          </div>

                          {/* Week columns for this period */}
                          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            {pWeeks.map(w => (
                              <WeekColumn
                                key={w}
                                week={w}
                                topics={byWeek[w] || []}
                                onNew={openNewTopic}
                                onEdit={t => setTopicModal(t)}
                                onDelete={handleDeleteTopic}
                                onCopy={handleCopyWeek}
                                onPaste={handlePasteWeek}
                                isCopied={copiedWeek?.fromWeek === w}
                                hasPaste={!!copiedWeek && copiedWeek.fromWeek !== w}
                              />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Topic modal ── */}
      {topicModal && (
        <TopicFormModal
          topic={topicModal.isNew ? null : topicModal}
          assignments={assignments}
          goals={goals}
          defaultWeek={topicModal.week_number}
          defaultPeriod={filterPeriod}
          onSave={handleSaveTopic}
          onClose={() => setTopicModal(null)}
        />
      )}
    </div>
  )
}
