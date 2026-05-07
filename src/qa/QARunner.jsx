// QARunner — panel flotante + spotlight (Nivel B + C)
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQA } from './QAContext'
import QASummary from './QASummary'

// ── Spotlight ─────────────────────────────────────────────────────────────────

function Spotlight({ selector }) {
  const [rect, setRect] = useState(null)
  const rafRef = useRef(null)

  const update = useCallback(() => {
    if (!selector) { setRect(null); return }
    const el = document.querySelector(selector)
    if (!el) { setRect(null); return }
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [selector])

  useEffect(() => {
    update()
    const onScroll = () => { cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(update) }
    const onResize = () => update()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    const observer = new MutationObserver(update)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true })
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
      observer.disconnect()
      cancelAnimationFrame(rafRef.current)
    }
  }, [update])

  if (!rect) return null

  const PAD = 6
  return (
    <div
      className="qa-spotlight"
      style={{
        top:    rect.top    - PAD,
        left:   rect.left   - PAD,
        width:  rect.width  + PAD * 2,
        height: rect.height + PAD * 2,
      }}
    />
  )
}

// ── QARunner ──────────────────────────────────────────────────────────────────

export default function QARunner({ onStoreLast, teacher }) {
  const { isRunning, suite, stepIndex, currentStep, showSummary, markStep, abort } = useQA()
  const navigate   = useNavigate()
  const location   = useLocation()
  const [noteOpen,   setNoteOpen]   = useState(false)
  const [localNote,  setLocalNote]  = useState('')

  const total   = suite?.steps?.length ?? 0
  const pct     = total > 0 ? Math.round((stepIndex / total) * 100) : 0
  const onRoute = currentStep?.route ? location.pathname === currentStep.route : true

  useEffect(() => { setNoteOpen(false); setLocalNote('') }, [stepIndex])

  function handleMark(status) {
    markStep(status, localNote)
    setNoteOpen(false)
    setLocalNote('')
  }

  if (showSummary) {
    return (
      <QASummary
        onClose={() => {}}
        onStoreLast={onStoreLast}
        teacher={teacher}
      />
    )
  }

  if (!isRunning || !currentStep) return null

  return (
    <>
      {currentStep.spotlight && <Spotlight selector={currentStep.spotlight} />}

      <div className="qa-runner">
        {/* Header */}
        <div className="qa-runner-header">
          <div className="qa-runner-title-row">
            <span className="qa-runner-icon">🧪</span>
            <span className="qa-runner-suite-name">{suite.name}</span>
            <button className="qa-runner-abort" onClick={abort} title="Abortar suite">✕</button>
          </div>
          <div className="qa-runner-progress-row">
            <span className="qa-runner-step-count">Paso {stepIndex + 1} / {total}</span>
            <div className="qa-runner-progress-bar">
              <div className="qa-runner-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="qa-runner-pct">{pct}%</span>
          </div>
        </div>

        {/* Body */}
        <div className="qa-runner-body">
          <div className="qa-runner-step-title">{currentStep.title}</div>
          <p className="qa-runner-step-desc">{currentStep.description}</p>

          {currentStep.hint && (
            <div className="qa-runner-hint">
              <span>💡</span>
              <span>{currentStep.hint}</span>
            </div>
          )}

          {/* Level C — Navigate */}
          {currentStep.route && !onRoute && (
            <button className="qa-nav-btn" onClick={() => navigate(currentStep.route)}>
              → Ir a {currentStep.route}
            </button>
          )}
          {currentStep.route && onRoute && (
            <div className="qa-nav-ok">✓ Ya estás en {currentStep.route}</div>
          )}

          {/* Note */}
          {!noteOpen ? (
            <button className="qa-note-toggle" onClick={() => setNoteOpen(true)}>
              + Añadir nota
            </button>
          ) : (
            <textarea
              className="qa-note"
              rows={2}
              placeholder="Observación opcional…"
              value={localNote}
              onChange={e => setLocalNote(e.target.value)}
              autoFocus
            />
          )}
        </div>

        {/* Actions */}
        <div className="qa-runner-actions">
          <button className="qa-btn-pass" onClick={() => handleMark('pass')}>✓ Pasa</button>
          <button className="qa-btn-fail" onClick={() => handleMark('fail')}>✗ Falla</button>
          <button className="qa-btn-skip" onClick={() => handleMark('skip')}>⏭</button>
        </div>
      </div>
    </>
  )
}
