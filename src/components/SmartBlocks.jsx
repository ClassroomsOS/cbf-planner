// ── SmartBlocks.jsx ───────────────────────────────────────────────────────────
// SmartBlocksList (add/edit/delete UI) + SmartBlockModal (3-step wizard).
// Block forms per type → SmartBlockForm.jsx

import { useState, useCallback, useMemo, memo } from 'react'
import { createPortal } from 'react-dom'
import DOMPurify from 'dompurify'
import { suggestSmartBlock } from '../utils/AIAssistant'
import { useToast } from '../context/ToastContext'
import { BLOCK_TYPES, blockPreviewHTML, blockInteractiveHTML } from '../utils/smartBlockHtml'
import SmartBlockForm from './SmartBlockForm'

// Re-export for backward compatibility (exportHtml.js, GuideEditorPage.jsx)
export { BLOCK_TYPES, blockPreviewHTML, blockInteractiveHTML }

// ── SmartBlocks list + add button ─────────────────────────────────────────────
export const SmartBlocksList = memo(function SmartBlocksList({ blocks = [], onChange, aiContext }) {
  const { showToast } = useToast()
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editId,       setEditId]       = useState(null)
  const [suggesting,   setSuggesting]   = useState(false)
  const [suggestError, setSuggestError] = useState(null)

  const handleDelete = useCallback((id) => {
    onChange(blocks.filter(b => b.id !== id))
  }, [blocks, onChange])

  const handleEdit = useCallback((id) => {
    setEditId(id)
    setModalOpen(true)
  }, [])

  const handleSave = useCallback((block) => {
    if (editId != null) {
      onChange(blocks.map(b => b.id === editId ? { ...block, id: editId } : b))
    } else {
      onChange([...blocks, { ...block, id: Date.now() }])
    }
    setModalOpen(false)
    setEditId(null)
  }, [editId, blocks, onChange])

  const handleAISuggest = useCallback(async () => {
    if (!aiContext) return
    setSuggesting(true)
    setSuggestError(null)
    try {
      const result = await suggestSmartBlock({ ...aiContext, existingBlocks: blocks })
      if (result?.type && result?.model) {
        onChange([...blocks, { ...result, id: Date.now() }])
      }
    } catch (e) {
      const errorMsg = e.message || 'Error al sugerir bloque'
      setSuggestError(errorMsg)
      showToast(errorMsg, 'error')
    } finally {
      setSuggesting(false)
    }
  }, [aiContext, blocks, onChange, showToast])

  const editingBlock = useMemo(() =>
    editId != null ? blocks.find(b => b.id === editId) : null,
    [editId, blocks]
  )

  return (
    <div className="sb-list">
      {blocks.map(b => {
        const t = BLOCK_TYPES[b.type]
        if (!t) return null
        const m = t.models.find(m => m.id === b.model)
        return (
          <div key={b.id} className="sb-chip">
            <div className="sb-chip-header" style={{ background: `#${t.color}` }}>
              <span>{t.icon}</span>
              <span className="sb-chip-type">{t.label}</span>
              <span className="sb-chip-model">· {m?.label || b.model}</span>
              <div className="sb-chip-actions">
                <button onClick={() => handleEdit(b.id)} aria-label="Editar bloque">✏️ editar</button>
                <button onClick={() => handleDelete(b.id)} aria-label="Eliminar bloque">🗑️</button>
              </div>
            </div>
            <div className="sb-chip-preview"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(blockPreviewHTML(b)) }} />
          </div>
        )
      })}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button className="sb-add-btn" style={{ flex: 1 }} onClick={() => { setEditId(null); setModalOpen(true) }}>
          <span>＋</span> Agregar Bloque
        </button>
        {aiContext && (() => {
          const usedTypes = new Set(blocks.map(b => b.type))
          const allTypes = Object.keys(BLOCK_TYPES)
          const allCovered = allTypes.every(t => usedTypes.has(t))
          return (
            <button
              className="sb-add-btn"
              style={{ flex: 1, background: (suggesting || allCovered) ? '#e8eef8' : '#f0f4ff', borderColor: '#4BACC6', color: '#2E5598' }}
              onClick={handleAISuggest}
              disabled={suggesting || allCovered}
              title={allCovered ? 'Ya tienes todos los tipos de SmartBlocks disponibles en esta sección' : ''}>
              {suggesting ? <span>⏳ Pensando…</span> : allCovered ? <><span>✅</span> Todos los tipos usados</> : <><span>✨</span> Sugerir con IA</>}
            </button>
          )
        })()}
      </div>
      {suggestError && (
        <div style={{ fontSize: '11px', color: '#cc3333', marginTop: '4px' }}>⚠️ {suggestError}</div>
      )}

      {modalOpen && (
        <SmartBlockModal
          initial={editingBlock}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditId(null) }}
        />
      )}
    </div>
  )
})

