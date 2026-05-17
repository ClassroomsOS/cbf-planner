// ── VocabForm.jsx ─────────────────────────────────────────────────────────────
// Form for the `vocab` block type.
// Used in TOPICS (Momento 1): the teacher fills in vocabulary terms for the day.
// ClassroomOS renders each term as a large card (word + definition + example).

import { useState } from 'react'

const DISPLAY_MODES = [
  { value: 'cards',   label: 'Tarjetas',  hint: 'Una por una, grande — ideal para pronunciación en coro' },
  { value: 'list',    label: 'Lista',     hint: 'Todos los términos visibles a la vez' },
  { value: 'minimal', label: 'Compacto',  hint: 'Solo palabras y definición corta' },
]

function TermRow({ term, idx, total, onUpdate, onRemove, onMove }) {
  const [expanded, setExpanded] = useState(idx === 0)
  const filled = !!(term.word && term.definition)

  return (
    <div className={`vocab-term-card ${filled ? 'vocab-term-card--filled' : ''}`}>
      <div className="vocab-term-header" onClick={() => setExpanded(e => !e)} role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter') setExpanded(x => !x) }}>
        <span className="vocab-term-num">{idx + 1}</span>
        <span className="vocab-term-preview">
          {term.word ? <strong>{term.word}</strong> : <em style={{ color: '#aaa' }}>Sin término</em>}
          {term.definition && <span style={{ color: '#666', marginLeft: 6 }}>{term.definition.slice(0, 40)}{term.definition.length > 40 ? '…' : ''}</span>}
        </span>
        <div className="vocab-term-controls" onClick={e => e.stopPropagation()}>
          <button className="be-icon-btn" onClick={() => onMove(idx, -1)} disabled={idx === 0} title="Subir">↑</button>
          <button className="be-icon-btn" onClick={() => onMove(idx,  1)} disabled={idx === total - 1} title="Bajar">↓</button>
          <button className="be-icon-btn be-icon-btn--danger" onClick={() => onRemove(idx)} title="Eliminar">✕</button>
          <span style={{ color: '#bbb', fontSize: 10, marginLeft: 2 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="vocab-term-body">
          <div className="be-field">
            <label className="be-label">Término / Word</label>
            <input
              className="be-input"
              type="text"
              value={term.word || ''}
              onChange={e => onUpdate(idx, 'word', e.target.value)}
              placeholder="Ej: nevertheless"
              autoFocus={idx > 0 && !term.word}
            />
          </div>
          <div className="be-field">
            <label className="be-label">Definición (en español o en inglés según nivel)</label>
            <textarea
              className="be-textarea"
              value={term.definition || ''}
              onChange={e => onUpdate(idx, 'definition', e.target.value)}
              placeholder="Ej: A pesar de eso / In spite of that fact"
              rows={2}
            />
          </div>
          <div className="be-field">
            <label className="be-label">
              Ejemplo en contexto
              <span className="be-label-hint">Opcional — aparece en la tarjeta de ClassroomOS</span>
            </label>
            <input
              className="be-input"
              type="text"
              value={term.example || ''}
              onChange={e => onUpdate(idx, 'example', e.target.value)}
              placeholder="Ej: It was raining; nevertheless, they went outside."
            />
          </div>
          <div className="be-field">
            <label className="be-label">
              Pronunciación
              <span className="be-label-hint">Opcional — transcripción fonética o guía de lectura</span>
            </label>
            <input
              className="be-input be-input--sm"
              type="text"
              value={term.pronunciation || ''}
              onChange={e => onUpdate(idx, 'pronunciation', e.target.value)}
              placeholder="Ej: /ˌnevərðəˈles/ · neh-ver-the-LESS"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function VocabForm({ data, onChange }) {
  const terms       = Array.isArray(data.terms) ? data.terms : []
  const displayMode = data.displayMode || 'cards'

  function addTerm()               { onChange({ ...data, terms: [...terms, { word: '', definition: '', example: '', pronunciation: '' }] }) }
  function removeTerm(i)           { onChange({ ...data, terms: terms.filter((_, idx) => idx !== i) }) }
  function updateTerm(i, key, val) { onChange({ ...data, terms: terms.map((t, idx) => idx === i ? { ...t, [key]: val } : t) }) }
  function moveTerm(i, dir) {
    const next = [...terms]
    const target = i + dir
    if (target < 0 || target >= next.length) return
    ;[next[i], next[target]] = [next[target], next[i]]
    onChange({ ...data, terms: next })
  }

  return (
    <div className="be-form">
      {/* Display mode */}
      <div className="be-field">
        <label className="be-label">
          Modo de presentación en ClassroomOS
          <span className="be-label-hint">How are the words displayed during TOPICS?</span>
        </label>
        <div className="be-subtype-grid">
          {DISPLAY_MODES.map(m => (
            <button
              key={m.value}
              type="button"
              className={`be-subtype-btn ${displayMode === m.value ? 'active' : ''}`}
              onClick={() => onChange({ ...data, displayMode: m.value })}
            >
              <span className="be-subtype-label">{m.label}</span>
              <span className="be-subtype-hint">{m.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Heading */}
      <div className="be-field">
        <label className="be-label">
          Encabezado (opcional)
          <span className="be-label-hint">Aparece como título sobre la lista — ej: "Vocabulary List · Unit 4"</span>
        </label>
        <input
          className="be-input"
          type="text"
          value={data.heading || ''}
          onChange={e => onChange({ ...data, heading: e.target.value })}
          placeholder="Ej: Vocabulary List · Unit 4 · Past Tense Verbs"
        />
      </div>

      {/* Terms list */}
      <div className="be-field">
        <label className="be-label">
          Términos ({terms.length})
          <span className="be-label-hint">Recomiendado: 6–10 términos por clase</span>
        </label>
        <div className="vocab-terms-list">
          {terms.map((term, idx) => (
            <TermRow
              key={idx}
              term={term}
              idx={idx}
              total={terms.length}
              onUpdate={updateTerm}
              onRemove={removeTerm}
              onMove={moveTerm}
            />
          ))}
          {terms.length < 15 && (
            <button className="be-add-item-btn" onClick={addTerm}>
              + Agregar término
            </button>
          )}
          {terms.length === 0 && (
            <p style={{ fontSize: 12, color: '#aaa', margin: '4px 0' }}>Aún no hay términos. Agrega el primero.</p>
          )}
        </div>
      </div>
    </div>
  )
}
