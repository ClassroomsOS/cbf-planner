// ── DictationPreview.jsx ──────────────────────────────────────────────────────
// Vista previa read-only del dictado (blueprint) para el docente.

import { SECTION_META } from '../../utils/dictationUtils'

export default function DictationPreview({ blueprint, sections }) {
  if (!blueprint) return null

  // Group questions by type
  const grouped = {}
  ;(sections || []).forEach((q, i) => {
    const key = q.question_type
    if (!grouped[key]) grouped[key] = []
    grouped[key].push({ ...q, idx: i })
  })

  return (
    <div className="dict-preview">
      <div className="dict-preview-header">
        <h3>{blueprint.title}</h3>
        <div className="dict-preview-meta">
          <span>{blueprint.grade} · {blueprint.section}</span>
          <span>{blueprint.subject}</span>
          <span className="dict-preview-difficulty">{blueprint.difficulty}</span>
        </div>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <p className="dict-preview-empty">No hay preguntas generadas para este dictado.</p>
      ) : (
        Object.entries(grouped).map(([type, items]) => {
          const meta = SECTION_META[type] || { icon: '📝', label: type, color: '#888' }
          return (
            <div key={type} className="dict-preview-section">
              <div className="dict-preview-sec-header" style={{ background: meta.color + '20', borderLeft: `4px solid ${meta.color}` }}>
                <span>{meta.icon} {meta.label}</span>
                <span className="dict-preview-count">{items.length} ítems</span>
              </div>

              <div className="dict-preview-items">
                {items.map((q, i) => (
                  <div key={i} className="dict-preview-item">
                    <span className="dict-preview-num">{q.idx + 1}.</span>

                    {type === 'listen_type' && (
                      <span className="dict-preview-text">{q.audio_text || q.word || '—'}</span>
                    )}

                    {type === 'listen_identify' && (
                      <span className="dict-preview-text">{q.audio_text || q.sentence || '—'}</span>
                    )}

                    {type === 'matching' && (
                      <div className="dict-preview-matching">
                        <strong>{q.word}</strong>
                        <div className="dict-preview-options">
                          {(q.options || []).map((opt, oi) => (
                            <span
                              key={oi}
                              className={`dict-preview-opt ${opt === q.correct_answer ? 'correct' : ''}`}
                            >
                              {opt === q.correct_answer ? '✓ ' : ''}{opt}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {type === 'fill_blank' && (
                      <div className="dict-preview-fill">
                        <p>{q.sentence}</p>
                        <div className="dict-preview-options">
                          {(q.options || []).map((opt, oi) => (
                            <span
                              key={oi}
                              className={`dict-preview-opt ${opt === q.correct_answer ? 'correct' : ''}`}
                            >
                              {opt === q.correct_answer ? '✓ ' : ''}{opt}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {type === 'writing' && (
                      <div className="dict-preview-writing">
                        <p>{q.prompt}</p>
                        {q.required_words?.length > 0 && (
                          <div className="dict-preview-req-words">
                            {q.required_words.map((w, wi) => (
                              <span key={wi} className="dict-preview-word-chip">{w}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {q.correct_answer && type !== 'matching' && type !== 'fill_blank' && (
                      <span className="dict-preview-answer">→ {q.correct_answer}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
