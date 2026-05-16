// ── PatternForm.jsx ───────────────────────────────────────────────────────────
// Form rendered after a teacher selects an activity pattern.
// Renders the pattern's `inputs` dynamically based on INPUT_FIELD_TYPES.
// Each field type maps to a specific UI control.

import { useState } from 'react'
import { getPattern, INPUT_FIELD_TYPES } from '../../../utils/activityPatterns'
import PatternPicker from '../PatternPicker'

// ── Field renderers by INPUT_FIELD_TYPE ───────────────────────────────────────

function TextField({ field, value, onChange }) {
  return (
    <div className="be-field">
      <label className="be-label">
        {field.label.es}
        {field.hint && <span className="be-label-hint">{field.hint.es}</span>}
      </label>
      <input
        className="be-input"
        type={field.type === INPUT_FIELD_TYPES.NUMBER ? 'number' : 'text'}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={field.hint?.es || ''}
        min={field.min}
        max={field.max}
      />
    </div>
  )
}

function TextareaField({ field, value, onChange }) {
  return (
    <div className="be-field">
      <label className="be-label">
        {field.label.es}
        {field.hint && <span className="be-label-hint">{field.hint.es}</span>}
      </label>
      <textarea
        className="be-textarea"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={field.hint?.es || ''}
        rows={4}
      />
    </div>
  )
}

function TextListField({ field, value = [], onChange }) {
  const items = Array.isArray(value) ? value : []
  const max   = field.max || 20
  const min   = field.min || 0

  function addItem()            { onChange([...items, '']) }
  function updateItem(i, v)     { onChange(items.map((x, idx) => idx === i ? v : x)) }
  function removeItem(i)        { onChange(items.filter((_, idx) => idx !== i)) }

  return (
    <div className="be-field">
      <label className="be-label">
        {field.label.es}
        {field.hint && <span className="be-label-hint">{field.hint.es}</span>}
      </label>
      <div className="be-list-items">
        {items.map((item, idx) => (
          <div key={idx} className="be-list-row">
            <span className="be-list-num">{idx + 1}</span>
            <input
              className="be-input"
              type="text"
              value={item}
              onChange={e => updateItem(idx, e.target.value)}
              placeholder={`Ítem ${idx + 1}`}
            />
            {items.length > min && (
              <button className="be-icon-btn be-icon-btn--danger" onClick={() => removeItem(idx)}>✕</button>
            )}
          </div>
        ))}
        {items.length < max && (
          <button className="be-add-item-btn" onClick={addItem}>+ Agregar ítem</button>
        )}
      </div>
    </div>
  )
}

function RichListField({ field, value = [], onChange }) {
  // Rich list: array of objects with { text, note? }
  const items = Array.isArray(value) ? value : []
  const max   = field.max || 20
  const min   = field.min || 0

  function addItem()                     { onChange([...items, { text: '' }]) }
  function updateItem(i, k, v)           { onChange(items.map((x, idx) => idx === i ? { ...x, [k]: v } : x)) }
  function removeItem(i)                 { onChange(items.filter((_, idx) => idx !== i)) }

  return (
    <div className="be-field">
      <label className="be-label">
        {field.label.es}
        {field.hint && <span className="be-label-hint">{field.hint.es}</span>}
      </label>
      <div className="be-list-items">
        {items.map((item, idx) => (
          <div key={idx} className="be-rich-list-item">
            <span className="be-list-num">{idx + 1}</span>
            <div className="be-rich-list-fields">
              <input
                className="be-input"
                type="text"
                value={item.text || ''}
                onChange={e => updateItem(idx, 'text', e.target.value)}
                placeholder="Contenido del ítem"
              />
              <input
                className="be-input be-input--sm"
                type="text"
                value={item.note || ''}
                onChange={e => updateItem(idx, 'note', e.target.value)}
                placeholder="Nota opcional (espacio en blanco, gap, etc.)"
              />
            </div>
            {items.length > min && (
              <button className="be-icon-btn be-icon-btn--danger" onClick={() => removeItem(idx)}>✕</button>
            )}
          </div>
        ))}
        {items.length < max && (
          <button className="be-add-item-btn" onClick={addItem}>+ Agregar ítem</button>
        )}
      </div>
    </div>
  )
}

