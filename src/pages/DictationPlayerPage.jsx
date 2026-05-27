// ── DictationPlayerPage.jsx ───────────────────────────────────────────────────
// /eval/dictation — Player público para dictations.
// Anti-trampa 5 capas (reutiliza patrón ExamPlayerV2) · Audio TTS · Auto-corrección.

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabase'
import { colombianGrade as calcColombianGrade, gradeLevel, gradeColor } from '../utils/examUtils'
import { scoreDictation } from '../utils/dictationUtils'
import { logError } from '../utils/logger'

// ── Constants ─────────────────────────────────────────────────────────────────

const TELEGRAM_THROTTLE_MS = 60000
const AUTOSAVE_INTERVAL_MS = 30000
const HIGH_RISK_THRESHOLD  = 3
const MAX_REPLAYS          = 2

// ── IndexedDB helper ──────────────────────────────────────────────────────────

const IDB_NAME    = 'cbf_dictation'
const IDB_VERSION = 1

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('answers')) {
        db.createObjectStore('answers', { keyPath: 'key' })
      }
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = () => reject(req.error)
  })
}

async function idbSave(db, instanceId, qIndex, value) {
  const tx = db.transaction('answers', 'readwrite')
  tx.objectStore('answers').put({ key: `${instanceId}_${qIndex}`, value, ts: Date.now() })
}

async function idbLoadAll(db, instanceId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('answers', 'readonly')
    const req = tx.objectStore('answers').getAll()
    req.onsuccess = () => {
      const prefix = `${instanceId}_`
      const answers = {}
      req.result
        .filter(r => r.key.startsWith(prefix))
        .forEach(r => { answers[r.key.replace(prefix, '')] = r.value })
      resolve(answers)
    }
    req.onerror = () => reject(req.error)
  })
}

async function idbClear(db, instanceId) {
  const prefix = `${instanceId}_`
  const tx = db.transaction('answers', 'readwrite')
  const store = tx.objectStore('answers')
  const req = store.openCursor()
  req.onsuccess = e => {
    const cursor = e.target.result
    if (!cursor) return
    if (cursor.key.startsWith(prefix)) cursor.delete()
    cursor.continue()
  }
}

// ── Watermark canvas ──────────────────────────────────────────────────────────

