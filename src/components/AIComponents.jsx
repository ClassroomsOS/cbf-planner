import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { suggestSectionActivity, analyzeGuide, generateGuideStructure } from '../utils/AIAssistant'
import { useToast } from '../context/ToastContext'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { MODELO_B_SUBJECTS } from '../utils/constants'

// ══════════════════════════════════════════════════════════════
// PUNTO 1 — AISuggestButton (inline en cada sección)
// ══════════════════════════════════════════════════════════════
export const AISuggestButton = memo(function AISuggestButton({ section, grade, subject, objective, unit, dayName, existingContent, onInsert, learningTarget, principles }) {
  const { showToast } = useToast()
  const [loading,     setLoading]     = useState(false)
  const [suggestion,  setSuggestion]  = useState(null)
  const [error,       setError]       = useState(null)
  const [open,        setOpen]        = useState(false)

  const handleSuggest = useCallback(async () => {
    setLoading(true); setError(null); setSuggestion(null); setOpen(true)
    try {
      const result = await suggestSectionActivity({
        section, grade, subject, objective, unit, dayName, existingContent, learningTarget, principles
      })
      setSuggestion(result)
    } catch (e) {
      const errorMsg = e.message || 'Error al generar sugerencia'
      setError(errorMsg)
      showToast(errorMsg, 'error')
    }
    setLoading(false)
  }, [section, grade, subject, objective, unit, dayName, existingContent, learningTarget, principles, showToast])

  const handleInsert = useCallback(() => {
    if (suggestion) {
      onInsert(suggestion)
      setOpen(false)
      setSuggestion(null)
    }
  }, [suggestion, onInsert])

  return (
    <div className="ai-suggest-wrap">
      <button className="ai-suggest-btn" onClick={handleSuggest} disabled={loading}>
        {loading ? '⏳ Pensando…' : '✨ Sugerir con IA'}
      </button>

      {open && (
        <div className="ai-suggest-panel">
          <div className="ai-suggest-header">
            <span>✨ Sugerencia de IA — {section.label}</span>
            <button onClick={() => setOpen(false)} aria-label="Cerrar panel de sugerencias">✕</button>
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
})

// ══════════════════════════════════════════════════════════════
// PUNTO 2 — AIAnalyzerModal (análisis completo pre-export)
// ══════════════════════════════════════════════════════════════
export const AIAnalyzerModal = memo(function AIAnalyzerModal({ content, onClose, principles }) {
  const { showToast } = useToast()
  const [loading,  setLoading]  = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [error,    setError]    = useState(null)

  const modalRef = useFocusTrap(true, onClose)

  const handleAnalyze = useCallback(async () => {
    setLoading(true); setError(null); setAnalysis(null)
    try {
      const result = await analyzeGuide(content, null, principles)
      setAnalysis(result)
    } catch (e) {
      const errorMsg = e.message || 'Error al analizar la guía'
      setError(errorMsg)
      showToast(errorMsg, 'error')
    }
    setLoading(false)
  }, [content, principles, showToast])

  // Auto-analyze on open
  useEffect(() => { handleAnalyze() }, [handleAnalyze])

  // Format analysis with colored sections
  function formatAnalysis(text) {
    if (!text) return null
    const sections = [
      { marker: '✅ Fortalezas',                  color: '#9BBB59', bg: '#f0fff4' },
      { marker: '⚠️ Alertas',                     color: '#F79646', bg: '#fffbf0' },
      { marker: '💡 Sugerencias',                 color: '#4BACC6', bg: '#f0faff' },
      { marker: '📊 Balance de tiempos',          color: '#8064A2', bg: '#f8f4ff' },
      { marker: '🙏 Integración del principio bíblico', color: '#C9A84C', bg: '#fffbf0' },
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
    <div className="sb-modal-overlay">
      <div ref={modalRef} className="sb-modal" style={{ maxWidth: '680px' }}>
        <div className="sb-modal-header">
          <h2>🔍 Análisis pedagógico de la guía</h2>
          <button onClick={onClose} aria-label="Cerrar análisis pedagógico">✕</button>
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
})

// ══════════════════════════════════════════════════════════════
// PUNTO 3 — AIGeneratorModal (generar guía desde objetivo)
// ══════════════════════════════════════════════════════════════
const SKILL_COLORS = { Speaking: '#8064A2', Listening: '#4BACC6', Reading: '#F79646', Writing: '#9BBB59' }
const SKILL_ICONS  = { Speaking: '🎤', Listening: '🎧', Reading: '📖', Writing: '✍️' }

export const AIGeneratorModal = memo(function AIGeneratorModal({ grade, subject, period, activeDays, currentContent, onApply, onClose, learningTarget, activeIndicator, principles }) {
  const { showToast } = useToast()

  const isModeloB = learningTarget?.news_model === 'language' || MODELO_B_SUBJECTS.includes(subject)
  const [selectedSkill,   setSelectedSkill]   = useState(activeIndicator?.habilidad || null)
  const [unit,            setUnit]            = useState('')
  const [loading,   setLoading]   = useState(false)
  const [preview,   setPreview]   = useState(null)
  const [error,     setError]     = useState(null)
  const [progress,  setProgress]  = useState(0)
  const progressRef = useRef(null)

  const modalRef = useFocusTrap(true, onClose)

  const PROGRESS_STEPS = [
    { at:  0, msg: 'Analizando objetivo y contexto…' },
    { at: 20, msg: 'Diseñando actividades para cada día…' },
    { at: 45, msg: 'Construyendo la estructura de la guía…' },
    { at: 68, msg: 'Revisando coherencia pedagógica…' },
    { at: 88, msg: 'Finalizando detalles…' },
  ]

  useEffect(() => {
    if (loading) {
      setProgress(0)
      progressRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 94) { clearInterval(progressRef.current); return 94 }
          // Accelerates at start, slows toward the end
          const increment = prev < 30 ? 3 : prev < 60 ? 1.5 : prev < 85 ? 0.6 : 0.2
          return Math.min(94, prev + increment)
        })
      }, 300)
    } else {
      clearInterval(progressRef.current)
      if (progress > 0) {
        setProgress(100)
        setTimeout(() => setProgress(0), 400)
      }
    }
    return () => clearInterval(progressRef.current)
  }, [loading])

  const progressMsg = [...PROGRESS_STEPS].reverse().find(s => progress >= s.at)?.msg || PROGRESS_STEPS[0].msg

  const DAYS_ES = { mon:'Lunes', tue:'Martes', wed:'Miércoles', thu:'Jueves', fri:'Viernes' }
  const SECTION_LABELS = {
    subject: 'Subject', motivation: 'Motivation', activity: 'Activity',
    skill: 'Skill Development', closing: 'Closing', assignment: 'Assignment'
  }

  const handleGenerate = useCallback(async () => {
    // Derive objective from the source of truth — never from editable user input
    const resolvedInd = activeIndicator || (selectedSkill
      ? (learningTarget?.indicadores || []).find(i => typeof i === 'object' && i.habilidad?.toLowerCase() === selectedSkill.toLowerCase())
      : null)
    const objective = resolvedInd
      ? (resolvedInd.texto_en || resolvedInd.habilidad || '')
      : (learningTarget?.description || '')
    if (!objective.trim()) return
    setLoading(true); setError(null); setPreview(null)
    try {
      const result = await generateGuideStructure({
        grade, subject, period, objective, unit, activeDays, learningTarget, principles
      })
      setPreview(result)
    } catch (e) {
      const errorMsg = e.message || 'Error al generar la guía'
      setError(errorMsg)
      showToast(errorMsg, 'error')
    }
    setLoading(false)
  }, [grade, subject, period, unit, activeDays, activeIndicator, selectedSkill, learningTarget, principles, showToast])

  const handleApply = useCallback(() => {
    if (!preview) return
    // If no currentContent, pass preview directly (PlannerPage handles merge itself)
    if (!currentContent) {
      onApply(preview)
      onClose()
      return
    }
    // GuideEditorPage: merge preview into existing content
    // objetivo.general e indicadores NO se sobreescriben — vienen de learning_targets (read-only)
    var base = JSON.parse(JSON.stringify(currentContent))
    if (preview.days) {
      var dKeys = Object.keys(preview.days)
      for (var di = 0; di < dKeys.length; di++) {
        var dIso = dKeys[di]
        var pDay = preview.days[dIso]
        if (!base.days[dIso]) continue
        if (pDay.unit) base.days[dIso].unit = pDay.unit
        if (pDay.sections) {
          var sKeys = Object.keys(pDay.sections)
          for (var si = 0; si < sKeys.length; si++) {
            var sKey = sKeys[si]
            var pSec = pDay.sections[sKey]
            if (base.days[dIso].sections && base.days[dIso].sections[sKey]) {
              if (pSec.content) {
                base.days[dIso].sections[sKey].content = pSec.content
              }
              // Convierte smartBlock (singular, de la IA) → smartBlocks[] (array del editor)
              if (pSec.smartBlock && pSec.smartBlock.type && pSec.smartBlock.model) {
                var newBlock = Object.assign({}, pSec.smartBlock, { id: Date.now() + si })
                base.days[dIso].sections[sKey].smartBlocks = [newBlock]
              }
            }
          }
        }
      }
    }
    if (preview.summary && preview.summary.next) base.summary.next = preview.summary.next
    onApply(base)
    onClose()
  }, [preview, currentContent, onApply, onClose])

  return (
    <div className="sb-modal-overlay">
      <div ref={modalRef} className="sb-modal" style={{ maxWidth: '760px' }}>
        <div className="sb-modal-header">
          <h2>🤖 Generar guía con IA — {grade} · {subject}</h2>
          <button onClick={onClose} aria-label="Cerrar generador de guías">✕</button>
        </div>

        <div className="sb-modal-body">
          {!preview && (
            <>
              {/* Sin learningTarget: bloqueado con instrucción */}
              {!learningTarget ? (
                <div style={{ background: '#fff8e1', border: '1px solid #f5c842', borderRadius: '8px', padding: '14px 16px', fontSize: '13px', color: '#7a5c00', lineHeight: 1.6 }}>
                  <div style={{ fontWeight: 700, marginBottom: '6px' }}>⚠️ No hay un Indicador de Logro vinculado</div>
                  La IA necesita el indicador para generar contenido alineado. Ve al panel <strong>1 · Indicador</strong> (barra izquierda) y vincula el indicador antes de generar.
                </div>
              ) : (
                <div style={{ background: '#f0f4ff', border: '1px solid #c5d5f0', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: '#2E5598', marginBottom: '16px' }}>
                  💡 Claude generará una propuesta completa para los {activeDays.length} días de clase {activeDays.length > 5 ? 'de estas dos semanas' : 'de esta semana'}.
                  Tú editas, ajustas y decides qué usar.
                </div>
              )}

              {/* Resto del formulario solo si hay indicador vinculado */}
              {learningTarget && <>

              {/* Modelo B sin indicador auto-detectado: selector de skill */}
              {isModeloB && !activeIndicator && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#555', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ¿Qué habilidad trabaja esta guía?
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {['Speaking', 'Listening', 'Reading', 'Writing'].map(skill => {
                      const ind = (learningTarget?.indicadores || []).find(
                        i => typeof i === 'object' && i.habilidad?.toLowerCase() === skill.toLowerCase()
                      )
                      const isActive = selectedSkill === skill
                      return (
                        <button
                          key={skill}
                          onClick={() => setSelectedSkill(skill)}
                          style={{
                            padding: '10px 14px', borderRadius: '10px',
                            border: `2px solid ${SKILL_COLORS[skill]}`,
                            background: isActive ? SKILL_COLORS[skill] : '#fff',
                            color: isActive ? '#fff' : '#333',
                            fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                            textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '3px',
                          }}
                        >
                          <span style={{ color: isActive ? '#fff' : SKILL_COLORS[skill] }}>
                            {SKILL_ICONS[skill]} {skill}
                          </span>
                          {ind?.texto_en && (
                            <span style={{ fontSize: '11px', fontWeight: 400, opacity: 0.85, lineHeight: 1.4 }}>
                              {ind.texto_en}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Indicador resuelto (auto-detectado o seleccionado manualmente) */}
              {(() => {
                const resolved = activeIndicator || (selectedSkill
                  ? (learningTarget?.indicadores || []).find(i => typeof i === 'object' && i.habilidad?.toLowerCase() === selectedSkill.toLowerCase())
                  : null)
                const fallbackDesc = !isModeloB && learningTarget?.description
                if (!resolved && !fallbackDesc) return null
                const tax = resolved?.taxonomy || learningTarget?.taxonomy
                const taxLabel = tax === 'recognize' ? '👁️ Reconocer' : tax === 'apply' ? '🛠️ Aplicar' : '✨ Producir'
                const skillColor = resolved ? (SKILL_COLORS[resolved.habilidad] || '#2d7a2d') : '#2d7a2d'
                return (
                  <div style={{
                    background: '#f0f7f0', border: `1px solid ${skillColor}40`, borderRadius: '8px',
                    padding: '12px 14px', marginBottom: '16px',
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                  }}>
                    <span style={{ fontSize: '18px' }}>{resolved ? (SKILL_ICONS[resolved.habilidad] || '🎯') : '🎯'}</span>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: skillColor, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {resolved?.habilidad ? `Indicador — ${resolved.habilidad}` : 'Indicador de logro vinculado'}
                      </div>
                      <div style={{ fontSize: '13px', color: '#1a5c1a', lineHeight: 1.5 }}>
                        {resolved ? (resolved.texto_en || resolved.habilidad) : fallbackDesc}
                      </div>
                      <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                        Nivel: {taxLabel} — El AI generará contenido alineado a este indicador.
                      </div>
                    </div>
                  </div>
                )
              })()}

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
                disabled={loading || (isModeloB && !activeIndicator && !selectedSkill)}
                onClick={handleGenerate}
                style={{ width: '100%', padding: '12px', fontSize: '14px' }}>
                {loading ? '✨ Generando guía completa…' : '✨ Generar guía completa'}
              </button>

              {loading && (
                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#555', fontWeight: 600 }}>{progressMsg}</span>
                    <span style={{ fontSize: '11px', color: '#999' }}>{Math.round(progress)}%</span>
                  </div>
                  <div style={{ height: '8px', background: '#e8eef8', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${progress}%`,
                      background: 'linear-gradient(90deg, #2E5598, #8064A2)',
                      borderRadius: '99px',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              )}
              </>}
            </>
          )}

          {preview && !loading && (
            <>

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
})
