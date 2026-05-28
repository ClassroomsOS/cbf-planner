// ── DictationPlayerPage.jsx ───────────────────────────────────────────────────
// /eval/dictation — Player público para dictations.
// Anti-trampa 5 capas (reutiliza patrón ExamPlayerV2) · Audio TTS · Auto-corrección.

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabase'
import { colombianGrade as calcColombianGrade, gradeLevel, gradeColor } from '../utils/examUtils'
import { scoreDictation, SECTION_META } from '../utils/dictationUtils'
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

// ── Cyclic correct-answer placement ──────────────────────────────────────────
// Places the correct answer at position (questionIndex % numOptions) so that
// the correct answer cycles A→B→C→D→A→B→C... across consecutive questions.
// This prevents students from predicting by induction (e.g. "Q1, Q2, Q3 were
// all A so Q4 must also be A"). Scoring is text-based server-side, so reordering
// display options is safe — the server always compares against correct_answer.

function cyclicPlaceCorrect(options, correctAnswer, questionIndex) {
  const targetPos = questionIndex % options.length
  const withoutCorrect = options.filter(o => o !== correctAnswer)
  const reordered = [...withoutCorrect]
  reordered.splice(targetPos, 0, correctAnswer)
  return reordered
}

// ── AudioQuestion — controlled player, enforces replay limit ─────────────────
// Native <audio controls> lets the student bypass the replay limit by clicking
// the browser's built-in play button. This component hides the native controls
// and manages playback exclusively through the custom button.

