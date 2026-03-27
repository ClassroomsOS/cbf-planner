import { useState } from 'react'
import { suggestSectionActivity, analyzeGuide, generateGuideStructure } from '../utils/AIAssistant'

// ══════════════════════════════════════════════════════════════
// PUNTO 1 — AISuggestButton (inline en cada sección)
// ══════════════════════════════════════════════════════════════
export function AISuggestButton({ section, grade, subject, objective, unit, dayName, existingContent, onInsert }) {
  const [loading,     setLoading]     = useState(false)
  const [suggestion,  setSuggestion]  = useState(null)
  const [error,       setError]       = useState(null)
  const [open,        setOpen]        = useState(false)

  async function handleSuggest() {
    setLoading(true); setError(null); setSuggestion(null); setOpen(true)
    try {
      const result = await suggestSectionActivity({
        section, grade, subject, objective, unit, dayName, existingContent
      })
      setSuggestion(result)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  function handleInsert() {
    if (suggestion) {
      onInsert(suggestion)
      setOpen(false)
      setSuggestion(null)
    }
  }

  return (
    <div className="ai-suggest-wrap">
      <button className="ai-suggest-btn" onClick={handleSuggest} disabled={loading}>
        {loading ? '⏳ Pensando…' : '✨ Sugerir con IA'}
      </button>

      {open && (
        <div className="ai-suggest-panel">
          <div className="ai-suggest-header">
            <span>✨ Sugerencia de IA — {section.label}</span>
            <button onClick={() => setOpen(false)}>✕</button>
          </div>
          {loading && (
            <div className="ai-suggest-loading">
              <div className="loading-spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
              <span>Generando sugerencia…</span>
            </div>
          )}
          {error && (
            <div className="alert alert-error" style={{ margin: '10px' }}>{error}</div>
          )}
          {suggestion && !loading && (
            <>
              <div className="ai-suggest-content">{suggestion}</div>
              <div className="ai-suggest-footer">
                <button className="btn-secondary" onClick={() => setSuggestion(null)}>
                  🔄 Regenerar
                </button>
                <button className="btn-primary btn-save" onClick={handleInsert}>
                  ✅ Insertar en la sección
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// PUNTO 2 — AIAnalyzerModal (análisis completo pre-export)
// ══════════════════════════════════════════════════════════════
export function AIAnalyzerModal({ content, onClose }) {
  const [loading,  setLoading]  = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [error,    setError]    = useState(null)

  async function handleAnalyze() {
    setLoading(true); setError(null); setAnalysis(null)
    try {
      const result = await analyzeGuide(content)
      setAnalysis(result)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  // Auto-analyze on open
  useState(() => { handleAnalyze() }, [])

  // Format analysis with colored sections
  function formatAnalysis(text) {
    if (!text) return null
    const sections = [
      { marker: '✅ Fortalezas',       color: '#9BBB59', bg: '#f0fff4' },
      { marker: '⚠️ Alertas',          color: '#F79646', bg: '#fffbf0' },
      { marker: '💡 Sugerencias',      color: '#4BACC6', bg: '#f0faff' },
      { marker: '📊 Balance de tiempos', color: '#8064A2', bg: '#f8f4ff' },
    ]

    let result = text
    sections.forEach(s => {
      result = result.replace(
        new RegExp(`(${s.marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g'),
        `\n§SECTION§${s.marker}§${s.color}§${s.bg}§`
      )
    })

    return result.split('\n§SECTION§').map((block, i) => {
      if (i === 0) return block ? (
        <p key={i} style={{ fontSize: '13px', color: '#444', lineHeight: 1.7, marginBottom: '12px' }}>{block}</p>
      ) : null

      const parts = block.split('§')
      const marker = parts[0]
      const color  = parts[1]
      const bg     = parts[2]
      const body   = parts.slice(3).join('§')

      return (
        <div key={i} style={{
          background: bg, borderLeft: `3px solid ${color}`,
          borderRadius: '0 8px 8px 0', padding: '12px 16px',
          marginBottom: '12px',
        }}>
          <div style={{ fontWeight: 700, fontSize: '13px', color, marginBottom: '8px' }}>{marker}</div>
          <div style={{ fontSize: '12px', color: '#444', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {body.trim()}
          </div>
        </div>
      )
    }).filter(Boolean)
  }

  return (
    <div className="sb-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sb-modal" style={{ maxWidth: '680px' }}>
        <div className="sb-modal-header">
          <h2>🔍 Análisis pedagógico de la guía</h2>
          <button onClick={onClose}>✕</button>
        </div>

        <div className="sb-modal-body">
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '40px 20px' }}>
              <div className="loading-spinner" />
              <p style={{ color: '#888', fontSize: '13px' }}>Claude está analizando tu guía…</p>
            </div>
          )}
          {error && (
            <div>
              <div className="alert alert-error">{error}</div>
              <button className="btn-primary" onClick={handleAnalyze} style={{ marginTop: '10px' }}>
                Reintentar
              </button>
            </div>
          )}
          {analysis && !loading && (
            <div>{formatAnalysis(analysis)}</div>
          )}
        </div>

        <div className="sb-modal-footer">
          {analysis && (
            <button className="btn-secondary" onClick={handleAnalyze} disabled={loading}>
              🔄 Analizar de nuevo
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn-primary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// PUNTO 3 — AIGeneratorModal (generar guía desde objetivo)
// ══════════════════════════════════════════════════════════════
export function AIGeneratorModal({ grade, subject, period, activeDays, onApply, onClose }) {
  const [objective, setObjective] = useState('')
  const [unit,      setUnit]      = useState('')
  const [loading,   setLoading]   = useState(false)
  const [preview,   setPreview]   = useState(null)
  const [error,     setError]     = useState(null)

  const DAYS_ES = { mon:'Lunes', tue:'Martes', wed:'Miércoles', thu:'Jueves', fri:'Viernes' }
  const SECTION_LABELS = {
    subject: 'Subject', motivation: 'Motivation', activity: 'Activity',
    skill: 'Skill Development', closing: 'Closing', assignment: 'Assignment'
  }

  async function handleGenerate() {
    if (!objective.trim()) return
    setLoading(true); setError(null); setPreview(null)
    try {
      const result = await generateGuideStructure({
        grade, subject, period, objective, unit, activeDays
      })
      setPreview(result)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  function handleApply() {
    if (preview) {
      onApply(preview)
      onClose()
    }
  }

  return (
    <div className="sb-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sb-modal" style={{ maxWidth: '760px' }}>
        <div className="sb-modal-header">
          <h2>🤖 Generar guía con IA — {grade} · {subject}</h2>
          <button onClick={onClose}>✕</button>
        </div>

        <div className="sb-modal-body">
          {!preview && (
            <>
              <div style={{ background: '#f0f4ff', border: '1px solid #c5d5f0', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: '#2E5598', marginBottom: '16px' }}>
                💡 Claude generará una propuesta completa para los {activeDays.length} días de clase de esta semana.
                Tú editas, ajustas y decides qué usar.
              </div>

              <div className="ge-field">
                <label>🎯 ¿Qué quieres que los estudiantes logren esta semana?</label>
                <textarea rows={3}
                  value={objective}
                  placeholder="Ej: Al finalizar la semana, el estudiante podrá usar 'used to' y 'would' para describir hábitos pasados, distinguiendo cuándo usar cada uno."
                  onChange={e => setObjective(e.target.value)}
                  style={{ fontSize: '13px' }} />
              </div>

              <div className="ge-field">
                <label>📖 Unidad / Tema / Libro (opcional)</label>
                <input type="text"
                  value={unit}
                  placeholder="Ej: Uncover Unit 1 — Tell Me About It!, Cambridge pp. 6-11"
                  onChange={e => setUnit(e.target.value)} />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                <span style={{ fontSize: '11px', color: '#888', alignSelf: 'center' }}>Días a generar:</span>
                {activeDays.map(iso => {
                  const d = new Date(iso + 'T12:00:00')
                  const names = ['Lun','Mar','Mié','Jue','Vie']
                  return (
                    <span key={iso} style={{
                      fontSize: '11px', fontWeight: 700,
                      background: '#D6E4F0', color: '#1F3864',
                      padding: '3px 10px', borderRadius: '10px',
                    }}>
                      {names[d.getDay()-1]}
                    </span>
                  )
                })}
              </div>

              {error && <div className="alert alert-error">{error}</div>}

              <button className="btn-primary btn-save"
                disabled={!objective.trim() || loading}
                onClick={handleGenerate}
                style={{ width: '100%', padding: '12px', fontSize: '14px' }}>
                {loading ? '⏳ Claude está generando tu guía…' : '✨ Generar guía completa'}
              </button>

              {loading && (
                <div style={{ textAlign: 'center', marginTop: '16px', color: '#888', fontSize: '12px' }}>
                  Esto toma unos segundos…
                </div>
              )}
            </>
          )}

          {preview && !loading && (
            <>
              {/* Objective preview */}
              {preview.objetivo && (
                <div style={{ background: '#eef7e0', border: '1px solid #9BBB59', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px' }}>
                  <div style={{ fontWeight: 700, fontSize: '12px', color: '#9BBB59', marginBottom: '6px' }}>🎯 Objetivo generado</div>
                  <div style={{ fontSize: '12px', color: '#333', lineHeight: 1.6 }}>{preview.objetivo.general}</div>
                  {preview.objetivo.indicador && (
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>📋 {preview.objetivo.indicador}</div>
                  )}
                </div>
              )}

              {/* Days preview */}
              {Object.entries(preview.days || {})
                .sort(([a],[b]) => a.localeCompare(b))
                .map(([iso, day]) => {
                  const d = new Date(iso + 'T12:00:00')
                  const names = ['Lunes','Martes','Miércoles','Jueves','Viernes']
                  return (
                    <div key={iso} style={{ border: '1.5px solid #dde5f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '12px' }}>
                      <div style={{ background: '#1F3864', color: '#fff', padding: '8px 14px', fontWeight: 700, fontSize: '12px' }}>
                        📅 {names[d.getDay()-1]} — {iso}
                        {day.unit && <span style={{ opacity: .7, fontWeight: 400, marginLeft: '8px' }}>· {day.unit}</span>}
                      </div>
                      {Object.entries(day.sections || {}).map(([key, s]) => (
                        <div key={key} style={{ padding: '8px 14px', borderBottom: '1px solid #eee', fontSize: '12px' }}>
                          <span style={{ fontWeight: 700, color: '#2E5598', marginRight: '8px' }}>{SECTION_LABELS[key]}:</span>
                          <span style={{ color: '#444', lineHeight: 1.5 }}>{s.content}</span>
                        </div>
                      ))}
                    </div>
                  )
                })}

              {preview.summary?.next && (
                <div style={{ background: '#f8faff', border: '1px solid #dde5f0', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#555' }}>
                  <strong>Próxima semana sugerida:</strong> {preview.summary.next}
                </div>
              )}
            </>
          )}
        </div>

        <div className="sb-modal-footer">
          {preview && (
            <button className="btn-secondary" onClick={() => setPreview(null)}>
              ← Ajustar parámetros
            </button>
          )}
          <div style={{ flex: 1 }} />
          {preview && (
            <button className="btn-primary btn-save" onClick={handleApply}
              style={{ fontSize: '13px' }}>
              ✅ Aplicar a la guía
            </button>
          )}
          {!preview && (
            <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          )}
        </div>
      </div>
    </div>
  )
}
