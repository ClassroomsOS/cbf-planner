// ── ExplanationForm.jsx ───────────────────────────────────────────────────────
// Form for the `explanation` block type.
// Used in I DO phase: the teacher explains a concept with optional grammar target.

export default function ExplanationForm({ data, onChange }) {
  const grammarTarget   = data.grammarTarget   || ''
  const highlightTerms  = data.highlightTerms  || []

  function addTerm() {
    onChange({ ...data, highlightTerms: [...highlightTerms, ''] })
  }
  function updateTerm(idx, val) {
    onChange({ ...data, highlightTerms: highlightTerms.map((t, i) => i === idx ? val : t) })
  }
  function removeTerm(idx) {
    onChange({ ...data, highlightTerms: highlightTerms.filter((_, i) => i !== idx) })
  }

  return (
    <div className="be-form">
      <div className="be-field">
        <label className="be-label">
          Explicación
          <span className="be-label-hint">El concepto que explicarás en clase</span>
        </label>
        <textarea
          className="be-textarea"
          value={data.text || ''}
          onChange={e => onChange({ ...data, text: e.target.value })}
          placeholder="Escribe tu explicación del concepto. Sé claro y usa ejemplos desde el principio…"
          rows={5}
        />
      </div>

      <div className="be-field">
        <label className="be-label">
          Estructura objetivo
          <span className="be-label-hint">ClassroomOS la resaltará automáticamente en pantalla</span>
        </label>
        <input
          className="be-input"
          type="text"
          value={grammarTarget}
          onChange={e => onChange({ ...data, grammarTarget: e.target.value })}
          placeholder="Ej: past tense -ed ending · present perfect with 'have'"
        />
      </div>

      <div className="be-field">
        <label className="be-label">
          Términos clave a resaltar
          <span className="be-label-hint">Se subrayarán en ClassroomOS cuando aparezcan en el texto</span>
        </label>
        <div className="be-term-list">
          {highlightTerms.map((term, idx) => (
            <div key={idx} className="be-term-row">
              <input
                className="be-input"
                type="text"
                value={term}
                onChange={e => updateTerm(idx, e.target.value)}
                placeholder="Término o frase"
              />
              <button className="be-icon-btn be-icon-btn--danger" onClick={() => removeTerm(idx)}>✕</button>
            </div>
          ))}
          {highlightTerms.length < 8 && (
            <button className="be-add-item-btn" onClick={addTerm}>
              + Agregar término
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
