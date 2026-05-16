// ── ExitTicketForm.jsx ────────────────────────────────────────────────────────
// Form for the `exit-ticket` block type.
// Used in CIERRE (Momento 5): quick comprehension check before closing.
// ClassroomOS renders the question prominently with response instructions.

const RESPONSE_TYPES = [
  {
    value: 'written',
    label: 'Escrito en cuaderno',
    hint: 'Cada estudiante escribe su respuesta',
    icon: '✏️',
  },
  {
    value: 'thumbs',
    label: 'Pulgares',
    hint: '👍 Entendí · 👍 Más o menos · 👎 No entendí',
    icon: '👍',
  },
  {
    value: 'scale',
    label: 'Escala 1–5',
    hint: 'Levanta dedos del 1 (perdido) al 5 (lo domino)',
    icon: '🖐️',
  },
  {
    value: 'quick-choice',
    label: 'Opciones rápidas',
    hint: 'El docente lee opciones, los estudiantes eligen',
    icon: '🔤',
  },
]

const COLLECT_METHODS = [
  { value: 'notebook',   label: 'Cuaderno',        icon: '📓' },
  { value: 'whiteboard', label: 'Tablero',          icon: '🪟' },
  { value: 'platform',   label: 'Plataforma digital', icon: '💻' },
  { value: 'verbal',     label: 'Verbal / en voz alta', icon: '🎤' },
]

export default function ExitTicketForm({ data, onChange }) {
  const responseType  = data.responseType  || 'written'
  const collectMethod = data.collectMethod || 'notebook'
  const options       = Array.isArray(data.options) ? data.options : []
  const isQuickChoice = responseType === 'quick-choice'

  function addOption()               { onChange({ ...data, options: [...options, ''] }) }
  function updateOption(i, v)        { onChange({ ...data, options: options.map((o, idx) => idx === i ? v : o) }) }
  function removeOption(i)           { onChange({ ...data, options: options.filter((_, idx) => idx !== i) }) }

  return (
    <div className="be-form">
      {/* Question */}
      <div className="be-field">
        <label className="be-label">
          Pregunta de salida
          <span className="be-label-hint">Una sola pregunta — verifica el aprendizaje clave del día</span>
        </label>
        <textarea
          className="be-textarea"
          value={data.question || ''}
          onChange={e => onChange({ ...data, question: e.target.value })}
          placeholder="Ej: ¿Cuándo usamos el past tense en inglés? Da un ejemplo."
          rows={3}
        />
      </div>

      {/* Response type */}
      <div className="be-field">
        <label className="be-label">Tipo de respuesta</label>
        <div className="be-exit-type-grid">
          {RESPONSE_TYPES.map(rt => (
            <button
              key={rt.value}
              type="button"
              className={`be-exit-type-btn ${responseType === rt.value ? 'active' : ''}`}
              onClick={() => onChange({ ...data, responseType: rt.value })}
            >
              <span className="be-exit-type-icon">{rt.icon}</span>
              <span className="be-subtype-label">{rt.label}</span>
              <span className="be-subtype-hint">{rt.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick-choice options */}
      {isQuickChoice && (
        <div className="be-field">
          <label className="be-label">
            Opciones de respuesta
            <span className="be-label-hint">ClassroomOS las muestra como A / B / C / D</span>
          </label>
          <div className="be-list-items">
            {options.map((opt, idx) => (
              <div key={idx} className="be-list-row">
                <span className="be-list-num">{String.fromCharCode(65 + idx)}</span>
                <input
                  className="be-input"
                  type="text"
                  value={opt}
                  onChange={e => updateOption(idx, e.target.value)}
                  placeholder={`Opción ${String.fromCharCode(65 + idx)}`}
                />
                {options.length > 2 && (
                  <button className="be-icon-btn be-icon-btn--danger" onClick={() => removeOption(idx)}>✕</button>
                )}
              </div>
            ))}
            {options.length < 5 && (
              <button className="be-add-item-btn" onClick={addOption}>+ Opción</button>
            )}
          </div>
        </div>
      )}

      {/* Collect method */}
      <div className="be-field">
        <label className="be-label">¿Dónde recogen la respuesta?</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {COLLECT_METHODS.map(m => (
            <button
              key={m.value}
              type="button"
              className={`be-priority-btn ${collectMethod === m.value ? 'active' : ''}`}
              style={{ '--priority-color': '#1B3564' }}
              onClick={() => onChange({ ...data, collectMethod: m.value })}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="be-field-note">
        En ClassroomOS: la pregunta se proyecta con las instrucciones de respuesta durante el CIERRE. El docente controla cuándo avanzar.
      </div>
    </div>
  )
}
