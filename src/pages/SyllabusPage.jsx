import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import useSyllabus, { validateUnitWeekRule } from '../hooks/useSyllabus'
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

const PERIOD_COLORS = {
  1: { accent: '#2E5598', light: '#eef3ff', border: '#c5d5f0' },
  2: { accent: '#1A6B3A', light: '#edfaf3', border: '#b8e4cc' },
  3: { accent: '#8064A2', light: '#f4f0ff', border: '#d4c8ef' },
  4: { accent: '#C0504D', light: '#fff3f3', border: '#f0c8c8' },
}

function ctInfo(v) {
  return CONTENT_TYPES.find(c => c.value === v) || CONTENT_TYPES[CONTENT_TYPES.length - 1]
}
function rtLabel(v) {
  return RESOURCE_TYPES.find(r => r.value === v)?.label || v
}

const CURRENT_YEAR = new Date().getFullYear()
const MAX_WEEKS    = 40
const UNIT_SUBJECTS = ['Language Arts', 'Science']

// ── Topic Form Modal ──────────────────────────────────────────────────────────

function TopicFormModal({ topic, assignments, goals = [], defaultWeek, defaultPeriod, onSave, onClose }) {
  const subjects = [...new Set(assignments.map(a => a.subject))].sort()

  const [form, setForm] = useState(topic || {
    subject:      assignments[0]?.subject || '',
    grade:        combinedGrade(assignments[0]),
    period:       defaultPeriod || 1,
    week_number:  defaultWeek   || 1,
    topic:        '',
    content_type: 'concept',
    description:  '',
    resources:    [],
    indicator_id: null,
    academic_year: CURRENT_YEAR,
    unit_number:  null,
    subunit:      '',
  })
  const [saving, setSaving] = useState(false)

  const grades = [...new Set(
    assignments
      .filter(a => !form.subject || a.subject === form.subject)
      .map(a => combinedGrade(a))
  )].sort()

  function set(k, v) {
    setForm(f => {
      const next = { ...f, [k]: v }
      if (k === 'subject') {
        const validGrades = [...new Set(
          assignments.filter(a => a.subject === v).map(a => combinedGrade(a))
        )].sort()
        if (validGrades.length > 0 && !validGrades.includes(f.grade)) next.grade = validGrades[0]
        next.indicator_id = null
      }
      if (k === 'grade' || k === 'period') next.indicator_id = null
      return next
    })
  }

  const filteredIndicators = goals
    .filter(g => {
      if (g.subject !== form.subject) return false
      if (String(g.period) !== String(form.period)) return false
      if (g.grade === form.grade) return true
      const gBase = g.grade.replace(/\s+\S+$/, '').trim()
      const fBase = form.grade.replace(/\s+\S+$/, '').trim()
      return gBase === fBase
    })
    .flatMap(g => g.indicators || [])

  const addResource    = () => set('resources', [...(form.resources || []), { type: 'textbook', ref: '' }])
  const updateResource = (i, k, v) => {
    const r = [...(form.resources || [])]
    r[i] = { ...r[i], [k]: v }
    set('resources', r)
  }
  const removeResource = (i) => set('resources', (form.resources || []).filter((_, idx) => idx !== i))

  const handleSave = async () => {
    if (!form.topic.trim())   return alert('El tema no puede estar vacío.')
    if (!form.subject.trim()) return alert('Selecciona una asignatura.')
    setSaving(true)
    await onSave({
      ...form,
      resources:   (form.resources || []).filter(r => r.ref?.trim()),
      unit_number: form.unit_number || null,
      subunit:     form.subunit || null,
    })
    setSaving(false)
  }

  const ct          = ctInfo(form.content_type)
  const showUnits   = UNIT_SUBJECTS.includes(form.subject)
  const showSubunit = form.subject === 'Language Arts'

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(30,40,60,.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 700,
        maxHeight: '94vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,.2)', overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid #e0e6f0',
          background: ct.color + '0C',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, color: '#1F3864', fontWeight: 700 }}>
              {topic?.id ? 'Editar Contenido' : 'Nuevo Contenido del Syllabus'}
            </h3>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              {ct.icon} {ct.label}
              {form.unit_number ? ` · Unidad ${form.unit_number}` : ''}
              {form.week_number ? ` · Semana ${form.week_number}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Subject + Grade */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={labelStyle}>
              Asignatura
              <select value={form.subject} onChange={e => set('subject', e.target.value)} style={selectStyle}>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label style={labelStyle}>
              Grado
              <select value={form.grade} onChange={e => set('grade', e.target.value)} style={selectStyle}>
                {grades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
          </div>

          {/* Period + Week */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={labelStyle}>
              Período
              <select value={form.period} onChange={e => set('period', +e.target.value)} style={selectStyle}>
                {[1, 2, 3, 4, 5, 6].map(p => <option key={p} value={p}>{p}.° Período</option>)}
              </select>
            </label>
            <label style={labelStyle}>
              Semana
              <select value={form.week_number || ''} onChange={e => set('week_number', +e.target.value || null)} style={selectStyle}>
                <option value="">Sin semana</option>
                {Array.from({ length: MAX_WEEKS }, (_, i) => i + 1).map(w =>
                  <option key={w} value={w}>Semana {w}</option>
                )}
              </select>
            </label>
          </div>

          {/* Unit + Subunit — Language Arts y Science */}
          {showUnits && (
            <div style={{ display: 'grid', gridTemplateColumns: showSubunit ? '1fr 1fr' : '1fr', gap: 12 }}>
              <label style={labelStyle}>
                Unidad
                <input type="number" min="1" max="30"
                  value={form.unit_number || ''}
                  onChange={e => set('unit_number', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="ej. 1"
                  style={inputStyle} />
              </label>
              {showSubunit && (
                <label style={labelStyle}>
                  Subunidad Cambridge (ej. 1.1)
                  <input type="text"
                    value={form.subunit || ''}
                    onChange={e => set('subunit', e.target.value || null)}
                    placeholder="ej. 1.1"
                    style={inputStyle} />
                </label>
              )}
            </div>
          )}

          {/* Content type */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 8 }}>Tipo de contenido</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {CONTENT_TYPES.map(c => (
                <button key={c.value} type="button"
                  onClick={() => set('content_type', c.value)}
                  style={{
                    padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    border:      form.content_type === c.value ? `2px solid ${c.color}` : '2px solid #e0e6f0',
                    background:  form.content_type === c.value ? c.color + '18' : '#fff',
                    color:       form.content_type === c.value ? c.color : '#888',
                  }}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Topic name */}
          <label style={labelStyle}>
            Tema / Título del contenido
            <input value={form.topic} onChange={e => set('topic', e.target.value)}
              placeholder="ej. Simple Past — Regular & Irregular Verbs"
              style={{ ...inputStyle, borderColor: ct.color + '60', fontSize: 15, fontWeight: 600 }} />
          </label>

          {/* Description — ampliada, para pegar contenido teórico */}
          <label style={labelStyle}>
            <span>
              Contenido teórico
              <span style={{ fontWeight: 400, color: '#aaa', marginLeft: 6, fontSize: 11 }}>
                — vocabulario, reglas, conceptos clave, ejemplos…
              </span>
            </span>
            <textarea
              value={form.description || ''}
              onChange={e => set('description', e.target.value)}
              rows={7}
              placeholder={
                ct.value === 'grammar'    ? 'Ej:\nAffirmative: S + V(s/es)\nNegative: S + don\'t/doesn\'t + V\nQuestion: Do/Does + S + V?\n\nExamples:\n- She goes to school every day.\n- He doesn\'t like pizza.' :
                ct.value === 'vocabulary' ? 'Ej:\ngo to school\ndo homework\ncook dinner\ntake a shower\nbrush teeth\nwake up early' :
                'Describe el contenido, pega el texto del libro, lista los puntos clave...'
              }
              style={{
                padding: '10px 12px', border: '1px solid #d0d8e8', borderRadius: 8,
                fontSize: 13, resize: 'vertical', fontFamily: 'inherit',
                lineHeight: 1.7, color: '#1a2340',
                minHeight: 120,
              }} />
          </label>

          {/* Linked indicator */}
          <label style={labelStyle}>
            Indicador que jalona este contenido
            {filteredIndicators.length === 0 ? (
              <div style={{ fontSize: 11, color: '#aaa', fontStyle: 'italic', padding: '6px 0' }}>
                Sin indicadores para {form.subject} · {form.grade} · Período {form.period}
              </div>
            ) : (
              <select value={form.indicator_id || ''} onChange={e => set('indicator_id', e.target.value || null)} style={selectStyle}>
                <option value="">Sin indicador vinculado</option>
                {filteredIndicators.map(i => (
                  <option key={i.id} value={i.id}>
                    [{i.dimension === 'cognitive' ? '🧠' : i.dimension === 'procedural' ? '⚒️' : '❤️'}] {i.text.slice(0, 70)}{i.text.length > 70 ? '…' : ''}
                  </option>
                ))}
              </select>
            )}
          </label>

          {/* Resources */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>Recursos / Referencias</span>
              <button type="button" onClick={addResource}
                style={{ padding: '4px 12px', border: '1.5px dashed #4BACC6', borderRadius: 6, background: '#f0f9fc', color: '#4BACC6', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
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

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid #e0e6f0',
          display: 'flex', gap: 10, justifyContent: 'flex-end', background: '#fafbff',
        }}>
          <button onClick={onClose}
            style={{ padding: '9px 20px', border: '1px solid #d0d8e8', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14 }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{
              padding: '9px 24px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14,
              background: saving ? '#aaa' : ct.color, color: '#fff', fontWeight: 700,
            }}>
            {saving ? 'Guardando...' : 'Guardar Contenido'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Shared micro-styles ───────────────────────────────────────────────────────
const labelStyle  = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, color: '#555', fontWeight: 600 }
const selectStyle = { padding: '8px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 14, background: '#fff' }
const inputStyle  = { padding: '8px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 14 }

// ── Week Column (vista Semanas) ───────────────────────────────────────────────

function WeekColumn({ week, topics, pc, onNew, onEdit, onDelete, onCopy, onPaste, isCopied, hasPaste }) {
  const accentColor = isCopied ? '#4BACC6' : pc.accent

  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: `1px solid ${isCopied ? '#4BACC6' : pc.border}`,
      width: 260, minWidth: 260, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      boxShadow: isCopied ? '0 0 0 2px #4BACC640' : '0 1px 4px rgba(30,40,80,.06)',
    }}>
      {/* Header */}
      <div style={{
        padding: '9px 12px 8px', borderBottom: `2px solid ${accentColor}`,
        background: isCopied ? '#EBF7FC' : pc.light, borderRadius: '12px 12px 0 0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: accentColor, color: '#fff',
            fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {week}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: accentColor, lineHeight: 1.1 }}>Semana {week}</div>
            <div style={{ fontSize: 9, color: accentColor + 'AA', fontWeight: 600, lineHeight: 1 }}>
              {topics.length > 0 ? `${topics.length} contenido${topics.length !== 1 ? 's' : ''}` : 'Sin contenidos'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          {hasPaste && (
            <button type="button" onClick={() => onPaste(week)} title="Pegar contenidos copiados"
              style={{ padding: '3px 8px', border: '1.5px solid #4BACC6', borderRadius: 6, background: '#EBF7FC', color: '#4BACC6', cursor: 'pointer', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
              ⬇ Pegar
            </button>
          )}
          {topics.length > 0 && (
            <button type="button" onClick={() => onCopy(week)} title={isCopied ? 'Semana copiada' : 'Copiar semana'}
              style={{ width: 24, height: 24, border: 'none', borderRadius: 6, background: isCopied ? '#4BACC6' : accentColor + '20', color: isCopied ? '#fff' : accentColor, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              📋
            </button>
          )}
          <button type="button" onClick={() => onNew(week)} title="Agregar contenido"
            style={{ width: 24, height: 24, border: 'none', borderRadius: 6, background: accentColor, color: '#fff', cursor: 'pointer', fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
            +
          </button>
        </div>
      </div>

      {/* Topics */}
      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 72 }}>
        {topics.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#ccc', fontStyle: 'italic', textAlign: 'center', padding: '12px 4px' }}>
            Sin contenidos
          </div>
        )}
        {topics.map(t => {
          const ct = ctInfo(t.content_type)
          return (
            <div key={t.id} style={{ padding: '8px 10px', borderRadius: 8, background: ct.color + '0E', border: `1px solid ${ct.color}30`, position: 'relative' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, color: ct.color, background: ct.color + '18', borderRadius: 4, padding: '1px 5px', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.3px' }}>
                {ct.icon} {ct.label}
                {t.unit_number ? ` · U${t.unit_number}` : ''}
              </div>
              <div style={{ fontSize: 12, color: '#1a2340', fontWeight: 600, lineHeight: 1.35, marginBottom: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {t.topic}
              </div>
              {t.description && (
                <div style={{ fontSize: 11, color: '#666', lineHeight: 1.3, marginTop: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {t.description}
                </div>
              )}
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
              <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button type="button" onClick={() => onEdit(t)}
                  style={{ width: 20, height: 20, border: '1px solid #d0d8e8', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>✎</button>
                <button type="button" onClick={() => onDelete(t.id)}
                  style={{ width: 20, height: 20, border: '1px solid #ffcdd2', borderRadius: 4, background: '#fff5f5', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c33' }}>✕</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Topic Detail Card (vista Contenido) ──────────────────────────────────────

function TopicDetailCard({ topic, onEdit, onDelete }) {
  const ct = ctInfo(topic.content_type)
  return (
    <div style={{
      display: 'flex', gap: 0, borderTop: '1px solid #f0f3fa',
      background: '#fff',
      transition: 'background .15s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = '#fafbff'}
      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
    >
      {/* Color bar */}
      <div style={{ width: 4, background: ct.color, flexShrink: 0, borderRadius: '0 0 0 0' }} />

      {/* Content */}
      <div style={{ flex: 1, padding: '14px 16px', minWidth: 0 }}>
        {/* Chips row */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: ct.color, background: ct.color + '15',
            borderRadius: 4, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '.4px',
          }}>
            {ct.icon} {ct.label}
          </span>
          {topic.week_number && (
            <span style={{ fontSize: 10, color: '#666', background: '#f0f2f8', borderRadius: 4, padding: '2px 7px', fontWeight: 600 }}>
              Sem. {topic.week_number}
            </span>
          )}
          {topic.subunit && (
            <span style={{ fontSize: 10, color: '#4BACC6', background: '#e8f7fb', borderRadius: 4, padding: '2px 7px', fontWeight: 600 }}>
              {topic.subunit}
            </span>
          )}
          {topic.indicator && (
            <span style={{ fontSize: 10, color: '#8064A2', background: '#f4f0ff', borderRadius: 4, padding: '2px 7px', fontWeight: 600 }}>
              🎯 {topic.indicator.text?.slice(0, 50)}{topic.indicator.text?.length > 50 ? '…' : ''}
            </span>
          )}
        </div>

        {/* Title */}
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2340', lineHeight: 1.4, marginBottom: topic.description ? 8 : 0 }}>
          {topic.topic}
        </div>

        {/* Description — completa, preserva saltos de línea */}
        {topic.description && (
          <div style={{
            fontSize: 13, color: '#444', lineHeight: 1.75,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            background: '#f7f9ff', borderRadius: 6, padding: '8px 12px',
            border: '1px solid #e8ebf5',
            fontFamily: 'ui-monospace, monospace',
            marginTop: 4,
          }}>
            {topic.description}
          </div>
        )}

        {/* Resources */}
        {topic.resources?.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {topic.resources.map((r, i) => (
              <span key={i} style={{
                fontSize: 11, color: '#555', background: '#f0f4ff',
                border: '1px solid #d0d8ee', borderRadius: 5, padding: '3px 8px',
              }}>
                📎 <strong>{rtLabel(r.type)}:</strong> {r.ref}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 12px 12px 0', flexShrink: 0, justifyContent: 'flex-start' }}>
        <button type="button" onClick={() => onEdit(topic)}
          title="Editar"
          style={{ width: 28, height: 28, border: '1px solid #d0d8e8', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
          ✎
        </button>
        <button type="button" onClick={() => onDelete(topic.id)}
          title="Eliminar"
          style={{ width: 28, height: 28, border: '1px solid #ffcdd2', borderRadius: 6, background: '#fff5f5', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c33' }}>
          ✕
        </button>
      </div>
    </div>
  )
}

// ── Content List View (vista Contenido) ──────────────────────────────────────

function ContentListView({ topics, filterSubject, pc, onEdit, onDelete, onNew, filterPeriod }) {
  const hasUnits   = UNIT_SUBJECTS.includes(filterSubject) && topics.some(t => t.unit_number)
  const [expanded, setExpanded] = useState(() => new Set(['__all__']))  // start all expanded

  // Build groups
  const groups = useMemo(() => {
    if (hasUnits) {
      const map = {}
      topics.forEach(t => {
        const k = t.unit_number ?? 0
        if (!map[k]) map[k] = []
        map[k].push(t)
      })
      return Object.entries(map)
        .sort(([a], [b]) => +a - +b)
        .map(([k, ts]) => ({
          key:    k,
          icon:   k === '0' ? '📌' : '📗',
          label:  k === '0' ? 'Sin unidad asignada' : `Unidad ${k}`,
          topics: ts.slice().sort((a, b) => (a.week_number || 99) - (b.week_number || 99)),
        }))
    } else {
      // Group by content_type, preserving CONTENT_TYPES order
      const map = {}
      topics.forEach(t => {
        const k = t.content_type
        if (!map[k]) map[k] = []
        map[k].push(t)
      })
      return CONTENT_TYPES
        .filter(ct => map[ct.value])
        .map(ct => ({
          key:    ct.value,
          icon:   ct.icon,
          label:  ct.label,
          color:  ct.color,
          topics: map[ct.value].slice().sort((a, b) => (a.week_number || 99) - (b.week_number || 99)),
        }))
    }
  }, [topics, hasUnits])

  // Sync expanded set: if we get new groups, auto-expand them
  useEffect(() => {
    setExpanded(new Set(groups.map(g => g.key)))
  }, [groups.length])  // eslint-disable-line

  const toggleGroup = (key) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const expandAll  = () => setExpanded(new Set(groups.map(g => g.key)))
  const collapseAll = () => setExpanded(new Set())

  if (topics.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#aaa' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#888' }}>No hay contenidos en este período</div>
        <div style={{ fontSize: 13, color: '#bbb', marginTop: 6 }}>Agrega el primer tema con el botón "+" en la barra superior</div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
        <button type="button" onClick={expandAll}
          style={{ padding: '4px 12px', border: '1px solid #d0d8e8', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#555' }}>
          Expandir todo
        </button>
        <button type="button" onClick={collapseAll}
          style={{ padding: '4px 12px', border: '1px solid #d0d8e8', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#555' }}>
          Colapsar todo
        </button>
      </div>

      {/* Groups */}
      {groups.map(group => {
        const isOpen    = expanded.has(group.key)
        const groupColor = group.color || pc.accent

        return (
          <div key={group.key} style={{ marginBottom: 10, borderRadius: 12, border: `1px solid ${pc.border}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(30,40,80,.05)' }}>
            {/* Group header */}
            <div
              onClick={() => toggleGroup(group.key)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px',
                background: isOpen ? pc.light : '#fff',
                cursor: 'pointer', userSelect: 'none',
                borderBottom: isOpen ? `1px solid ${pc.border}` : 'none',
                transition: 'background .15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, background: groupColor,
                  color: '#fff', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {group.icon}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1a2340' }}>{group.label}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{group.topics.length} tema{group.topics.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {/* Week range chip */}
                {group.topics.some(t => t.week_number) && (
                  <span style={{ fontSize: 11, color: '#666', background: '#f0f2f8', borderRadius: 12, padding: '2px 10px', fontWeight: 600 }}>
                    {(() => {
                      const wks = group.topics.filter(t => t.week_number).map(t => t.week_number)
                      const min = Math.min(...wks), max = Math.max(...wks)
                      return min === max ? `Sem. ${min}` : `Sem. ${min}–${max}`
                    })()}
                  </span>
                )}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onNew(group.topics[0]?.week_number || null) }}
                  title="Agregar contenido en este grupo"
                  style={{ width: 26, height: 26, border: 'none', borderRadius: 6, background: pc.accent, color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                  +
                </button>
                <span style={{ fontSize: 14, color: '#aaa', minWidth: 12, textAlign: 'center' }}>
                  {isOpen ? '▼' : '▶'}
                </span>
              </div>
            </div>

            {/* Topic cards */}
            {isOpen && (
              <div>
                {group.topics.map(t => (
                  <TopicDetailCard key={t.id} topic={t} onEdit={onEdit} onDelete={onDelete} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SyllabusPage({ teacher }) {
  const { showToast } = useToast()

  const [filterSubject, setFilterSubject] = useState('')
  const [filterGrade,   setFilterGrade]   = useState('')
  const [filterPeriod,  setFilterPeriod]  = useState(1)
  const [viewMode,      setViewMode]      = useState('content')  // 'weeks' | 'content'

  const [assignments, setAssignments] = useState([])
  const [topicModal,  setTopicModal]  = useState(null)
  const [copiedWeek,  setCopiedWeek]  = useState(null)

  const {
    topics, byWeek, loading, error,
    createTopic, updateTopic, deleteTopic,
  } = useSyllabus(teacher, {
    subject:       filterSubject || undefined,
    grade:         filterGrade   || undefined,
    period:        filterPeriod,
    academic_year: CURRENT_YEAR,
  })

  const { goals } = useAchievements(teacher, { academic_year: CURRENT_YEAR })

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
        if (!filterGrade   && rows.length > 0) setFilterGrade(rows[0].grade)
      })
  }, [teacher?.id])  // eslint-disable-line

  const uniqueSubjects = useMemo(() => [...new Set(assignments.map(a => a.subject))].sort(), [assignments])
  const uniqueGrades   = useMemo(() => [...new Set(assignments.map(a => combinedGrade(a)))].sort(), [assignments])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSaveTopic = async (form) => {
    const isEdit = !!form.id
    const { error: err } = isEdit
      ? await updateTopic(form.id, form)
      : await createTopic(form)
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

  const handleCopyWeek = (week) => {
    const ts = byWeek[week] || []
    if (!ts.length) return
    setCopiedWeek({ fromWeek: week, topics: ts })
    showToast(`Semana ${week} copiada — ${ts.length} contenido${ts.length !== 1 ? 's' : ''}`, 'info')
  }

  const handlePasteWeek = async (toWeek) => {
    if (!copiedWeek?.topics?.length) return
    const results = await Promise.all(
      copiedWeek.topics.map(t => {
        const { id, week_number, created_at, updated_at, indicator, ...rest } = t
        return createTopic({ ...rest, week_number: toWeek, period: filterPeriod })
      })
    )
    const failed = results.filter(r => r.error).length
    if (failed) showToast(`${failed} contenido(s) no se pudieron pegar`, 'error')
    else showToast(`${copiedWeek.topics.length} contenido${copiedWeek.topics.length !== 1 ? 's' : ''} pegado${copiedWeek.topics.length !== 1 ? 's' : ''} en Semana ${toWeek}`, 'success')
  }

  const openNewTopic = (week = null) => {
    setTopicModal({
      isNew:       true,
      subject:     filterSubject,
      grade:       filterGrade,
      period:      filterPeriod,
      week_number: week,
    })
  }

  const pc = PERIOD_COLORS[filterPeriod] || PERIOD_COLORS[1]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f4f6fb' }}>

      {/* ── Header ── */}
      <div style={{
        padding: '14px 24px', background: '#fff', borderBottom: '1px solid #e0e6f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: '#1F3864', fontWeight: 700 }}>📚 Syllabus de Contenidos</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#888' }}>
            Contenidos teóricos por semana y unidad — {CURRENT_YEAR}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* View mode toggle */}
          <div style={{ display: 'flex', border: '1px solid #d0d8e8', borderRadius: 8, overflow: 'hidden' }}>
            <button type="button"
              onClick={() => setViewMode('content')}
              style={{
                padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: viewMode === 'content' ? pc.accent : '#fff',
                color:      viewMode === 'content' ? '#fff' : '#666',
              }}>
              📖 Contenido
            </button>
            <button type="button"
              onClick={() => setViewMode('weeks')}
              style={{
                padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                borderLeft: '1px solid #d0d8e8',
                background: viewMode === 'weeks' ? pc.accent : '#fff',
                color:      viewMode === 'weeks' ? '#fff' : '#666',
              }}>
              📅 Semanas
            </button>
          </div>
          <button onClick={() => openNewTopic()}
            style={{ padding: '9px 18px', background: pc.accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            + Nuevo
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{
        padding: '10px 24px', background: '#fff', borderBottom: '1px solid #e0e6f0',
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
          {[1, 2, 3, 4, 5, 6].map(p => <option key={p} value={p}>{p}.° Período</option>)}
        </select>
        <span style={{ fontSize: 13, color: '#888' }}>
          {topics.length} contenido{topics.length !== 1 ? 's' : ''}
        </span>

        {/* Hint de vista */}
        {filterSubject && viewMode === 'content' && (
          <span style={{ fontSize: 11, color: '#aaa', marginLeft: 4 }}>
            {UNIT_SUBJECTS.includes(filterSubject) && topics.some(t => t.unit_number)
              ? '· agrupado por unidad'
              : '· agrupado por tipo de contenido'}
          </span>
        )}
      </div>

      {/* ── Main content area ── */}
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

        {!loading && !error && !filterSubject && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#aaa' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📚</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#888' }}>Selecciona una asignatura para ver el syllabus</div>
          </div>
        )}

        {!loading && !error && filterSubject && (
          <>
            {/* Unit week rule warnings */}
            {validateUnitWeekRule(topics, filterSubject).map(v => (
              <div key={v.unit_number} style={{
                display: 'flex', alignItems: 'center', gap: 10, background: '#FFF8E6',
                border: '1px solid #F5C300', borderRadius: 8, padding: '8px 14px', marginBottom: 10,
                fontSize: 13, color: '#7A5A00',
              }}>
                ⚠️ Unit {v.unit_number} ocupa {v.weeks.length} semanas (semanas {v.weeks.join(', ')}). El máximo para {v.subject} es 2 semanas.
              </div>
            ))}

            {/* Copy banner (solo vista Semanas) */}
            {viewMode === 'weeks' && copiedWeek && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#EBF7FC', border: '1px solid #4BACC6', borderRadius: 8, padding: '8px 14px', marginBottom: 14, fontSize: 13, color: '#0E6E8C' }}>
                <span>📋 Semana {copiedWeek.fromWeek} copiada — {copiedWeek.topics.length} contenido{copiedWeek.topics.length !== 1 ? 's' : ''}. Presiona <strong>⬇ Pegar</strong> en cualquier semana.</span>
                <button type="button" onClick={() => setCopiedWeek(null)}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#4BACC6', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>✕</button>
              </div>
            )}

            {/* ── Vista Contenido ── */}
            {viewMode === 'content' && (
              <ContentListView
                topics={topics}
                filterSubject={filterSubject}
                filterPeriod={filterPeriod}
                pc={pc}
                onEdit={t => setTopicModal(t)}
                onDelete={handleDeleteTopic}
                onNew={openNewTopic}
              />
            )}

            {/* ── Vista Semanas (kanban) ── */}
            {viewMode === 'weeks' && (() => {
              const usedWeeks   = Object.keys(byWeek).map(Number).filter(w => w > 0)
              const maxUsed     = usedWeeks.length > 0 ? Math.max(...usedWeeks) : 0
              const visibleCount = Math.max(8, maxUsed + 3)
              const visibleWeeks = Array.from({ length: visibleCount }, (_, i) => i + 1)

              return (
                <>
                  {/* Topics without week */}
                  {(byWeek[0] || []).length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#aaa', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                        Sin semana asignada
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {(byWeek[0] || []).map(t => {
                          const ct = ctInfo(t.content_type)
                          return (
                            <div key={t.id} style={{ padding: '8px 12px', borderRadius: 8, background: '#fff', border: `1px solid ${ct.color}30`, fontSize: 13, color: '#1F3864' }}>
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

                  <div style={{ overflowX: 'auto', overflowY: 'visible', paddingBottom: 16, WebkitOverflowScrolling: 'touch' }}>
                    <div style={{ display: 'flex', gap: 10, width: 'max-content', alignItems: 'flex-start' }}>
                      {visibleWeeks.map(w => (
                        <WeekColumn
                          key={w} week={w} pc={pc} topics={byWeek[w] || []}
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
                </>
              )
            })()}
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