// ── SmartBlockModal — 3-step wizard ──────────────────────────────────────────
function SmartBlockModal({ initial, onSave, onClose }) {
  const [step,     setStep]     = useState(initial ? 3 : 1)
  const [type,     setType]     = useState(initial?.type  || null)
  const [model,    setModel]    = useState(initial?.model || null)
  const [data,     setData]     = useState(initial?.data  || {})
  const [duration, setDuration] = useState(initial?.duration_minutes || '')

  const typeDef  = type  ? BLOCK_TYPES[type]                    : null
  const modelDef = model ? typeDef?.models.find(m => m.id === model) : null

  function handleSave() {
    onSave({ type, model, data, duration_minutes: duration ? parseInt(duration, 10) : undefined })
  }

  return createPortal(
    <div className="sb-modal-overlay">
      <div className="sb-modal">
        <div className="sb-modal-header">
          <h2>{initial ? '✏️ Editar Bloque' : '➕ Agregar Bloque Inteligente'}</h2>
          <button onClick={onClose}>✕</button>
        </div>

        {/* Stepper */}
        <div className="sb-modal-steps">
          {['1 · Tipo','2 · Modelo','3 · Contenido'].map((label, i) => (
            <div key={i} className={`sb-step ${step > i+1 ? 'done' : step === i+1 ? 'active' : ''}`}>
              {label}
            </div>
          ))}
        </div>

        <div className="sb-modal-body">

          {/* Step 1: Type */}
          {step === 1 && (
            <div className="sb-type-grid">
              {Object.entries(BLOCK_TYPES).map(([key, t]) => (
                <div key={key}
                  className={`sb-type-card ${type === key ? 'selected' : ''}`}
                  onClick={() => setType(key)}>
                  <div className="sb-type-icon">{t.icon}</div>
                  <div className="sb-type-name">{t.label}</div>
                  <div className="sb-type-desc">{t.desc}</div>
                </div>
              ))}
            </div>
          )}

          {/* Step 2: Model */}
          {step === 2 && typeDef && (
            <div>
              <p style={{ fontSize: '12px', color: '#555', marginBottom: '12px' }}>
                {typeDef.icon} <strong>{typeDef.label}</strong> — Elige el modelo visual:
              </p>
              <div className="sb-model-grid">
                {typeDef.models.map(m => (
                  <div key={m.id}
                    className={`sb-model-card ${model === m.id ? 'selected' : ''}`}
                    onClick={() => setModel(m.id)}>
                    <div className="sb-model-name">{m.label}</div>
                    <div className="sb-model-sub">{m.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Form */}
          {step === 3 && typeDef && modelDef && (
            <div>
              <div className="ge-field" style={{ marginBottom: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⏱️</span> Duración estimada (minutos)
                </label>
                <input
                  type="number" min="1" max="120" step="5"
                  value={duration}
                  placeholder="ej: 15"
                  style={{ width: '100px' }}
                  onChange={e => setDuration(e.target.value)}
                />
              </div>
              <SmartBlockForm
                type={type}
                model={model}
                data={data}
                onChange={setData}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sb-modal-footer">
          {step > 1 && <button className="btn-secondary" onClick={() => setStep(s => s-1)}>← Atrás</button>}
          <div style={{ flex: 1 }} />
          {step < 3 ? (
            <button className="btn-primary"
              disabled={step === 1 && !type || step === 2 && !model}
              onClick={() => setStep(s => s+1)}>
              Continuar →
            </button>
          ) : (
            <button className="btn-primary btn-save" onClick={handleSave}>✔ Guardar bloque</button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default SmartBlocksList