function SelectField({ field, value, onChange }) {
  return (
    <div className="be-field">
      <label className="be-label">
        {field.label.es}
        {field.hint && <span className="be-label-hint">{field.hint.es}</span>}
      </label>
      <select
        className="be-select"
        value={value || field.options?.[0]?.value || ''}
        onChange={e => onChange(e.target.value)}
      >
        {(field.options || []).map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label.es}</option>
        ))}
      </select>
    </div>
  )
}

function MediaUrlField({ field, value, onChange }) {
  const isYt    = value && /youtube\.com|youtu\.be/.test(value)
  const isVimeo = value && /vimeo\.com/.test(value)
  const isValid = isYt || isVimeo

  return (
    <div className="be-field">
      <label className="be-label">
        {field.label.es}
        {field.hint && <span className="be-label-hint">{field.hint.es}</span>}
      </label>
      <input
        className={`be-input ${value && !isValid ? 'be-input--error' : ''}`}
        type="url"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder="https://www.youtube.com/watch?v=..."
      />
      {value && !isValid && (
        <p className="be-field-warning">⚠️ URL no reconocida. Usa un link de YouTube o Vimeo. La AI nunca inventa recursos — verifica que el video existe.</p>
      )}
      {isValid && (
        <p className="be-field-ok">✓ URL válida ({isYt ? 'YouTube' : 'Vimeo'})</p>
      )}
    </div>
  )
}

// Placeholder for annotated image — full implementation in Sprint 5
function AnnotatedImageField({ field, value, onChange }) {
  return (
    <div className="be-field">
      <label className="be-label">
        {field.label.es}
        {field.hint && <span className="be-label-hint">{field.hint.es}</span>}
      </label>
      <div className="be-img-placeholder">
        <span>🖼️</span>
        <p>El anotador de imágenes estará disponible en el Sprint 5.</p>
        <p className="be-img-placeholder-sub">Por ahora, sube la imagen desde el panel de Imágenes de la sección.</p>
      </div>
    </div>
  )
}

// ── Field dispatcher ──────────────────────────────────────────────────────────
function FieldRenderer({ field, value, onChange }) {
  switch (field.type) {
    case INPUT_FIELD_TYPES.TEXT:
    case INPUT_FIELD_TYPES.NUMBER:
      return <TextField field={field} value={value} onChange={onChange} />
    case INPUT_FIELD_TYPES.TEXTAREA:
      return <TextareaField field={field} value={value} onChange={onChange} />
    case INPUT_FIELD_TYPES.TEXT_LIST:
      return <TextListField field={field} value={value} onChange={onChange} />
    case INPUT_FIELD_TYPES.RICH_LIST:
      return <RichListField field={field} value={value} onChange={onChange} />
    case INPUT_FIELD_TYPES.SELECT:
      return <SelectField field={field} value={value} onChange={onChange} />
    case INPUT_FIELD_TYPES.MEDIA_URL:
      return <MediaUrlField field={field} value={value} onChange={onChange} />
    case INPUT_FIELD_TYPES.ANNOTATED_IMAGE:
      return <AnnotatedImageField field={field} value={value} onChange={onChange} />
    default:
      return null
  }
}

