import { QUESTION_POINTS, SECTION_META } from '../../utils/dictationUtils'

/**
 * ManualEntryForm — formularios inline por sección para entrada manual.
 * Soporta 5 tipos: listen_type, listen_identify, matching, fill_blank, writing.
 */
export default function ManualEntryForm({ sections, onChange, vocabulary }) {

  function updateItem(sectionIdx, itemIdx, field, value) {
    const next = sections.map((sec, si) => {
      if (si !== sectionIdx) return sec
      return {
        ...sec,
        items: sec.items.map((item, ii) => {
          if (ii !== itemIdx) return item
          const updated = { ...item, [field]: value }
          // Auto-derive audio_text for listen_type
          if (sec.type === 'listen_type' && field === 'correct_answer') {
            const n = ii + 1
            updated.audio_text = value ? `Number ${n}... ${value}... ${value}` : ''
          }
          return updated
        }),
      }
    })
    onChange(next)
  }

  function updateOption(sectionIdx, itemIdx, optIdx, value) {
    const next = sections.map((sec, si) => {
      if (si !== sectionIdx) return sec
      return {
        ...sec,
        items: sec.items.map((item, ii) => {
          if (ii !== itemIdx) return item
          const opts = [...(item.options || [])]
          opts[optIdx] = value
          return { ...item, options: opts }
        }),
      }
    })
    onChange(next)
  }

  function updateRequiredWords(sectionIdx, itemIdx, text) {
    const words = text.split(/[,;]+/).map(w => w.trim()).filter(Boolean)
    updateItem(sectionIdx, itemIdx, 'required_words', words)
  }

  function addItem(sectionIdx) {
    const sec = sections[sectionIdx]
    const type = sec.type
    const newItem = { max_score: QUESTION_POINTS[type] || 1 }
    if (type === 'listen_type') {
      newItem.audio_text = ''
      newItem.correct_answer = ''
    } else if (type === 'listen_identify') {
      newItem.audio_text = ''
      newItem.options = ['', '', '']
      newItem.correct_answer = ''
    } else if (type === 'matching') {
      newItem.word = ''
      newItem.options = ['', '', '', '']
      newItem.correct_answer = ''
    } else if (type === 'writing') {
      newItem.prompt = ''
      newItem.required_words = []
      newItem.correct_answer = ''
    } else {
      newItem.sentence = ''
      newItem.options = ['', '', '']
      newItem.correct_answer = ''
    }
    const next = sections.map((s, si) =>
      si === sectionIdx ? { ...s, items: [...s.items, newItem] } : s
    )
    onChange(next)
  }

  function removeItem(sectionIdx, itemIdx) {
    const next = sections.map((s, si) =>
      si === sectionIdx
        ? { ...s, items: s.items.filter((_, ii) => ii !== itemIdx) }
        : s
    )
    onChange(next)
  }

  return (
    <div className="dict-manual-form">
      {sections.map((sec, si) => {
        const meta = SECTION_META[sec.type] || {}
        return (
          <div key={si} className="dict-manual-section" style={{ borderLeftColor: meta.color || '#888' }}>
            <h3 className="dict-manual-section-title">{meta.icon} {sec.title}</h3>
            <p className="dict-preview-instr">{sec.instructions}</p>

            {sec.items.map((item, ii) => (
              <div key={ii} className="dict-manual-item">
                <div className="dict-manual-item-header">
                  <span className="dict-preview-num">{ii + 1})</span>
                  <button
                    type="button"
                    onClick={() => removeItem(si, ii)}
                    className="dict-manual-remove"
                    title="Eliminar item"
                  >×</button>
                </div>

                {/* ── LISTEN & TYPE ── */}
                {sec.type === 'listen_type' && (
                  <div className="dict-manual-fields">
                    <div className="dict-field">
                      <label>Palabra/frase (lo que el estudiante debe escribir)</label>
                      <input
                        value={item.correct_answer || ''}
                        onChange={e => updateItem(si, ii, 'correct_answer', e.target.value)}
                        placeholder="Ej: salary cut"
                        list={`vocab-suggest-${si}-${ii}`}
                      />
                      {vocabulary.length > 0 && (
                        <datalist id={`vocab-suggest-${si}-${ii}`}>
                          {vocabulary.map(w => <option key={w} value={w} />)}
                        </datalist>
                      )}
                    </div>
                    <div className="dict-field">
                      <label>Texto del audio (auto-generado, editable)</label>
                      <input
                        value={item.audio_text || ''}
                        onChange={e => updateItem(si, ii, 'audio_text', e.target.value)}
                        placeholder="Number 1... salary cut... salary cut"
                      />
                    </div>
                  </div>
                )}

                {/* ── LISTEN & IDENTIFY ── */}
                {sec.type === 'listen_identify' && (
                  <div className="dict-manual-fields">
                    <div className="dict-field">
                      <label>Oración con la palabra (texto del audio)</label>
                      <input
                        value={item.audio_text || ''}
                        onChange={e => updateItem(si, ii, 'audio_text', e.target.value)}
                        placeholder="Ej: The company announced a salary cut last week."
                      />
                    </div>
                    <div className="dict-manual-options">
                      <label>Opciones (3):</label>
                      {(item.options || ['', '', '']).map((opt, oi) => (
                        <div key={oi} className="dict-manual-option-row">
                          <input
                            type="radio"
                            name={`correct-${si}-${ii}`}
                            checked={item.correct_answer === opt && opt !== ''}
                            onChange={() => updateItem(si, ii, 'correct_answer', opt)}
                          />
                          <input
                            value={opt}
                            onChange={e => {
                              updateOption(si, ii, oi, e.target.value)
                              if (item.correct_answer === opt) {
                                updateItem(si, ii, 'correct_answer', e.target.value)
                              }
                            }}
                            placeholder={`Opción ${oi + 1}`}
                            className="dict-manual-option-input"
                          />
                        </div>
                      ))}
                      <span className="dict-manual-hint">Selecciona el radio de la respuesta correcta</span>
                    </div>
                  </div>
                )}

                {/* ── MATCHING ── */}
                {sec.type === 'matching' && (
                  <div className="dict-manual-fields">
                    <div className="dict-field">
                      <label>Palabra de vocabulario</label>
                      <input
                        value={item.word || ''}
                        onChange={e => updateItem(si, ii, 'word', e.target.value)}
                        placeholder="Ej: salary"
                        list={`vocab-match-${si}-${ii}`}
                      />
                      {vocabulary.length > 0 && (
                        <datalist id={`vocab-match-${si}-${ii}`}>
                          {vocabulary.map(w => <option key={w} value={w} />)}
                        </datalist>
                      )}
                    </div>
                    <div className="dict-manual-options">
                      <label>Definiciones (4) — selecciona la correcta:</label>
                      {(item.options || ['', '', '', '']).map((opt, oi) => (
                        <div key={oi} className="dict-manual-option-row">
                          <input
                            type="radio"
                            name={`correct-match-${si}-${ii}`}
                            checked={item.correct_answer === opt && opt !== ''}
                            onChange={() => updateItem(si, ii, 'correct_answer', opt)}
                          />
                          <input
                            value={opt}
                            onChange={e => {
                              updateOption(si, ii, oi, e.target.value)
                              if (item.correct_answer === opt) {
                                updateItem(si, ii, 'correct_answer', e.target.value)
                              }
                            }}
                            placeholder={`Definición ${oi + 1}`}
                            className="dict-manual-option-input"
                          />
                        </div>
                      ))}
                      <span className="dict-manual-hint">Selecciona la definición correcta</span>
                    </div>
                  </div>
                )}

                {/* ── FILL THE BLANK ── */}
                {sec.type === 'fill_blank' && (
                  <div className="dict-manual-fields">
                    <div className="dict-field">
                      <label>Oración (usa ___ para el espacio en blanco)</label>
                      <input
                        value={item.sentence || ''}
                        onChange={e => updateItem(si, ii, 'sentence', e.target.value)}
                        placeholder="Ej: She received a ___ after three years of hard work."
                      />
                    </div>
                    <div className="dict-manual-options">
                      <label>Opciones (3):</label>
                      {(item.options || ['', '', '']).map((opt, oi) => (
                        <div key={oi} className="dict-manual-option-row">
                          <input
                            type="radio"
                            name={`correct-fb-${si}-${ii}`}
                            checked={item.correct_answer === opt && opt !== ''}
                            onChange={() => updateItem(si, ii, 'correct_answer', opt)}
                          />
                          <input
                            value={opt}
                            onChange={e => {
                              updateOption(si, ii, oi, e.target.value)
                              if (item.correct_answer === opt) {
                                updateItem(si, ii, 'correct_answer', e.target.value)
                              }
                            }}
                            placeholder={`Opción ${oi + 1}`}
                            className="dict-manual-option-input"
                          />
                        </div>
                      ))}
                      <span className="dict-manual-hint">Selecciona el radio de la respuesta correcta</span>
                    </div>
                  </div>
                )}

                {/* ── WRITING ── */}
                {sec.type === 'writing' && (
                  <div className="dict-manual-fields">
                    <div className="dict-field">
                      <label>Prompt (instrucción de escritura)</label>
                      <textarea
                        value={item.prompt || ''}
                        onChange={e => updateItem(si, ii, 'prompt', e.target.value)}
                        placeholder="Ej: Write 3-5 sentences about your ideal career using at least 5 of the following vocabulary words."
                        rows={3}
                      />
                    </div>
                    <div className="dict-field">
                      <label>Palabras requeridas (separadas por coma)</label>
                      <input
                        value={(item.required_words || []).join(', ')}
                        onChange={e => updateRequiredWords(si, ii, e.target.value)}
                        placeholder="salary, trade, commission, benefits, overtime"
                      />
                      {(item.required_words || []).length > 0 && (
                        <span style={{ fontSize: 12, color: '#666' }}>
                          {item.required_words.length} palabras requeridas
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={() => addItem(si)}
              className="dict-btn-sm secondary"
              style={{ marginTop: 8 }}
            >
              + Agregar item
            </button>
          </div>
        )
      })}
    </div>
  )
}