function AudioQuestion({ audioUrl, qIndex, replays, maxReplays, onReplay }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const used = replays[qIndex] || 0
  const remaining = maxReplays - used
  const exhausted = used >= maxReplays

  if (!audioUrl) {
    return (
      <div className="dict-q-audio">
        <span className="dict-no-audio">🔇 Audio not available — ask your teacher</span>
      </div>
    )
  }

  function handlePlay() {
    if (exhausted) return
    onReplay(qIndex, audioUrl)
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
    audio.currentTime = 0
    audio.play().catch(() => {})
  }

  function handleVolumeChange(e) {
    const v = Number(e.target.value)
    setVolume(v)
    if (audioRef.current) audioRef.current.volume = v
  }

  const volumeIcon = volume === 0 ? '🔇' : volume < 0.4 ? '🔈' : volume < 0.75 ? '🔉' : '🔊'

  return (
    <div className="dict-q-audio">
      {/* Hidden audio element — no controls attribute */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={() => {
          const a = audioRef.current
          if (a && a.duration) setProgress(a.currentTime / a.duration)
        }}
        onLoadedMetadata={() => {
          setDuration(audioRef.current?.duration || 0)
          if (audioRef.current) audioRef.current.volume = volume
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0) }}
      />
      <div className="dict-audio-ctrl">
        <button
          className={`dict-audio-play-btn ${exhausted ? 'exhausted' : ''}`}
          onClick={handlePlay}
          disabled={exhausted}
          title={exhausted ? 'No more replays allowed' : `Play (${remaining} remaining)`}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <div className="dict-audio-progress-track">
          <div className="dict-audio-progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="dict-audio-duration">
          {duration ? `${Math.ceil(duration)}s` : '—'}
        </span>
        <span className={`dict-audio-replays ${exhausted ? 'exhausted' : ''}`}>
          {exhausted ? '🔒 No more replays' : `🔄 ${remaining} replay${remaining !== 1 ? 's' : ''} left`}
        </span>
      </div>
      <div className="dict-audio-volume">
        <span className="dict-audio-vol-icon">{volumeIcon}</span>
        <input
          type="range"
          className="dict-audio-vol-slider"
          min="0" max="1" step="0.05"
          value={volume}
          onChange={handleVolumeChange}
          title={`Volume: ${Math.round(volume * 100)}%`}
        />
        <span className="dict-audio-vol-pct">{Math.round(volume * 100)}%</span>
      </div>
    </div>
  )
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
      const stepX = 520, stepY = 200
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

  // ── Teacher broadcast ──
  const [teacherWarning, setTeacherWarning] = useState(null)
  const teacherWarnTimerRef = useRef(null)
  const ctrlChannelRef = useRef(null)

  // ── IDB ──
  const idbRef = useRef(null)
  const instanceRef = useRef(null)
  const integrityEventsRef = useRef([])

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
      // Reorder MC options so correct answer cycles A→B→C→D across questions.
      // Prevents induction-based cheating ("all previous were A, so next is A").
      let mcIndex = 0
      const shuffled = (inst.generated_questions || []).map((q) => {
        if (!q.options || q.options.length < 2) return q
        return { ...q, options: cyclicPlaceCorrect(q.options, q.correct_answer, mcIndex++) }
      })
      setQuestions(shuffled)

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

  // ── FORCE CLOSE (teacher-triggered) ────────────────────────────────────────

  async function handleForceClose() {
    // Exit fullscreen
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
    // Stop timer
    setTimeLeft(null)
    // Mark in DB
    const inst = instanceRef.current
    if (inst) {
      await supabase
        .from('dictation_instances')
        .update({ instance_status: 'force_closed' })
        .eq('id', inst.id)
    }
    // Clean up local data
    if (idbRef.current && inst) await idbClear(idbRef.current, inst.id)
    setPhase('force_closed')
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

  // ── TEACHER BROADCAST CHANNEL ───────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'dictation' || !session?.id) return

    const channel = supabase
      .channel(`dictation-ctrl-${session.id}`)
      .on('broadcast', { event: 'teacher_warning' }, ({ payload }) => {
        // Accept if addressed to this instance or broadcast to all
        if (!payload.instanceId || payload.instanceId === instanceRef.current?.id) {
          setTeacherWarning(payload)
          // Clear any existing auto-dismiss timer
          if (teacherWarnTimerRef.current) clearTimeout(teacherWarnTimerRef.current)
          teacherWarnTimerRef.current = setTimeout(() => setTeacherWarning(null), 10000)
        }
      })
      .on('broadcast', { event: 'force_close' }, ({ payload }) => {
        if (!payload.instanceId || payload.instanceId === instanceRef.current?.id) {
          handleForceClose()
        }
      })
      .subscribe()

    ctrlChannelRef.current = channel

    return () => {
      if (teacherWarnTimerRef.current) clearTimeout(teacherWarnTimerRef.current)
      supabase.removeChannel(channel)
      ctrlChannelRef.current = null
    }
  }, [phase, session?.id])

  // ── ANTI-CHEAT (Layer 1: Multi-event detection) ────────────────────────────

  useEffect(() => {
    if (phase !== 'dictation') return

    function registerViolation(eventType) {
      const newCount = violationsRef.current + 1
      violationsRef.current = newCount
      setViolations(newCount)

      // Update DB
      const inst = instanceRef.current
      const now = new Date().toISOString()
      integrityEventsRef.current = [...integrityEventsRef.current, { type: eventType, ts: now }]
      if (inst) {
        supabase
          .from('dictation_instances')
          .update({
            tab_switches: newCount,
            integrity_flags: {
              high_risk: newCount >= HIGH_RISK_THRESHOLD,
              last_event: eventType,
              last_event_at: now,
              events: integrityEventsRef.current,
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
      const nowMs = Date.now()
      if (nowMs - lastAlertRef.current > TELEGRAM_THROTTLE_MS) {
        lastAlertRef.current = nowMs
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

      // 1. Insert responses
      const responses = questions.map((q, i) => ({
        instance_id: inst.id,
        question_index: i,
        question_type: q.question_type,
        answer: currentAnswers[i] || '',
        correct_answer: '',
        is_correct: null,
        score: 0,
        max_score: q.max_score || 1,
      }))

      const { error: respErr } = await supabase
        .from('dictation_responses')
        .insert(responses)

      if (respErr) throw respErr

      // 2. Update instance status
      const { error: instErr } = await supabase
        .from('dictation_instances')
        .update({
          instance_status: 'submitted',
          submitted_at: new Date().toISOString(),
          time_spent_seconds: timeSpent,
          tab_switches: violationsRef.current,
        })
        .eq('id', inst.id)

      if (instErr) throw instErr

      // 3. Exit fullscreen + clean up immediately
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
      if (idbRef.current) await idbClear(idbRef.current, inst.id)
      localStorage.removeItem('cbf_dictation_entry')

      // 4. Transition to submitted — result arrives via Realtime subscription below
      setPhase('submitted')

      // 5. Fire corrector in background (non-blocking)
      const edgeFnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dictation-corrector`
      const zeroResult = {
        ok: true,
        colombian_grade: 1.0,
        grade_level: 'Bajo',
        total_score: 0,
        max_score: responses.length,
        section_scores: {},
      }
      fetch(edgeFnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance_id: inst.id }),
      })
        .then(r => r.json())
        .then(data => {
          sendTelegramNotification('dictation_submitted', {
            score_info: data.ok
              ? `${data.colombian_grade}/5.0 (${data.grade_level})`
              : 'Correction pending',
          })
          // Always set result — use server data if ok, otherwise show 1.0 fallback
          setResult(prev => prev || (data.ok ? data : zeroResult))
        })
        .catch(() => {
          // Network error — show 1.0 fallback so page is never blank
          setResult(prev => prev || zeroResult)
        })

    } catch (err) {
      logError(err, { page: 'DictationPlayerPage', action: 'submit' })
      setSubmitting(false)
      setError('Could not submit your exam. Please try again or ask your teacher for help.')
    }
  }

  // ── Realtime: listen for correction result ──────────────────────────────────
  useEffect(() => {
    if (phase !== 'submitted' || !instance?.id) return

    const channel = supabase
      .channel(`dictation-result-${instance.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'dictation_results',
        filter: `instance_id=eq.${instance.id}`,
      }, ({ new: row }) => {
        setResult({
          ok: true,
          colombian_grade: row.colombian_grade,
          grade_level: row.grade_level,
          total_score: row.total_score,
          max_score: row.max_score,
          section_scores: row.section_scores,
        })
      })
      .subscribe()

    // Fallback: if result still not set after 12s, fetch it from DB directly
    const fallbackTimer = setTimeout(async () => {
      setResult(prev => {
        if (prev) return prev  // already got it
        return null  // will trigger the DB fetch below
      })
      const { data: row } = await supabase
        .from('dictation_results')
        .select('*')
        .eq('instance_id', instance.id)
        .maybeSingle()
      if (row) {
        setResult(prev => prev || {
          ok: true,
          colombian_grade: row.colombian_grade,
          grade_level: row.grade_level,
          total_score: row.total_score,
          max_score: row.max_score,
          section_scores: row.section_scores,
        })
      } else {
        // No result in DB either — show 1.0 so the page is never blank
        setResult(prev => prev || {
          ok: true,
          colombian_grade: 1.0,
          grade_level: 'Bajo',
          total_score: 0,
          max_score: questions.length,
          section_scores: {},
        })
      }
    }, 12000)

    return () => {
      supabase.removeChannel(channel)
      clearTimeout(fallbackTimer)
    }
  }, [phase, instance?.id])

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

  // ── Detect which question types are present ──
  const presentTypes = [...new Set(questions.map(q => q.question_type))]
  const hasAudioSections = presentTypes.some(t => t === 'listen_type' || t === 'listen_identify' || t === 'listen_comprehension')

  // ── INSTRUCTIONS PHASE ──
  if (phase === 'instructions') {
    const INSTR_MAP = {
      listen_type:          'Escucharás palabras. Escríbelas en MAYÚSCULAS.',
      listen_identify:      'Escucharás oraciones. Identifica qué palabra de vocabulario se usó.',
      matching:             'Conecta cada palabra con su definición correcta.',
      fill_blank:           'Completa las oraciones eligiendo la palabra correcta.',
      writing:              'Escribe un párrafo corto usando las palabras de vocabulario indicadas.',
      listen_comprehension: 'Escucharás una conversación corta (~30 seg). Elige la respuesta correcta entre 4 opciones.',
    }

    return (
      <div className="dict-player-instructions">
        <h1>{hasAudioSections ? '🎧' : '📝'} {blueprint?.title || 'Assessment'}</h1>
        <div className="dict-instr-card">
          <h2>Instrucciones</h2>
          <ul>
            {presentTypes.map(t => (
              <li key={t}>
                <strong>{SECTION_META[t]?.icon} {SECTION_META[t]?.label}:</strong> {INSTR_MAP[t] || ''}
              </li>
            ))}
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
          ▶ Comenzar {hasAudioSections ? 'Dictation' : 'Assessment'}
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

        {/* Teacher warning overlay (full-screen) */}
        {teacherWarning && (
          <div className="dict-teacher-warning-overlay">
            <div className="dict-teacher-warning-card">
              <div className="dict-teacher-warning-icon">⚠️</div>
              <h2>Message from your teacher</h2>
              <p className="dict-teacher-warning-msg">{teacherWarning.message}</p>
              <button
                onClick={() => {
                  if (teacherWarnTimerRef.current) clearTimeout(teacherWarnTimerRef.current)
                  setTeacherWarning(null)
                }}
                className="dict-teacher-warning-btn"
              >
                Understood
              </button>
              <p className="dict-teacher-warning-auto">This message will close automatically in 10 seconds.</p>
            </div>
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
            const meta = SECTION_META[sec.type] || {}
            return (
              <button
                key={i}
                className={`dict-sec-tab ${activeSection === i ? 'active' : ''}`}
                style={{ '--tab-color': meta.color || '#888' }}
                onClick={() => setActiveSection(i)}
              >
                {meta.icon} {meta.label || sec.title} ({answered}/{sec.items.length})
              </button>
            )
          })}
        </div>

        {/* Questions */}
        <div className="dict-questions">
          {currentSection && currentSection.items.map((q) => {
            const idx = q.globalIndex
            const qType = q.question_type

            return (
              <div key={idx} className="dict-question">
                <div className="dict-q-num">{idx + 1})</div>

                {/* Audio for listen_type, listen_identify, listen_comprehension */}
                {(qType === 'listen_type' || qType === 'listen_identify' || qType === 'listen_comprehension') && (
                  <AudioQuestion
                    audioUrl={blueprint?.audio_urls?.[qType]?.[currentSection.items.indexOf(q)]}
                    qIndex={idx}
                    replays={replays}
                    maxReplays={MAX_REPLAYS}
                    onReplay={handleReplay}
                  />
                )}

                {/* Comprehension question text */}
                {qType === 'listen_comprehension' && q.question && (
                  <p className="dict-q-comprehension-question">{q.question}</p>
                )}

                {/* Word for matching */}
                {qType === 'matching' && q.word && (
                  <div className="dict-q-matching-word">
                    <span className="dict-matching-label">Word:</span>
                    <span className="dict-matching-word">{q.word}</span>
                  </div>
                )}

                {/* Sentence for fill_blank */}
                {q.sentence && (
                  <p className="dict-q-sentence">{q.sentence}</p>
                )}

                {/* Prompt for writing */}
                {qType === 'writing' && q.prompt && (
                  <div className="dict-q-writing-prompt">
                    <p className="dict-writing-prompt-text">{q.prompt}</p>
                    {q.required_words && q.required_words.length > 0 && (
                      <div className="dict-writing-req-words">
                        <span>Required words:</span>
                        {q.required_words.map((w, wi) => (
                          <span key={wi} className={`dict-writing-word-chip ${(answers[idx] || '').toLowerCase().includes(w.toLowerCase()) ? 'used' : ''}`}>
                            {w}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Input based on question type */}
                {qType === 'listen_type' ? (
                  <input
                    value={answers[idx] || ''}
                    onChange={e => updateAnswer(idx, e.target.value.toUpperCase())}
                    placeholder="TYPE YOUR ANSWER"
                    className="dict-q-input"
                    autoComplete="off"
                    spellCheck={false}
                  />
                ) : qType === 'writing' ? (
                  <div className="dict-q-writing-area">
                    <textarea
                      value={answers[idx] || ''}
                      onChange={e => updateAnswer(idx, e.target.value)}
                      placeholder="Write your paragraph here..."
                      className="dict-q-textarea"
                      rows={5}
                    />
                    <div className="dict-q-word-count">
                      {(answers[idx] || '').trim().split(/\s+/).filter(Boolean).length} words
                      {q.required_words && (() => {
                        const text = (answers[idx] || '').toLowerCase()
                        const used = q.required_words.filter(w => text.includes(w.toLowerCase())).length
                        return ` · ${used}/${q.required_words.length} vocabulary words used`
                      })()}
                    </div>
                  </div>
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
                        <span>{String.fromCharCode(65 + oi)}. {opt}</span>
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
          {error && (
            <p className="dict-submit-error">⚠️ {error}</p>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="dict-submit-btn"
          >
            {submitting ? '📡 Sending...' : '✅ Submit Dictation'}
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
    const hasResult = result != null

    return (
      <div className="dict-player-submitted">
        <div className="dict-result-card">
          <h1>🎧 Dictation Complete</h1>
          {!hasResult && (
            <div className="dict-result-loading">
              <div className="dict-result-spinner" />
              <p>Calculando resultado...</p>
            </div>
          )}
          <div className="dict-result-grade" style={{ color }}>
            {grade != null ? `${grade}/5.0` : hasResult ? '1.0/5.0' : ''}
          </div>
          <div className="dict-result-level" style={{ color }}>
            {level || (hasResult ? 'Bajo' : '')}
          </div>
          <p className="dict-result-score">
            Score: {result?.total_score ?? 0}/{result?.max_score ?? 0}
          </p>

          {result?.section_scores && (
            <div className="dict-result-sections">
              {Object.entries(result.section_scores).map(([type, s]) => {
                const meta = SECTION_META[type] || {}
                return (
                  <div key={type} className="dict-result-section" style={{ borderLeftColor: meta.color || '#888' }}>
                    <strong>{meta.icon} {meta.label || type}</strong>
                    <span>{s.correct}/{s.total} correct</span>
                    <span>{s.score}/{s.max} pts</span>
                  </div>
                )
              })}
            </div>
          )}

          {violations > 0 && (
            <p className="dict-result-violations">⚠️ {violations} integrity violation(s) recorded</p>
          )}

          <button onClick={() => window.print()} className="dict-download-btn">
            🖨️ Imprimir / Guardar PDF
          </button>

          <div className="dict-result-verse">
            <em>"My grace is all you need, for my power is the greatest when you are weak."</em>
            <br />— 2 Corinthians 12:9
          </div>
        </div>
      </div>
    )
  }

  // ── FORCE CLOSED PHASE ──
  if (phase === 'force_closed') {
    return (
      <div className="dict-player-force-closed">
        <div className="dict-force-closed-card">
          <div className="dict-force-closed-icon">🔒</div>
          <h1>Exam Closed</h1>
          <p>Your exam has been closed by your teacher.</p>
          <p className="dict-force-closed-sub">Please wait for further instructions from your teacher.</p>
          <div className="dict-force-closed-info">
            <span>{instance?.student_name}</span>
            <span>{blueprint?.title || 'Dictation'}</span>
          </div>
        </div>
      </div>
    )
  }

  return null
}