function WatermarkCanvas({ text }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    function draw() {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.globalAlpha = 0.07
      ctx.fillStyle = '#000'
      ctx.font = 'bold 22px Arial'
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate(-Math.PI / 6)
      const stepX = 320, stepY = 120
      const cols = Math.ceil(canvas.width / stepX) + 2
      const rows = Math.ceil(canvas.height / stepY) + 2
      for (let r = -rows; r <= rows; r++) {
        for (let c = -cols; c <= cols; c++) {
          ctx.fillText(text, c * stepX, r * stepY)
        }
      }
      ctx.restore()
    }

    draw()
    window.addEventListener('resize', draw)

    const observer = new MutationObserver(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      if (!document.body.contains(canvas)) {
        document.body.appendChild(canvas)
        draw()
      } else {
        const s = canvas.style
        if (s.opacity === '0' || s.display === 'none' || s.visibility === 'hidden') {
          s.opacity = ''
          s.display = ''
          s.visibility = ''
          draw()
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true, attributes: true })

    return () => {
      window.removeEventListener('resize', draw)
      observer.disconnect()
    }
  }, [text])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, pointerEvents: 'none' }}
    />
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function DictationPlayerPage() {
  // ── Phase state machine ──
  const [phase, setPhase] = useState('entry') // entry | instructions | dictation | submitted
  const [error, setError] = useState(null)

  // ── Entry ──
  const [accessCode, setAccessCode] = useState('')
  const [entryLoading, setEntryLoading] = useState(false)

  // ── Instance data ──
  const [instance, setInstance] = useState(null)
  const [blueprint, setBlueprint] = useState(null)
  const [session, setSession] = useState(null)
  const [questions, setQuestions] = useState([])
  const correctAnsRef = useRef({})

  // ── Answers ──
  const [answers, setAnswers] = useState({})
  const answersRef = useRef({})

  // ── Timer ──
  const [timeLeft, setTimeLeft] = useState(null)

  // ── Anti-cheat ──
  const [violations, setViolations] = useState(0)
  const violationsRef = useRef(0)
  const lastAlertRef = useRef(0)
  const [violationAlert, setViolationAlert] = useState(null)

  // ── Audio ──
  const [replays, setReplays] = useState({})

  // ── Section tabs ──
  const [activeSection, setActiveSection] = useState(0)

  // ── Submission ──
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  // ── IDB ──
  const idbRef = useRef(null)
  const instanceRef = useRef(null)

  // Sync refs
  useEffect(() => { answersRef.current = answers }, [answers])
  useEffect(() => { violationsRef.current = violations }, [violations])
  useEffect(() => { instanceRef.current = instance }, [instance])

  // ── ENTRY FLOW ──────────────────────────────────────────────────────────────

  async function handleEntry() {
    if (!accessCode.trim()) return
    setEntryLoading(true)
    setError(null)

    try {
      const { data, error: rpcErr } = await supabase.rpc('get_dictation_instance_safe', {
        p_access_code: accessCode.trim().toUpperCase(),
      })

      if (rpcErr) throw rpcErr
      if (!data) {
        setError('Código no encontrado o el dictado no está activo.')
        setEntryLoading(false)
        return
      }

      const inst = data
      const ses = inst.session
      const bp = inst.blueprint

      if (!ses || ses.status === 'closed') {
        setError('Este dictado ya fue cerrado por el docente.')
        setEntryLoading(false)
        return
      }

      // Store correct answers in ref (NEVER in state)
      // Note: correct_answer was stripped by RPC — we DON'T have it on client
      // Scoring happens server-side via dictation-corrector

      setInstance(inst)
      setSession(ses)
      setBlueprint(bp)
      setQuestions(inst.generated_questions || [])

      // Group questions into sections for tab display
      // questions already have question_type and section_title

      // Open IndexedDB and load saved answers
      try {
        const db = await openIDB()
        idbRef.current = db
        const saved = await idbLoadAll(db, inst.id)
        if (Object.keys(saved).length > 0) {
          setAnswers(saved)
        }
      } catch (e) {
        console.warn('IndexedDB not available:', e)
      }

      // Save to localStorage for recovery
      localStorage.setItem('cbf_dictation_entry', JSON.stringify({
        code: accessCode.trim().toUpperCase(),
        instanceId: inst.id,
      }))

      setPhase('instructions')
    } catch (err) {
      logError(err, { page: 'DictationPlayerPage', action: 'entry' })
      setError(err.message || 'Error de conexión')
    } finally {
      setEntryLoading(false)
    }
  }

  // ── START DICTATION (after instructions) ────────────────────────────────────

  async function handleStart() {
    // Mark instance as started
    if (instance && instance.instance_status === 'ready') {
      await supabase
        .from('dictation_instances')
        .update({ instance_status: 'started', started_at: new Date().toISOString() })
        .eq('id', instance.id)

      sendTelegramNotification('dictation_started')
    }

    // Calculate timer
    const durationSec = (session?.duration_minutes || 30) * 60
    setTimeLeft(durationSec)

    // Request fullscreen
    try {
      await document.documentElement.requestFullscreen()
    } catch {
      // iOS doesn't support fullscreen — continue without it
    }

    setPhase('dictation')
  }

  // ── TIMER ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'dictation' || timeLeft === null) return
    if (timeLeft <= 0) {
      handleSubmit()
      return
    }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000)
    return () => clearInterval(timer)
  }, [phase, timeLeft])

  // ── AUTOSAVE ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'dictation' || !idbRef.current || !instance) return
    const interval = setInterval(() => {
      const db = idbRef.current
      const inst = instanceRef.current
      if (!db || !inst) return
      Object.entries(answersRef.current).forEach(([idx, val]) => {
        idbSave(db, inst.id, idx, val)
      })
    }, AUTOSAVE_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [phase, instance])

  // ── ANTI-CHEAT (Layer 1: Multi-event detection) ────────────────────────────

  useEffect(() => {
    if (phase !== 'dictation') return

    function registerViolation(eventType) {
      const newCount = violationsRef.current + 1
      violationsRef.current = newCount
      setViolations(newCount)

      // Update DB
      const inst = instanceRef.current
      if (inst) {
        supabase
          .from('dictation_instances')
          .update({
            tab_switches: newCount,
            integrity_flags: {
              high_risk: newCount >= HIGH_RISK_THRESHOLD,
              last_event: eventType,
              last_event_at: new Date().toISOString(),
            },
          })
          .eq('id', inst.id)
          .then(() => {})
      }

      // Show alert banner
      setViolationAlert({
        title: 'Warning',
        message: eventType === 'tab_switch'
          ? 'You switched tabs. This has been recorded.'
          : eventType === 'fullscreen_exit'
          ? 'You exited fullscreen. Please return to fullscreen.'
          : 'Suspicious activity detected and recorded.',
      })
      setTimeout(() => setViolationAlert(null), 5000)

      // Throttled Telegram alert
      const now = Date.now()
      if (now - lastAlertRef.current > TELEGRAM_THROTTLE_MS) {
        lastAlertRef.current = now
        sendTelegramNotification(eventType, { count: newCount })
      }
    }

    const onVisChange = () => { if (document.hidden) registerViolation('tab_switch') }
    const onBlur = () => registerViolation('window_blur')
    const onFsChange = () => { if (!document.fullscreenElement) registerViolation('fullscreen_exit') }
    const onContext = (e) => { e.preventDefault(); registerViolation('context_menu') }
    const onCopy = (e) => { e.preventDefault(); registerViolation('copy_attempt') }
    const onKeyDown = (e) => {
      if (e.key === 'F12' || (e.ctrlKey && e.key === 'u') || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        e.preventDefault()
        registerViolation('blocked_key')
      }
    }
    const onBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
      registerViolation('beforeunload')
    }

    document.addEventListener('visibilitychange', onVisChange)
    window.addEventListener('blur', onBlur)
    document.addEventListener('fullscreenchange', onFsChange)
    document.addEventListener('contextmenu', onContext)
    document.addEventListener('copy', onCopy)
    document.addEventListener('cut', onCopy)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', onVisChange)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('fullscreenchange', onFsChange)
      document.removeEventListener('contextmenu', onContext)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('cut', onCopy)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [phase])

  // ── TELEGRAM NOTIFICATION ──────────────────────────────────────────────────

  const sendTelegramNotification = useCallback(async (eventType, extra = {}) => {
    if (!session?.teacher_id || !instance) return
    try {
      const edgeFnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/exam-integrity-alert`
      await fetch(edgeFnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instance_id: instance.id,
          session_id: session.id,
          student_section: instance.student_section,
          exam_title: blueprint?.title || 'Dictation',
          event_type: eventType,
          count: extra.count || violationsRef.current,
          ...(eventType === 'dictation_started' ? { start_time: new Date().toISOString() } : {}),
          ...(eventType === 'dictation_submitted' ? {
            submit_time: new Date().toISOString(),
            score_info: extra.score_info || null,
          } : {}),
        }),
      })
    } catch {
      // Silent fail — don't block the student
    }
  }, [session, instance, blueprint])

  // ── ANSWER HANDLERS ─────────────────────────────────────────────────────────

  function updateAnswer(qIndex, value) {
    setAnswers(prev => ({ ...prev, [qIndex]: value }))
  }

  // ── AUDIO REPLAY ────────────────────────────────────────────────────────────

  function getReplayCount(qIndex) {
    return replays[qIndex] || 0
  }

  function handleReplay(qIndex, audioUrl) {
    const count = getReplayCount(qIndex)
    if (count >= MAX_REPLAYS) return
    setReplays(prev => ({ ...prev, [qIndex]: count + 1 }))
    const audio = new Audio(audioUrl)
    audio.play().catch(() => {})
  }

  // ── SUBMIT ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)

    try {
      const inst = instanceRef.current
      const currentAnswers = answersRef.current
      const startedAt = inst?.started_at ? new Date(inst.started_at) : new Date()
      const timeSpent = Math.round((Date.now() - startedAt.getTime()) / 1000)

      // 1. Insert responses (without correct_answer — we don't have it on client)
      const responses = questions.map((q, i) => ({
        instance_id: inst.id,
        question_index: i,
        question_type: q.question_type,
        answer: currentAnswers[i] || '',
        correct_answer: '', // will be filled by server
        is_correct: null,
        score: 0,
        max_score: q.max_score || 1,
      }))

      const { error: respErr } = await supabase
        .from('dictation_responses')
        .insert(responses)

      if (respErr) throw respErr

      // 2. Update instance
      await supabase
        .from('dictation_instances')
        .update({
          instance_status: 'submitted',
          submitted_at: new Date().toISOString(),
          time_spent_seconds: timeSpent,
          tab_switches: violationsRef.current,
        })
        .eq('id', inst.id)

      // 3. Call server-side corrector
      const edgeFnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dictation-corrector`
      const correctorRes = await fetch(edgeFnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance_id: inst.id }),
      })
      const correctorData = await correctorRes.json()

      if (correctorData.ok) {
        setResult(correctorData)
      } else {
        setResult({ total_score: 0, max_score: 1, colombian_grade: 1.0, grade_level: 'Bajo' })
      }

      // 4. Send Telegram: submitted
      sendTelegramNotification('dictation_submitted', {
        score_info: correctorData.ok
          ? `${correctorData.colombian_grade}/5.0 (${correctorData.grade_level})`
          : 'Pending correction',
      })

      // 5. Clean up
      if (idbRef.current) await idbClear(idbRef.current, inst.id)
      localStorage.removeItem('cbf_dictation_entry')

      // Exit fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }

      setPhase('submitted')
    } catch (err) {
      logError(err, { page: 'DictationPlayerPage', action: 'submit' })
      setSubmitting(false)
    }
  }

  // ── Group questions by section ──────────────────────────────────────────────

  const sections = []
  const sectionMap = {}
  questions.forEach((q, i) => {
    const key = q.question_type
    if (!sectionMap[key]) {
      sectionMap[key] = { type: key, title: q.section_title || key, items: [] }
      sections.push(sectionMap[key])
    }
    sectionMap[key].items.push({ ...q, globalIndex: i })
  })

  // ── TIMER FORMAT ────────────────────────────────────────────────────────────

  const formatTime = (s) => {
    if (s == null) return '--:--'
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  // ── DOWNLOAD RESULT ─────────────────────────────────────────────────────────

  function downloadResult() {
    if (!result) return
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Dictation Result</title>
<style>body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;padding:20px}
h1{color:#1F3864;border-bottom:3px solid #4BACC6;padding-bottom:10px}
.score{font-size:2em;font-weight:bold;color:${gradeColor(result.colombian_grade)};margin:20px 0}
.section{margin:20px 0;padding:15px;background:#f8f9fa;border-radius:8px}
table{width:100%;border-collapse:collapse;margin:10px 0}
th,td{padding:8px 12px;border:1px solid #ddd;text-align:left}
th{background:#1F3864;color:white}
.correct{color:#15803D;font-weight:bold}
.incorrect{color:#DC2626}
.partial{color:#D97706}
.footer{margin-top:30px;text-align:center;color:#888;font-size:12px}
</style></head><body>
<h1>🎧 Dictation Result — Colegio Boston Flexible</h1>
<p><strong>Student:</strong> ${instance?.student_name || 'N/A'}</p>
<p><strong>Section:</strong> ${instance?.student_section || 'N/A'}</p>
<p><strong>Title:</strong> ${blueprint?.title || 'Dictation'}</p>
<p><strong>Date:</strong> ${new Date().toLocaleDateString('es-CO')}</p>
<div class="score">${result.colombian_grade}/5.0 — ${result.grade_level}</div>
<p>Score: ${result.total_score}/${result.max_score}</p>
${result.section_scores ? Object.entries(result.section_scores).map(([type, s]) =>
  `<div class="section"><strong>${type}</strong>: ${s.correct}/${s.total} correct (${s.score}/${s.max} points)</div>`
).join('') : ''}
<div class="footer">
  <p>CBF Planner — Dictation Module</p>
  <p>"My grace is all you need, for my power is the greatest when you are weak." — 2 Corinthians 12:9</p>
</div>
</body></html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Dictation_Result_${instance?.student_name || 'student'}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════════

  // ── ENTRY PHASE ──
  if (phase === 'entry') {
    return (
      <div className="dict-player-entry">
        <div className="dict-player-logo">🎧</div>
        <h1>CBF Dictation</h1>
        <p>Ingresa tu código personal para iniciar el dictado.</p>

        <div className="dict-entry-form">
          <input
            value={accessCode}
            onChange={e => setAccessCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleEntry()}
            placeholder="Ej: DICT-A3B2-9B001"
            className="dict-entry-input"
            autoFocus
          />
          <button
            onClick={handleEntry}
            disabled={entryLoading || !accessCode.trim()}
            className="dict-entry-btn"
          >
            {entryLoading ? 'Verificando...' : 'Ingresar →'}
          </button>
        </div>

        {error && <div className="dict-entry-error">{error}</div>}

        <div className="dict-entry-footer">
          <p>Colegio Boston Flexible · CBF Planner</p>
        </div>
      </div>
    )
  }

  // ── INSTRUCTIONS PHASE ──
  if (phase === 'instructions') {
    return (
      <div className="dict-player-instructions">
        <h1>🎧 {blueprint?.title || 'Dictation'}</h1>
        <div className="dict-instr-card">
          <h2>Instrucciones</h2>
          <ul>
            <li><strong>Section 1:</strong> Escucharás palabras. Escríbelas en MAYÚSCULAS.</li>
            <li><strong>Section 2:</strong> Escucharás oraciones. Identifica qué palabra de vocabulario se usó.</li>
            <li><strong>Section 3:</strong> Completa las oraciones eligiendo la palabra correcta.</li>
          </ul>
          <p><strong>Duración:</strong> {session?.duration_minutes || 30} minutos</p>
          <p><strong>Preguntas:</strong> {questions.length}</p>

          <div className="dict-instr-warnings">
            <p>⚠️ No cambies de pestaña ni salgas de la pantalla.</p>
            <p>⚠️ No uses click derecho ni copies texto.</p>
            <p>⚠️ Todas las violaciones quedan registradas.</p>
          </div>
        </div>

        <button onClick={handleStart} className="dict-start-btn">
          ▶ Comenzar Dictation
        </button>
      </div>
    )
  }

  // ── DICTATION PHASE ──
  if (phase === 'dictation') {
    const currentSection = sections[activeSection]

    return (
      <div className="dict-player-exam" onCopy={e => e.preventDefault()} onCut={e => e.preventDefault()}>
        {/* Watermark */}
        <WatermarkCanvas text={`${instance?.student_name || '?'} · ${new Date().toLocaleTimeString('es-CO')}`} />

        {/* Violation banner */}
        {violationAlert && (
          <div className="dict-violation-banner">
            <strong>⚠️ {violationAlert.title}</strong>: {violationAlert.message}
          </div>
        )}

        {/* Top bar */}
        <div className="dict-topbar">
          <span className="dict-topbar-title">🎧 {blueprint?.title || 'Dictation'}</span>
          <span className="dict-topbar-student">{instance?.student_name}</span>
          <span className={`dict-topbar-timer ${timeLeft != null && timeLeft < 60 ? 'urgent' : ''}`}>
            ⏱ {formatTime(timeLeft)}
          </span>
          {violations > 0 && (
            <span className="dict-topbar-violations">⚠️ {violations}</span>
          )}
        </div>

        {/* Section tabs */}
        <div className="dict-section-tabs">
          {sections.map((sec, i) => {
            const answered = sec.items.filter(it => answers[it.globalIndex]).length
            return (
              <button
                key={i}
                className={`dict-sec-tab ${activeSection === i ? 'active' : ''}`}
                onClick={() => setActiveSection(i)}
              >
                {sec.title} ({answered}/{sec.items.length})
              </button>
            )
          })}
        </div>

        {/* Questions */}
        <div className="dict-questions">
          {currentSection && currentSection.items.map((q) => {
            const idx = q.globalIndex

            return (
              <div key={idx} className="dict-question">
                <div className="dict-q-num">{idx + 1})</div>

                {/* Audio for listen_type and listen_identify */}
                {(q.question_type === 'listen_type' || q.question_type === 'listen_identify') && (
                  <div className="dict-q-audio">
                    {blueprint?.audio_urls?.[q.question_type]?.[
                      currentSection.items.indexOf(q)
                    ] ? (
                      <>
                        <audio
                          controls
                          src={blueprint.audio_urls[q.question_type][currentSection.items.indexOf(q)]}
                          className="dict-audio-player"
                        />
                        <button
                          onClick={() => handleReplay(idx, blueprint.audio_urls[q.question_type][currentSection.items.indexOf(q)])}
                          disabled={getReplayCount(idx) >= MAX_REPLAYS}
                          className="dict-replay-btn"
                        >
                          🔄 Replay ({MAX_REPLAYS - getReplayCount(idx)} left)
                        </button>
                      </>
                    ) : (
                      <span className="dict-no-audio">🔇 Audio not available — ask your teacher</span>
                    )}
                  </div>
                )}

                {/* Sentence for fill_blank */}
                {q.sentence && (
                  <p className="dict-q-sentence">{q.sentence}</p>
                )}

                {/* Input: typed word OR multiple choice */}
                {q.question_type === 'listen_type' ? (
                  <input
                    value={answers[idx] || ''}
                    onChange={e => updateAnswer(idx, e.target.value.toUpperCase())}
                    placeholder="TYPE YOUR ANSWER"
                    className="dict-q-input"
                    autoComplete="off"
                    spellCheck={false}
                  />
                ) : (
                  <div className="dict-q-options">
                    {q.options?.map((opt, oi) => (
                      <label key={oi} className={`dict-q-option ${answers[idx] === opt ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name={`q-${idx}`}
                          checked={answers[idx] === opt}
                          onChange={() => updateAnswer(idx, opt)}
                        />
                        <span>{oi + 1}. {opt}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Submit bar */}
        <div className="dict-submit-bar">
          <span className="dict-progress">
            {Object.keys(answers).length}/{questions.length} answered
          </span>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="dict-submit-btn"
          >
            {submitting ? '📡 Submitting...' : '✅ Submit Dictation'}
          </button>
        </div>
      </div>
    )
  }

  // ── SUBMITTED PHASE ──
  if (phase === 'submitted') {
    const grade = result?.colombian_grade
    const level = result?.grade_level
    const color = gradeColor(grade)

    return (
      <div className="dict-player-submitted">
        <div className="dict-result-card">
          <h1>🎧 Dictation Complete</h1>
          <div className="dict-result-grade" style={{ color }}>
            {grade ? `${grade}/5.0` : 'Calculating...'}
          </div>
          <div className="dict-result-level" style={{ color }}>
            {level || '...'}
          </div>
          <p className="dict-result-score">
            Score: {result?.total_score || 0}/{result?.max_score || 0}
          </p>

          {result?.section_scores && (
            <div className="dict-result-sections">
              {Object.entries(result.section_scores).map(([type, s]) => (
                <div key={type} className="dict-result-section">
                  <strong>{type}</strong>
                  <span>{s.correct}/{s.total} correct</span>
                  <span>{s.score}/{s.max} pts</span>
                </div>
              ))}
            </div>
          )}

          {violations > 0 && (
            <p className="dict-result-violations">⚠️ {violations} integrity violation(s) recorded</p>
          )}

          <button onClick={downloadResult} className="dict-download-btn">
            📥 Download Result
          </button>

          <div className="dict-result-verse">
            <em>"My grace is all you need, for my power is the greatest when you are weak."</em>
            <br />— 2 Corinthians 12:9
          </div>
        </div>
      </div>
    )
  }

  return null
}
