import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { createPortal } from 'react-dom'
import { generateGuideStructure } from '../utils/AIAssistant'
import { useToast } from '../context/ToastContext'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { BLOCK_TYPES } from '../utils/smartBlockHtml'
import { ELEOT_DOMAINS, domainStatus } from '../hooks/useEleot'
import { buildSessionAgenda, totalMinutes } from '../utils/AgendaGenerator'
import { MODELO_B_SUBJECTS } from '../utils/constants'

// ── ConversationalGuideModal ──────────────────────────────────────────────────
// 5-step wizard for AI guide generation with full pedagogical context.
// Replaces AIGeneratorModal when called from GuideEditorPage "Generar guía".
//
// Props:
//   grade, subject, period, activeDays
//   indicator        — achievement_indicator row { text, skill_area, dimension }
//   achievementGoal  — full goal with indicators[]
//   activeNewsProject
//   currentContent   — existing lesson_plan.content (for eleot coverage preview)
//   principles       — { yearVerse, monthVerse, indicatorPrinciple }
//   eleotCoverage    — { A:0.0-1.0, … } from useEleot
//   onApply(preview) — callback when teacher accepts generated content
//   onClose()
// ─────────────────────────────────────────────────────────────────────────────

const STEP_LABELS = ['1 · Contexto', '2 · Foco', '3 · Bloques', '4 · Generar', '5 · Revisar']

const SECTION_LABELS = {
  subject: 'Subject', motivation: 'Motivation', activity: 'Activity',
  skill: 'Skill Development', closing: 'Closing', assignment: 'Assignment',
}

const SKILL_COLORS = { Speaking: '#8064A2', Listening: '#4BACC6', Reading: '#F79646', Writing: '#9BBB59' }
const SKILL_ICONS  = { Speaking: '🎤',      Listening: '🎧',      Reading: '📖',      Writing: '✍️' }

// Block types available for selection (all 16)
const BLOCK_OPTIONS = Object.entries(BLOCK_TYPES).map(([key, t]) => ({
  key, label: t.label, icon: t.icon, color: t.color,
}))

const PROGRESS_STEPS = [
  { at:  0, msg: 'Analizando contexto pedagógico…' },
  { at: 20, msg: 'Diseñando actividades para cada día…' },
  { at: 45, msg: 'Construyendo estructura de la guía…' },
  { at: 68, msg: 'Revisando coherencia con eleot®…' },
  { at: 88, msg: 'Finalizando detalles bíblicos…' },
]