// ── PatternForm ───────────────────────────────────────────────────────────────
export default function PatternForm({ data, onChange }) {
  const [showPicker, setShowPicker] = useState(!data.patternId)

  const pattern = data.patternId ? getPattern(data.patternId) : null
  const inputs  = data.inputs || {}

  function handlePatternSelect(p) {
    onChange({ ...data, patternId: p.id, inputs: {}, context: '' })
    setShowPicker(false)
  }

  function updateInput(key, value) {
    onChange({ ...data, inputs: { ...inputs, [key]: value } })
  }

  if (showPicker) {
    return (
      <PatternPicker
        onSelect={handlePatternSelect}
        onClose={() => setShowPicker(false)}
      />
    )
  }

  if (!pattern) {
    return (
      <div className="be-form">
        <div className="be-field-warning">Patrón no encontrado. Por favor selecciona uno.</div>
        <button className="be-add-item-btn" onClick={() => setShowPicker(true)}>
          Seleccionar patrón
        </button>
      </div>
    )
  }

  const requiredFields = pattern.inputs?.required || []
  const optionalFields = pattern.inputs?.optional || []

  return (
    <div className="be-form">
      {/* Pattern identity banner */}
      <div className="be-pattern-banner">
        <span className="be-pattern-icon">{pattern.icon}</span>
        <div className="be-pattern-info">
          <strong>{pattern.name.es}</strong>
          <span>{pattern.duration.typical} min · {
            pattern.grouping === 'pairs'       ? 'Parejas'      :
            pattern.grouping === 'whole-class' ? 'Clase entera' :
            pattern.grouping === 'individual'  ? 'Individual'   :
            pattern.grouping === 'teams'       ? 'Equipos'      : pattern.grouping
          }</span>
        </div>
        <button
          className="be-pattern-change-btn"
          onClick={() => setShowPicker(true)}
        >
          Cambiar patrón
        </button>
      </div>

      {/* Context field */}
      <div className="be-field">
        <label className="be-label">
          Contexto de la actividad
          <span className="be-label-hint">¿Sobre qué tema / unidad aplica este patrón?</span>
        </label>
        <input
          className="be-input"
          type="text"
          value={data.context || ''}
          onChange={e => onChange({ ...data, context: e.target.value })}
          placeholder="Ej: Past tense narration · Unit 3 vocabulary · Writing a formal letter"
        />
      </div>

      {/* Required fields */}
      {requiredFields.map(field => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={inputs[field.key]}
          onChange={val => updateInput(field.key, val)}
        />
      ))}

      {/* Optional fields (collapsible) */}
      {optionalFields.length > 0 && (
        <OptionalFields fields={optionalFields} inputs={inputs} onUpdate={updateInput} />
      )}

      {/* Duration */}
      <div className="be-field">
        <label className="be-label">
          Duración estimada (minutos)
          <span className="be-label-hint">Típico para este patrón: {pattern.duration.min}–{pattern.duration.max} min</span>
        </label>
        <input
          className="be-input"
          type="number"
          value={data.duration || pattern.duration.typical}
          min={1} max={60}
          onChange={e => onChange({ ...data, duration: parseInt(e.target.value) || pattern.duration.typical })}
          style={{ maxWidth: '120px' }}
        />
      </div>

      {/* Teacher steps reminder */}
      <div className="be-pattern-steps-hint">
        <h4>📋 Recordatorio: pasos del docente</h4>
        {Object.entries(pattern.teacherSteps || {}).map(([phase, text]) => (
          <div key={phase} className="be-hint-step">
            <span className="be-hint-phase">
              {phase === 'before' ? 'Antes' : phase === 'during' ? 'Durante' : 'Después'}
            </span>
            <p>{text.es}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── OptionalFields — collapsible section ──────────────────────────────────────
function OptionalFields({ fields, inputs, onUpdate }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="be-optional-section">
      <button
        className="be-optional-toggle"
        onClick={() => setOpen(o => !o)}
        type="button"
      >
        {open ? '▲' : '▼'} Campos opcionales ({fields.length})
      </button>
      {open && fields.map(field => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={inputs[field.key]}
          onChange={val => onUpdate(field.key, val)}
        />
      ))}
    </div>
  )
}