export const ConversationalGuideModal = memo(function ConversationalGuideModal({
  grade, subject, period, activeDays,
  indicator, achievementGoal, activeNewsProject,
  currentContent, principles, eleotCoverage,
  onApply, onClose,
}) {
  const { showToast } = useToast()
  const [step,     setStep]     = useState(1)
  const [unit,     setUnit]     = useState('')
  const [focusSkill, setFocusSkill] = useState(indicator?.skill_area || null)
  const [eleotFocus,  setEleotFocus]  = useState([])   // weak domain IDs to strengthen
  const [selectedBlocks, setSelectedBlocks] = useState([]) // block type keys to prefer
  const [loading,  setLoading]  = useState(false)
  const [preview,  setPreview]  = useState(null)
  const [error,    setError]    = useState(null)
  const [progress, setProgress] = useState(0)
  const [dayOpen,  setDayOpen]  = useState({})
  const progressRef = useRef(null)
  const modalRef = useFocusTrap(true, onClose)

  // Pre-select weak domains
  useEffect(() => {
    if (!eleotCoverage) return
    const weak = Object.keys(ELEOT_DOMAINS).filter(d => domainStatus(eleotCoverage[d] || 0) === 'weak')
    setEleotFocus(weak)
  }, [eleotCoverage])

  // Derive objective
  const objective = indicator
    ? (indicator.text || indicator.texto_en || indicator.habilidad || '')
    : (achievementGoal?.text || '')

  const isModeloB = MODELO_B_SUBJECTS.includes(subject)

  // ── Progress bar animation ────────────────────────────────────────────────
  useEffect(() => {
    if (loading) {
      setProgress(0)
      progressRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 94) { clearInterval(progressRef.current); return 94 }
          const inc = prev < 30 ? 3 : prev < 60 ? 1.5 : prev < 85 ? 0.6 : 0.2
          return Math.min(94, prev + inc)
        })
      }, 300)
    } else {
      clearInterval(progressRef.current)
      if (progress > 0) { setProgress(100); setTimeout(() => setProgress(0), 400) }
    }
    return () => clearInterval(progressRef.current)
  }, [loading])

  const progressMsg = [...PROGRESS_STEPS].reverse().find(s => progress >= s.at)?.msg || PROGRESS_STEPS[0].msg

  // ── Generate ──────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!objective.trim()) return
    setLoading(true); setError(null); setPreview(null)
    try {
      // Build focus hint for prompt
      const focusHints = []
      if (eleotFocus.length) {
        const names = eleotFocus.map(d => ELEOT_DOMAINS[d]?.full || d)
        focusHints.push(`Fortalecer dominios eleot®: ${names.join(', ')}`)
      }
      if (focusSkill) focusHints.push(`Énfasis en habilidad: ${focusSkill}`)
      if (selectedBlocks.length) {
        const labels = selectedBlocks.map(k => BLOCK_TYPES[k]?.label || k)
        focusHints.push(`Smart Blocks preferidos: ${labels.join(', ')}`)
      }

      const result = await generateGuideStructure({
        grade, subject, objective, unit, period, activeDays,
        achievementGoal,
        activeNewsProject, principles,
        _focusHints: focusHints,
      })
      setPreview(result)
      // Default: all days open
      const open = {}
      Object.keys(result?.days || {}).forEach(k => { open[k] = true })
      setDayOpen(open)
      setStep(5)
    } catch (e) {
      const msg = e.message || 'Error al generar la guía'
      setError(msg)
      showToast(msg, 'error')
    }
    setLoading(false)
  }, [grade, subject, objective, unit, period, activeDays, eleotFocus, focusSkill, selectedBlocks, indicator, achievementGoal, activeNewsProject, principles, showToast])

  // ── Apply ─────────────────────────────────────────────────────────────────
  const handleApply = useCallback(() => {
    if (!preview) return
    onApply(preview)
    onClose()
  }, [preview, onApply, onClose])

  const canNext1 = !!objective.trim()
  const canNext2 = true  // focus is optional
  const canGenerate = !!objective.trim()

  // ── Render step content ───────────────────────────────────────────────────
  function renderStep() {
    switch (step) {

      // ── Step 1: Context ────────────────────────────────────────────────
      case 1: return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Indicator card */}
          {objective ? (
            <div style={{ background: '#f0fff4', border: '1px solid #9BBB59', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#3d7a20', marginBottom: '4px', textTransform: 'uppercase' }}>
                Indicador de Logro
              </div>
              <div style={{ fontSize: '13px', color: '#1a3a10', lineHeight: 1.5 }}>{objective}</div>
              {indicator?.skill_area && (
                <span style={{ fontSize: '9px', background: SKILL_COLORS[indicator.skill_area] || '#888', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontWeight: 700, marginTop: '6px', display: 'inline-block' }}>
                  {SKILL_ICONS[indicator.skill_area] || ''} {indicator.skill_area}
                </span>
              )}
            </div>
          ) : (
            <div style={{ background: '#fff8e6', border: '1px solid #e8d5a0', borderRadius: '8px', padding: '12px', fontSize: '12px', color: '#7a5a10' }}>
              ⚠️ No hay indicador vinculado. Ve al panel <strong>1 · Indicador</strong> y selecciona un logro antes de generar.
            </div>
          )}

          {/* NEWS project */}
          {activeNewsProject && (
            <div style={{ background: '#f0f8f0', border: '1px solid #b8d8b8', borderRadius: '8px', padding: '10px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#1A6B3A', marginBottom: '4px', textTransform: 'uppercase' }}>
                📋 Proyecto NEWS activo
              </div>
              <div style={{ fontSize: '12px', color: '#1a3a10', fontWeight: 600 }}>{activeNewsProject.title}</div>
              {activeNewsProject.due_date && (
                <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>📅 Entrega: {activeNewsProject.due_date}</div>
              )}
            </div>
          )}

          {/* Active days */}
          <div style={{ background: '#f0f4ff', border: '1px solid #c8d8f8', borderRadius: '8px', padding: '10px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#2E5598', marginBottom: '6px', textTransform: 'uppercase' }}>
              Días de clase ({activeDays?.length || 0})
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(activeDays || []).map(iso => {
                const d = new Date(iso + 'T12:00:00')
                const names = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
                return (
                  <span key={iso} style={{ fontSize: '11px', background: '#2E5598', color: '#fff', padding: '2px 8px', borderRadius: '10px' }}>
                    {names[d.getDay()]} {d.getDate()}
                  </span>
                )
              })}
            </div>
          </div>

          {/* Unit/topic */}
          <div className="ge-field">
            <label>📖 Unidad / Tema / Libro (opcional)</label>
            <input type="text" value={unit} placeholder="Unit 4 — Past Simple / Unidades 3-4"
              onChange={e => setUnit(e.target.value)} />
          </div>
        </div>
      )

      // ── Step 2: Pedagogical focus ──────────────────────────────────────
      case 2: return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* eleot® weak domains */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#1F3864', marginBottom: '8px' }}>
              📊 Dominios eleot® a fortalecer
              <span style={{ fontWeight: 400, color: '#888', marginLeft: '8px' }}>
                ({eleotFocus.length} seleccionados — IA priorizará bloques que cubran estos dominios)
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Object.entries(ELEOT_DOMAINS).map(([id, d]) => {
                const score = eleotCoverage?.[id] || 0
                const status = domainStatus(score)
                const selected = eleotFocus.includes(id)
                return (
                  <button key={id} type="button"
                    onClick={() => setEleotFocus(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px',
                      borderRadius: '16px', fontSize: '11px', cursor: 'pointer', fontWeight: 600,
                      border: `2px solid ${selected ? d.color : '#ddd'}`,
                      background: selected ? d.bg : '#fff',
                      color: selected ? d.color : '#888',
                    }}>
                    <span style={{ width: 16, height: 16, borderRadius: 3, background: d.color, color: '#fff', fontSize: 9, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{id}</span>
                    {d.label}
                    {status === 'weak' && <span style={{ fontSize: 9, color: '#CC4E10' }}>⚠</span>}
                    {status === 'covered' && <span style={{ fontSize: 9, color: '#1A6B3A' }}>✓</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Skill focus (Modelo B) */}
          {isModeloB && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#1F3864', marginBottom: '8px' }}>
                🎯 Habilidad a enfatizar esta semana
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['Speaking','Listening','Reading','Writing'].map(sk => (
                  <button key={sk} type="button"
                    onClick={() => setFocusSkill(prev => prev === sk ? null : sk)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px',
                      borderRadius: '20px', fontSize: '12px', cursor: 'pointer', fontWeight: 700,
                      border: `2px solid ${focusSkill === sk ? SKILL_COLORS[sk] : '#ddd'}`,
                      background: focusSkill === sk ? SKILL_COLORS[sk] : '#fff',
                      color: focusSkill === sk ? '#fff' : '#888',
                    }}>
                    {SKILL_ICONS[sk]} {sk}
                  </button>
                ))}
                {focusSkill && (
                  <button type="button" onClick={() => setFocusSkill(null)}
                    style={{ fontSize: '11px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
                    ✕ quitar énfasis
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Focus summary */}
          <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: '10px', fontSize: '11px', color: '#555' }}>
            {eleotFocus.length === 0 && !focusSkill
              ? '💡 Sin foco especial — la IA generará una guía equilibrada.'
              : `💡 La IA priorizará: ${[
                  eleotFocus.length ? `dominios ${eleotFocus.join(', ')}` : null,
                  focusSkill ? `habilidad ${focusSkill}` : null,
                ].filter(Boolean).join(' + ')}`
            }
          </div>
        </div>
      )

      // ── Step 3: Smart Block preferences ───────────────────────────────
      case 3: return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '12px', color: '#555', margin: 0 }}>
            Selecciona los tipos de Smart Block que prefieres incluir.
            La IA los usará como guía (máx. 2 por día).
            Si no seleccionas ninguno, la IA elige libremente.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '6px' }}>
            {BLOCK_OPTIONS.map(({ key, label, icon, color }) => {
              const selected = selectedBlocks.includes(key)
              return (
                <button key={key} type="button"
                  onClick={() => setSelectedBlocks(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px',
                    borderRadius: '8px', fontSize: '11px', cursor: 'pointer', textAlign: 'left',
                    border: `2px solid ${selected ? `#${color}` : '#e0e0e0'}`,
                    background: selected ? `#${color}18` : '#fff',
                    color: selected ? `#${color}` : '#666',
                    fontWeight: selected ? 700 : 400,
                  }}>
                  <span>{icon}</span>
                  <span style={{ lineHeight: 1.2 }}>{label}</span>
                  {selected && <span style={{ marginLeft: 'auto', fontSize: '12px' }}>✓</span>}
                </button>
              )
            })}
          </div>
          {selectedBlocks.length > 0 && (
            <div style={{ fontSize: '11px', color: '#2E5598', background: '#f0f4ff', padding: '8px 12px', borderRadius: '8px' }}>
              {selectedBlocks.length} tipo{selectedBlocks.length !== 1 ? 's' : ''} seleccionado{selectedBlocks.length !== 1 ? 's' : ''}:&nbsp;
              {selectedBlocks.map(k => BLOCK_TYPES[k]?.icon + ' ' + BLOCK_TYPES[k]?.label).join(', ')}
            </div>
          )}
        </div>
      )

      // ── Step 4: Generating ────────────────────────────────────────────
      case 4: return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '20px 0' }}>
          {loading ? (
            <>
              <div className="loading-spinner" style={{ width: '48px', height: '48px', borderWidth: '4px' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1F3864', marginBottom: '6px' }}>
                  {progressMsg}
                </div>
                <div style={{ width: '260px', height: '8px', background: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg, #1F3864, #4BACC6)', borderRadius: '4px', width: `${progress}%`, transition: 'width 0.3s ease' }} />
                </div>
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '6px' }}>{Math.round(progress)}%</div>
              </div>
            </>
          ) : error ? (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              <div style={{ fontSize: '40px' }}>⚠️</div>
              <div style={{ color: '#cc3333', fontSize: '13px', maxWidth: '400px' }}>{error}</div>
              <button className="btn-primary" onClick={handleGenerate}>🔄 Reintentar</button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#888', fontSize: '13px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🤖</div>
              Listo para generar. Haz clic en <strong>Generar →</strong>
            </div>
          )}
        </div>
      )

      // ── Step 5: Review ────────────────────────────────────────────────
      case 5: return preview ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ fontSize: '12px', color: '#555', margin: '0 0 4px' }}>
            Revisa el contenido generado. Puedes expandir cada día para ver las secciones.
            Al hacer clic en <strong>Aplicar →</strong> se combina con tu guía actual.
          </p>

          {/* Objective summary */}
          {preview.objetivo?.general && (
            <div style={{ background: '#f0fff4', border: '1px solid #9BBB59', borderRadius: '6px', padding: '8px 12px', fontSize: '11px', color: '#1a3a10' }}>
              <strong>Objetivo:</strong> {preview.objetivo.general}
            </div>
          )}

          {/* Days */}
          {Object.entries(preview.days || {}).map(([iso, day]) => {
            const d = new Date(iso + 'T12:00:00')
            const dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
            const isOpen = dayOpen[iso]
            const sectionKeys = Object.keys(day.sections || {})
            return (
              <div key={iso} style={{ border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
                <button type="button"
                  onClick={() => setDayOpen(prev => ({ ...prev, [iso]: !prev[iso] }))}
                  style={{ width: '100%', padding: '8px 12px', background: '#f5f7ff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left' }}>
                  <span style={{ fontSize: '16px', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▶</span>
                  <strong style={{ fontSize: '12px', color: '#1F3864' }}>{dayNames[d.getDay()]} {d.getDate()}/{d.getMonth()+1}</strong>
                  {day.unit && <span style={{ fontSize: '10px', color: '#888' }}>{day.unit}</span>}
                  <span style={{ fontSize: '10px', color: '#aaa', marginLeft: 'auto' }}>{sectionKeys.length} secciones</span>
                </button>
                {isOpen && (
                  <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {sectionKeys.map(key => {
                      const sec = day.sections[key]
                      const text = (sec?.content || '').replace(/<[^>]+>/g, '').slice(0, 120)
                      const hasSB = sec?.smartBlock
                      return (
                        <div key={key} style={{ fontSize: '11px', padding: '4px 8px', background: '#fafafa', borderRadius: '4px', borderLeft: '3px solid #e0e0e0' }}>
                          <span style={{ fontWeight: 700, color: '#555', display: 'inline-block', width: '90px' }}>
                            {SECTION_LABELS[key] || key}
                          </span>
                          <span style={{ color: '#777' }}>{text || '—'}</span>
                          {hasSB && <span style={{ marginLeft: '6px', fontSize: '9px', background: '#4BACC6', color: '#fff', padding: '1px 5px', borderRadius: '8px', fontWeight: 700 }}>⚡ {sec.smartBlock.type}</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: '#aaa', padding: '40px' }}>
          Regresa al paso 4 para generar el contenido.
        </div>
      )

      default: return null
    }
  }

  // ── Footer buttons ────────────────────────────────────────────────────────
  function renderFooter() {
    if (step === 4 && loading) return (
      <div style={{ flex: 1, textAlign: 'center', fontSize: '11px', color: '#888' }}>
        Esto puede tomar 15–30 segundos…
      </div>
    )

    return (
      <>
        {step > 1 && step !== 4 && (
          <button className="btn-secondary" onClick={() => setStep(s => s - 1)}>← Atrás</button>
        )}
        <div style={{ flex: 1 }} />

        {step === 1 && (
          <button className="btn-primary" disabled={!canNext1}
            onClick={() => setStep(2)}>Siguiente →</button>
        )}
        {step === 2 && (
          <button className="btn-primary" onClick={() => setStep(3)}>Siguiente →</button>
        )}
        {step === 3 && (
          <button className="btn-primary" onClick={() => { setStep(4); handleGenerate() }}>
            🤖 Generar →
          </button>
        )}
        {step === 4 && !loading && !error && (
          <button className="btn-primary" disabled={!canGenerate} onClick={handleGenerate}>
            🤖 Generar →
          </button>
        )}
        {step === 5 && preview && (
          <>
            <button className="btn-secondary" onClick={() => { setStep(3); setPreview(null) }}>
              🔄 Regenerar
            </button>
            <button className="btn-primary btn-save" onClick={handleApply}>
              ✅ Aplicar a la guía →
            </button>
          </>
        )}
      </>
    )
  }

  return createPortal(
    <div className="sb-modal-overlay">
      <div ref={modalRef} className="sb-modal" style={{ maxWidth: '640px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="sb-modal-header">
          <h2>🤖 Generar guía con IA</h2>
          <button onClick={onClose} aria-label="Cerrar modal de generación">✕</button>
        </div>

        {/* Stepper */}
        <div className="sb-modal-steps">
          {STEP_LABELS.map((label, i) => (
            <div key={i} className={`sb-step ${step > i+1 ? 'done' : step === i+1 ? 'active' : ''}`}>
              {label}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="sb-modal-body" style={{ overflowY: 'auto', flex: 1 }}>
          {renderStep()}
        </div>

        {/* Footer */}
        <div className="sb-modal-footer">
          {renderFooter()}
        </div>
      </div>
    </div>,
    document.body
  )
})

export default ConversationalGuideModal
