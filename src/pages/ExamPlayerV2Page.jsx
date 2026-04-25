// ── ExamPlayerV2Page.jsx ──────────────────────────────────────────────────────
// /eval — Player resiliente usando el nuevo schema (exam_instances).
// Acceso público — el estudiante entra con email @redboston.edu.co + access_code.
// Anti-trampa: 5 capas · Marca de agua canvas · IndexedDB autosave · Timer.

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabase'

// ── IndexedDB helper ──────────────────────────────────────────────────────────

const IDB_NAME    = 'cbf_exam_v2'
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

async function idbSave(db, instanceId, questionId, value) {
  const tx = db.transaction('answers', 'readwrite')
  tx.objectStore('answers').put({ key: `${instanceId}_${questionId}`, value, ts: Date.now() })
}

async function idbLoadAll(db, instanceId) {
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('answers', 'readonly')
    const store = tx.objectStore('answers')
    const req   = store.getAll()
    req.onsuccess = () => {
      const prefix  = `${instanceId}_`
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
  const tx     = db.transaction('answers', 'readwrite')
  const store  = tx.objectStore('answers')
  const req    = store.openCursor()
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
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.globalAlpha = 0.07
      ctx.fillStyle   = '#000'
      ctx.font        = 'bold 22px Arial'
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate(-Math.PI / 6)
      const stepX = 320, stepY = 120
      const cols  = Math.ceil(canvas.width  / stepX) + 2
      const rows  = Math.ceil(canvas.height / stepY) + 2
      for (let r = -rows; r <= rows; r++) {
        for (let c = -cols; c <= cols; c++) {
          ctx.fillText(text, c * stepX, r * stepY)
        }
      }
      ctx.restore()
    }

    draw()
    window.addEventListener('resize', draw)

    // MutationObserver: si alguien borra el canvas desde DevTools, lo reinserta.
    // También detecta intentos de ocultarlo vía style/attribute (opacity:0, display:none, etc.)
    const observer = new MutationObserver(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      if (!document.body.contains(canvas)) {
        document.body.appendChild(canvas)
        draw()
      } else {
        // Restore visibility if tampered via DevTools style panel
        const s = canvas.style
        if (s.opacity === '0' || s.display === 'none' || s.visibility === 'hidden') {
          s.opacity = ''
          s.display = ''
          s.visibility = ''
        }
        if (canvas.getAttribute('hidden') !== null) {
          canvas.removeAttribute('hidden')
        }
      }
    })
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'hidden', 'class'] })

    return () => {
      window.removeEventListener('resize', draw)
      observer.disconnect()
    }
  }, [text])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', top: 0, left: 0,
        width: '100vw', height: '100vh',
        zIndex: 9999, pointerEvents: 'none',
      }}
    />
  )
}

// ── Fases ─────────────────────────────────────────────────────────────────────

const PHASE = {
  ENTRY:        'entry',
  INSTRUCTIONS: 'instructions',
  EXAM:         'exam',
  SUBMITTED:    'submitted',
  ERROR:        'error',
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ExamPlayerV2Page() {
  const [phase,       setPhase]       = useState(PHASE.ENTRY)
  const [session,     setSession]     = useState(null)
  const [instance,    setInstance]    = useState(null)
  const [questions,   setQuestions]   = useState([])
  const [answers,     setAnswers]     = useState({})
  const [current,     setCurrent]     = useState(0)
  const [timeLeft,    setTimeLeft]    = useState(null)
  const [violations,  setViolations]  = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [errorMsg,    setErrorMsg]    = useState('')
  const [loading,     setLoading]     = useState(false)

  const [showFsModal, setShowFsModal] = useState(false)

  const idbRef         = useRef(null)
  const timerRef       = useRef(null)
  const autosaveRef    = useRef(null)
  const instanceRef    = useRef(null)   // para closures de eventos
  const sessionRef     = useRef(null)   // para closures de eventos
  const lastAlertRef   = useRef(0)      // timestamp del último Telegram enviado (throttle 60s)
  // ⚠️ SECURITY: correct answers NEVER go into React state (visible in React DevTools + Network).
  // Stored in a plain ref — not exposed in component state tree.
  const correctAnsRef  = useRef({})     // { [questionId]: correctAnswer }

  // Detectar iOS (no soporta requestFullscreen — usar modo quiosco)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  // Abrir IndexedDB al montar
  useEffect(() => {
    openIDB().then(db => { idbRef.current = db }).catch(console.error)
  }, [])

  // ── EntryPhase ──────────────────────────────────────────────

  function EntryPhase() {
    const saved = (() => {
      try { return JSON.parse(localStorage.getItem('cbf_exam_entry') || '{}') } catch { return {} }
    })()
    const [accessCode, setAccessCode] = useState(saved.code  || '')
    const [email,      setEmail]      = useState(saved.email || '')
    const [err,        setErr]        = useState('')
    const isReturning = !!(saved.code && saved.email)

    async function handleEnter(e) {
      e.preventDefault()
      const code       = accessCode.trim().toUpperCase()
      const emailClean = email.trim().toLowerCase()

      if (!code || !emailClean) {
        setErr('Ingresa el código del examen y tu correo institucional.')
        return
      }
      if (!emailClean.endsWith('@redboston.edu.co')) {
        setErr('Debes usar tu correo @redboston.edu.co.')
        return
      }
      setLoading(true)
      setErr('')
      try {
        // 1. Buscar sesión activa por access_code
        const { data: sess, error: sErr } = await supabase
          .from('exam_sessions')
          .select('id, title, subject, grade, period, duration_minutes, status, school_id, teacher_id')
          .eq('access_code', code)
          .in('status', ['ready', 'active'])
          .single()

        if (sErr || !sess) {
          setErr('Código de examen no válido o el examen no está disponible.')
          setLoading(false)
          return
        }

        // 2. Buscar instancia vía RPC seguro — correct_answer NUNCA sale de la DB
        // get_exam_instance_safe() hace el strip de correct_answer en Postgres
        // antes de que el JSON cruce la red.
        const { data: inst, error: iErr } = await supabase
          .rpc('get_exam_instance_safe', { p_session_id: sess.id, p_email: emailClean })

        if (iErr) {
          setErr('Error al verificar tu acceso. Intenta de nuevo.')
          setLoading(false)
          return
        }
        if (!inst) {
          setErr('Tu correo no está registrado para este examen. Contacta a tu docente.')
          setLoading(false)
          return
        }

        // 3. Cargar respuestas guardadas en IndexedDB (reanudación offline)
        const savedAnswers = idbRef.current
          ? await idbLoadAll(idbRef.current, inst.id).catch(() => ({}))
          : {}

        const rawQs = inst.generated_questions || []

        // ── SECURITY FIX: strip correct_answer before setting React state ──
        // correct_answer must NEVER live in React state — it's visible in React
        // DevTools and can be read by any student with basic browser knowledge.
        // Store in a plain ref instead; used only at submit time for auto-scoring.
        const safeQs    = rawQs.map(({ correct_answer: _ca, ...rest }) => rest)
        const answerMap = {}
        for (const q of rawQs) {
          if (q.correct_answer !== undefined) answerMap[q.id] = q.correct_answer
        }
        correctAnsRef.current = answerMap

        setSession(sess)
        sessionRef.current = sess
        setInstance(inst)
        instanceRef.current = inst
        setQuestions(safeQs)
        setAnswers(savedAnswers)

        // Calcular tiempo restante real desde started_at para resistir reconexiones.
        // Sin esto, apagar el iPad y volver reiniciaba el timer al máximo.
        let remaining = sess.duration_minutes > 0 ? sess.duration_minutes * 60 : null
        if (remaining !== null && inst.started_at) {
          const elapsed = Math.floor((Date.now() - new Date(inst.started_at).getTime()) / 1000)
          remaining = Math.max(0, remaining - elapsed)
        }
        setTimeLeft(remaining)

        // Guardar credenciales en localStorage para reanudación si iOS mata la tab
        try { localStorage.setItem('cbf_exam_entry', JSON.stringify({ code, email: emailClean })) } catch {}

        setPhase(PHASE.INSTRUCTIONS)

        // 4. Marcar como iniciado si es la primera vez
        if (inst.instance_status === 'ready') {
          await supabase
            .from('exam_instances')
            .update({ instance_status: 'started', started_at: new Date().toISOString() })
            .eq('id', inst.id)
        }
      } catch (ex) {
        setErr('Error al conectar. Intenta de nuevo.')
        console.error(ex)
      }
      setLoading(false)
    }

    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ ...styles.cardHeader, background: isReturning ? '#7C3AED' : undefined }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
            <h1 style={{ margin: 0, fontSize: 22, color: isReturning ? '#fff' : '#1F3864' }}>
              {isReturning ? '🔄 Continuar examen' : 'Examen CBF'}
            </h1>
            <p style={{ margin: '4px 0 0', color: isReturning ? '#C4B5FD' : '#666', fontSize: 14 }}>
              {isReturning
                ? 'Parece que saliste del examen. Toca "Continuar" para retomar donde quedaste.'
                : 'Ingresa tu correo institucional y el código del examen'}
            </p>
          </div>
          <form onSubmit={handleEnter} style={{ padding: '24px' }}>
            <label style={styles.label}>Correo institucional</label>
            <input
              style={styles.input}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tunombre@redboston.edu.co"
              autoFocus
              autoComplete="email"
            />
            <label style={styles.label}>Código del examen</label>
            <input
              style={styles.input}
              value={accessCode}
              onChange={e => setAccessCode(e.target.value.toUpperCase())}
              placeholder="Ej: EX-2026-A1"
              autoComplete="off"
            />
            {err && <p style={styles.error}>{err}</p>}
            <button type="submit" style={{ ...styles.btn, background: isReturning ? '#7C3AED' : undefined }} disabled={loading}>
              {loading ? 'Verificando...' : isReturning ? 'Continuar examen →' : 'Ingresar al examen →'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── InstructionsPhase ───────────────────────────────────────

  function InstructionsPhase() {
    const mins     = session?.duration_minutes
    const isResume = instance?.instance_status === 'started'
    // timeLeft ya tiene el tiempo restante real (calculado desde started_at en handleEnter)
    const minsLeft = timeLeft !== null ? Math.ceil(timeLeft / 60) : null
    return (
      <div style={styles.page}>
        <div style={{ ...styles.card, maxWidth: 560 }}>
          <div style={{ ...styles.cardHeader, background: isResume ? '#7C3AED' : '#1F3864' }}>
            <h2 style={{ margin: 0, color: '#fff', fontSize: 20 }}>{session?.title}</h2>
            <p style={{ margin: '4px 0 0', color: '#C4B5FD', fontSize: 13 }}>
              {isResume ? '🔄 Continuando examen guardado' : `${session?.subject} · ${session?.grade} · Período ${session?.period}`}
            </p>
          </div>
          <div style={{ padding: 24 }}>
            <div style={styles.infoBadge}>
              👤 {instance?.student_name} &nbsp;·&nbsp;
              Versión <strong>{instance?.version_label}</strong> &nbsp;·&nbsp;
              {questions.length} preguntas
              {minsLeft !== null && (
                <> &nbsp;·&nbsp; ⏱ <strong style={{ color: minsLeft <= 5 ? '#DC2626' : 'inherit' }}>{minsLeft} min restantes</strong></>
              )}
            </div>

            {isResume && (
              <div style={{
                background: '#F5F3FF', border: '1px solid #C4B5FD', borderRadius: 10,
                padding: '12px 14px', marginTop: 14, fontSize: 13, color: '#5B21B6',
              }}>
                ✓ Tus respuestas guardadas fueron recuperadas. Continúa donde te quedaste.
              </div>
            )}

            <h3 style={{ color: '#1F3864', marginTop: 20 }}>
              {isResume ? 'Recuerda:' : 'Antes de comenzar:'}
            </h3>
            <ul style={{ lineHeight: 2, color: '#374151' }}>
              <li>Este examen está en <strong>modo protegido</strong>.</li>
              <li>Si cambias de pestaña o sales de pantalla completa, quedará registrado.</li>
              <li>Tu nombre aparece como marca de agua en la pantalla.</li>
              <li>Tus respuestas se guardan automáticamente cada 30 segundos.</li>
              {minsLeft !== null && <li>Te quedan <strong>{minsLeft} minutos</strong>. El examen se enviará automáticamente.</li>}
              <li>Al terminar, presiona <strong>"Enviar examen"</strong>.</li>
            </ul>

            <button
              style={{ ...styles.btn, marginTop: 8 }}
              onClick={() => {
                setPhase(PHASE.EXAM)
                if (!isIOS) {
                  document.documentElement.requestFullscreen?.().catch(() => {
                    // Student declined fullscreen — register violation and show re-entry modal
                    registerViolation('fullscreen_declined')
                    setShowFsModal(true)
                  })
                }
              }}
            >
              Entendido — Comenzar examen
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── ExamPhase ───────────────────────────────────────────────

  function ExamPhase() {
    // Anti-trampa — Capa 1: detección multi-evento
    useEffect(() => {
      // a) Tab switch / app switch
      function onVisibilityChange() {
        if (document.hidden) registerViolation('tab_switch')
      }
      // b) Ventana pierde foco — solo si el documento NO está oculto.
      // visibilitychange ya cubre tab-switch; este cubre DevTools en ventana separada
      // o cualquier app que robe foco sin ocultar la pestaña.
      function onBlur() {
        if (!document.hidden) registerViolation('window_blur')
      }
      // c) Salida / entrada de fullscreen → modal de re-ingreso en desktop
      function onFullscreenChange() {
        const inFs = !!(document.fullscreenElement || document.webkitFullscreenElement)
        if (inFs) {
          setShowFsModal(false)
        } else {
          registerViolation('fullscreen_exit')
          if (!isIOS) setShowFsModal(true)
        }
      }
      // d) DevTools anclado — detectado por resize (DevTools reduce dimensiones de la ventana)
      // Threshold 160px cubre la mayoría de panels sin falsos positivos por zoom/DPI.
      // DevTools undocked en ventana separada: cubierto por onBlur (sin document.hidden).
      function onResize() {
        if (window.outerWidth  - window.innerWidth  > 160 ||
            window.outerHeight - window.innerHeight > 160) {
          registerViolation('devtools_open')
        }
      }

      // d2) DevTools via RegExp toString getter — detecta DevTools abierto (docked o undocked).
      // Cuando la consola de DevTools está activa, formatea automáticamente cualquier objeto
      // enviado a console.log() llamando a su toString(). Usamos una RegExp cuyo toString
      // tiene un getter instrumentado. Si es llamado → DevTools está mirando.
      // console.clear() evita que el log sea visible por el estudiante.
      let devtoolsCheckInterval = null
      if (!isIOS) {
        devtoolsCheckInterval = setInterval(() => {
          let triggered = false
          const probe = /./
          probe.toString = () => { triggered = true; return '' }
          // eslint-disable-next-line no-console
          console.log(probe)
          // eslint-disable-next-line no-console
          console.clear()
          if (triggered) registerViolation('devtools_open')
        }, 3000)
      }
      // e) Teclas sospechosas — bloquear + registrar
      function onKeyDown(e) {
        const blocked = (
          e.key === 'F12' || e.key === 'F5' ||
          (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key.toUpperCase())) ||
          (e.ctrlKey && ['u','U','w','W','t','T','n','N'].includes(e.key)) ||
          (e.metaKey && ['w','t','n'].includes(e.key.toLowerCase())) ||
          (e.metaKey && (e.key === 'Tab' || e.key === ' ')) ||
          (e.altKey  && e.key === 'F4')
        )
        if (blocked) {
          e.preventDefault()
          e.stopPropagation()
          registerViolation('blocked_key')
        }
      }
      // f) Cerrar / recargar página
      function onBeforeUnload(e) {
        e.preventDefault()
        e.returnValue = '¿Seguro que quieres salir? Perderás el progreso no guardado.'
        registerViolation('beforeunload')
      }
      // g) Click derecho
      function onContextMenu(e) { e.preventDefault(); registerViolation('context_menu') }
      // h) Copiar / cortar — pegar se permite (escribir respuestas)
      function onCopy(e)  { e.preventDefault(); registerViolation('copy_attempt') }
      function onCut(e)   { e.preventDefault(); registerViolation('copy_attempt') }
      // i) Ocultar página en iOS (Home button / app switcher)
      function onPageHide() { registerViolation('pagehide') }

      // iOS — bloquear scroll y pinch-to-zoom
      function onTouchMove(e) { if (e.touches.length > 1) e.preventDefault() }

      document.addEventListener('visibilitychange', onVisibilityChange)
      window.addEventListener('blur', onBlur)
      document.addEventListener('fullscreenchange', onFullscreenChange)
      document.addEventListener('webkitfullscreenchange', onFullscreenChange)
      window.addEventListener('resize', onResize)
      document.addEventListener('keydown', onKeyDown, true)
      window.addEventListener('beforeunload', onBeforeUnload)
      document.addEventListener('contextmenu', onContextMenu)
      document.addEventListener('copy', onCopy)
      document.addEventListener('cut', onCut)
      window.addEventListener('pagehide', onPageHide)
      if (isIOS) {
        document.addEventListener('touchmove', onTouchMove, { passive: false })
        document.body.style.overflow = 'hidden'
        document.body.style.position = 'fixed'
        document.body.style.width    = '100%'
      }

      return () => {
        document.removeEventListener('visibilitychange', onVisibilityChange)
        window.removeEventListener('blur', onBlur)
        document.removeEventListener('fullscreenchange', onFullscreenChange)
        document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
        window.removeEventListener('resize', onResize)
        document.removeEventListener('keydown', onKeyDown, true)
        window.removeEventListener('beforeunload', onBeforeUnload)
        document.removeEventListener('contextmenu', onContextMenu)
        document.removeEventListener('copy', onCopy)
        document.removeEventListener('cut', onCut)
        window.removeEventListener('pagehide', onPageHide)
        if (devtoolsCheckInterval) clearInterval(devtoolsCheckInterval)
        if (isIOS) {
          document.removeEventListener('touchmove', onTouchMove)
          document.body.style.overflow = ''
          document.body.style.position = ''
          document.body.style.width    = ''
        }
      }
    }, [])

    // Timer
    useEffect(() => {
      if (timeLeft === null) return
      if (timeLeft <= 0) { handleSubmit(); return }
      timerRef.current = setInterval(() => setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); handleSubmit(); return 0 }
        return t - 1
      }), 1000)
      return () => clearInterval(timerRef.current)
    }, [])

    // IndexedDB autosave cada 30s
    useEffect(() => {
      autosaveRef.current = setInterval(() => {
        if (!idbRef.current || !instance) return
        Object.entries(answers).forEach(([qId, val]) => {
          idbSave(idbRef.current, instance.id, qId, val).catch(() => {})
        })
      }, 30000)
      return () => clearInterval(autosaveRef.current)
    }, [answers])

    const q   = questions[current]
    const now = new Date()
    const watermarkText = `${instance?.student_name} · V${instance?.version_label} · ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`

    return (
      <div style={{ minHeight: '100vh', background: '#F0F4F8', position: 'relative' }}>
        {/* Capa 2: Marca de agua canvas */}
        <WatermarkCanvas text={watermarkText} />

        {/* Capa 3 — iOS: banner quiosco fijo */}
        {isIOS && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9998,
            background: '#991B1B', color: '#fff',
            padding: '7px 16px', fontSize: 12, fontWeight: 700,
            textAlign: 'center', letterSpacing: 0.3,
          }}>
            🔒 MODO EXAMEN — No cambies de app ni presiones el botón Home
          </div>
        )}

        {/* Capa 3 — Desktop: modal si sale de fullscreen */}
        {showFsModal && !isIOS && (
          <div style={styles.overlay}>
            <div style={{ background: '#fff', borderRadius: 14, padding: 32, maxWidth: 380, textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,.25)' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>⚠️</div>
              <h3 style={{ margin: '0 0 10px', color: '#DC2626' }}>Saliste de pantalla completa</h3>
              <p style={{ color: '#374151', margin: '0 0 6px', fontSize: 14 }}>El examen requiere pantalla completa. Este evento fue registrado y notificado a tu docente.</p>
              <button
                type="button"
                onClick={() => {
                  document.documentElement.requestFullscreen?.().catch(() => {})
                  setShowFsModal(false)
                }}
                style={{ ...styles.btn, marginTop: 20, background: '#1F3864' }}
              >
                🔲 Volver a pantalla completa
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ ...styles.examHeader, marginTop: isIOS ? 30 : 0 }}>
          <div>
            <strong>{session?.title}</strong>
            <span style={{ marginLeft: 12, fontSize: 13, color: '#93C5FD' }}>
              {instance?.student_name} · V{instance?.version_label}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            {violations > 0 && (
              <span style={{
                background: violations >= 3 ? '#7F1D1D' : '#DC2626',
                color: '#fff', padding: '3px 12px', borderRadius: 12, fontSize: 12,
                fontWeight: 700,
                boxShadow: violations >= 3 ? '0 0 0 2px #FCA5A5' : 'none',
                animation: violations >= 3 ? 'pulse 1.5s infinite' : 'none',
              }}>
                {violations >= 3 ? '🚨' : '⚠️'} {violations} alerta{violations !== 1 ? 's' : ''}
                {violations >= 3 && ' — RIESGO ALTO'}
              </span>
            )}
            {timeLeft !== null && (
              <span style={{
                fontFamily: 'monospace', fontSize: 16, fontWeight: 'bold',
                color: timeLeft < 300 ? '#EF4444' : '#fff',
              }}>
                ⏱ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
              </span>
            )}
          </div>
        </div>

        {/* Progreso */}
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${((current + 1) / questions.length) * 100}%` }} />
        </div>

        {/* Pregunta */}
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 120px' }}>
          <div style={styles.questionCard}>
            <div style={styles.questionMeta}>
              Pregunta {current + 1} de {questions.length}
              <span style={{ marginLeft: 12, color: '#6B7280', fontSize: 13 }}>
                {q?.points} pt{q?.points !== 1 ? 's' : ''} · {q?.section_name}
              </span>
              {q?.biblical && <span style={{ marginLeft: 8, color: '#1A6B3A', fontSize: 13 }}>✝</span>}
            </div>
            <p style={styles.stem}>{q?.stem}</p>
            <QuestionInput q={q} answers={answers} setAnswers={setAnswers} instance={instance} />
          </div>

          {/* Navegación */}
          <div style={styles.nav}>
            <button
              style={{ ...styles.navBtn, opacity: current === 0 ? 0.4 : 1 }}
              disabled={current === 0}
              onClick={() => setCurrent(c => c - 1)}
            >
              ← Anterior
            </button>
            <span style={{ color: '#6B7280', fontSize: 13 }}>
              {Object.keys(answers).length} / {questions.length} respondidas
            </span>
            {current < questions.length - 1
              ? <button style={styles.navBtn} onClick={() => setCurrent(c => c + 1)}>Siguiente →</button>
              : <button style={{ ...styles.navBtn, background: '#1A6B3A' }} onClick={() => setShowConfirm(true)}>
                  Enviar examen ✓
                </button>
            }
          </div>
        </div>

        {/* Confirm modal */}
        {showConfirm && <ConfirmSubmitModal onConfirm={handleSubmit} onCancel={() => setShowConfirm(false)} total={questions.length} answered={Object.keys(answers).length} />}
      </div>
    )
  }

  // ── Registro de violaciones ─────────────────────────────────

  const registerViolation = useCallback((eventType) => {
    setViolations(n => {
      const next = n + 1
      const inst = instanceRef.current
      const sess = sessionRef.current
      if (!inst) return next

      // Telegram throttle: máximo 1 alerta cada 60s
      const now = Date.now()
      if (now - lastAlertRef.current > 60000) {
        lastAlertRef.current = now
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/exam-integrity-alert`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            instance_id:  inst.id,
            session_id:   inst.session_id,
            student_name: inst.student_name,
            exam_title:   sess?.title || '',
            event_type:   eventType,
            count:        next,
          }),
        }).catch(() => {})
        // La Edge Function actualiza DB — no duplicar aquí
      } else {
        // Throttled: solo actualizar DB localmente
        supabase.from('exam_instances').update({
          tab_switches: next,
          integrity_flags: {
            high_risk: next >= 3,
            last_event: eventType,
            violation_count: next,
          },
        }).eq('id', inst.id).then(() => {})
      }

      return next
    })
  }, [])

  // ── Submit ──────────────────────────────────────────────────

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    clearInterval(timerRef.current)
    clearInterval(autosaveRef.current)
    window.removeEventListener('beforeunload', () => {})

    try {
      const inst = instance || instanceRef.current

      // Guardar cada respuesta en exam_responses
      for (const q of questions) {
        const answer = answers[q.id]
        const isAuto = q.question_type === 'multiple_choice'
        // Use correctAnsRef — never q.correct_answer (stripped from state for security)
        const autoScore = isAuto && answer
          ? (answer === correctAnsRef.current[q.id] ? (q.points || 0) : 0)
          : null

        await supabase.from('exam_responses').insert({
          instance_id:   inst.id,
          session_id:    inst.session_id,
          school_id:     inst.school_id,
          question_id:   String(q.id),
          question_type: q.question_type,
          points_possible: q.points || 0,
          response_type:   q.response_type || 'written',
          response_origin: 'digital_realtime',
          answer:          { text: answer || '' },
          auto_score:      autoScore,
          ai_correction_status: isAuto ? 'not_needed' : 'pending',
        })
      }

      // Marcar instancia como enviada
      await supabase.from('exam_instances').update({
        instance_status:   'submitted',
        submitted_at:      new Date().toISOString(),
        tab_switches:      violations,
        time_spent_seconds: session?.duration_minutes
          ? session.duration_minutes * 60 - (timeLeft ?? 0)
          : 0,
      }).eq('id', inst.id)

      // Limpiar IndexedDB + credenciales guardadas (examen terminado)
      if (idbRef.current) await idbClear(idbRef.current, inst.id).catch(() => {})
      try { localStorage.removeItem('cbf_exam_entry') } catch {}

      // Salir de fullscreen
      document.exitFullscreen?.().catch(() => {})

      setPhase(PHASE.SUBMITTED)
    } catch (ex) {
      console.error(ex)
      setSubmitting(false)
    }
  }

  // ── SubmittedPhase ──────────────────────────────────────────

  function SubmittedPhase() {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.card, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <h2 style={{ color: '#1A6B3A', margin: '0 0 8px' }}>¡Examen enviado!</h2>
          <p style={{ color: '#374151', margin: '0 0 4px' }}>
            <strong>{instance?.student_name}</strong>
          </p>
          <p style={{ color: '#6B7280', fontSize: 14 }}>
            {session?.title} · Versión {instance?.version_label}
          </p>
          <p style={{ color: '#6B7280', fontSize: 13, marginTop: 16 }}>
            Tu docente recibirá los resultados. Puedes cerrar esta ventana.
          </p>
          <p style={{ marginTop: 24, fontSize: 22, color: '#1F3864' }}>
            "AÑO DE LA PUREZA" · Génesis 1:27-28a
          </p>
        </div>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────

  if (phase === PHASE.ENTRY)        return <EntryPhase />
  if (phase === PHASE.INSTRUCTIONS) return <InstructionsPhase />
  if (phase === PHASE.EXAM)         return <ExamPhase />
  if (phase === PHASE.SUBMITTED)    return <SubmittedPhase />
  return null
}

// ── QuestionInput ─────────────────────────────────────────────

function QuestionInput({ q, answers, setAnswers, instance }) {
  if (!q) return null
  const val = answers[q.id] || ''

  function set(v) {
    setAnswers(prev => ({ ...prev, [q.id]: v }))
  }

  if (q.question_type === 'multiple_choice' && Array.isArray(q.options)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
        {q.options.map((opt, i) => {
          const letter = String.fromCharCode(65 + i)
          const selected = val === letter
          return (
            <label key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              background: selected ? '#EFF6FF' : '#fff',
              border: `2px solid ${selected ? '#2563EB' : '#E5E7EB'}`,
              borderRadius: 8, padding: '12px 16px', cursor: 'pointer',
            }}>
              <input type="radio" name={`q_${q.id}`} checked={selected}
                onChange={() => set(letter)} style={{ marginTop: 2 }} />
              <span>{opt}</span>
            </label>
          )
        })}
      </div>
    )
  }

  if (q.question_type === 'true_false') {
    return (
      <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
        {['Verdadero', 'Falso'].map(opt => (
          <label key={opt} style={{
            flex: 1, textAlign: 'center', padding: '14px',
            border: `2px solid ${val === opt ? '#2563EB' : '#E5E7EB'}`,
            borderRadius: 8, cursor: 'pointer',
            background: val === opt ? '#EFF6FF' : '#fff',
            fontWeight: val === opt ? 'bold' : 'normal',
          }}>
            <input type="radio" name={`q_${q.id}`} style={{ display: 'none' }}
              checked={val === opt} onChange={() => set(opt)} />
            {opt}
          </label>
        ))}
      </div>
    )
  }

  if (q.question_type === 'fill_blank') {
    return (
      <input
        style={{ ...styles.input, marginTop: 12 }}
        value={val}
        onChange={e => set(e.target.value)}
        placeholder="Escribe tu respuesta..."
      />
    )
  }

  // short_answer, matching, otros
  return (
    <textarea
      style={{ ...styles.input, marginTop: 12, minHeight: 100, resize: 'vertical' }}
      value={val}
      onChange={e => set(e.target.value)}
      placeholder="Escribe tu respuesta..."
    />
  )
}

// ── ConfirmSubmitModal ────────────────────────────────────────

function ConfirmSubmitModal({ onConfirm, onCancel, total, answered }) {
  const missing = total - answered
  return (
    <div style={styles.overlay}>
      <div style={{ ...styles.card, maxWidth: 400, margin: 0 }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📤</div>
          <h3 style={{ margin: '0 0 8px', color: '#1F3864' }}>¿Enviar examen?</h3>
          {missing > 0
            ? <p style={{ color: '#DC2626' }}>Tienes <strong>{missing}</strong> pregunta{missing !== 1 ? 's' : ''} sin responder.</p>
            : <p style={{ color: '#1A6B3A' }}>Respondiste todas las preguntas.</p>
          }
          <p style={{ color: '#6B7280', fontSize: 13 }}>Esta acción no se puede deshacer.</p>
          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <button style={{ ...styles.navBtn, flex: 1, background: '#6B7280' }} onClick={onCancel}>
              Volver
            </button>
            <button style={{ ...styles.navBtn, flex: 1, background: '#1A6B3A' }} onClick={onConfirm}>
              Enviar ✓
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Estilos ───────────────────────────────────────────────────

const styles = {
  page: {
    minHeight: '100vh', background: '#F0F4F8',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16,
  },
  card: {
    background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
    width: '100%', maxWidth: 480, overflow: 'hidden',
  },
  cardHeader: {
    background: '#1F3864', padding: '24px 24px 20px',
    textAlign: 'center', color: '#fff',
  },
  label: {
    display: 'block', fontWeight: 600, color: '#374151',
    marginBottom: 6, marginTop: 16, fontSize: 14,
  },
  input: {
    display: 'block', width: '100%', padding: '10px 12px',
    border: '1.5px solid #D1D5DB', borderRadius: 8, fontSize: 15,
    outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  btn: {
    display: 'block', width: '100%', marginTop: 20,
    background: '#1F3864', color: '#fff', border: 'none',
    borderRadius: 8, padding: '13px', fontSize: 15,
    fontWeight: 600, cursor: 'pointer',
  },
  error: { color: '#DC2626', fontSize: 13, marginTop: 8 },
  infoBadge: {
    background: '#EFF6FF', border: '1px solid #BFDBFE',
    borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#1E3A8A',
  },
  examHeader: {
    background: '#1F3864', color: '#fff', padding: '12px 20px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    position: 'sticky', top: 0, zIndex: 100,
  },
  progressBar: {
    height: 4, background: '#E5E7EB', width: '100%',
  },
  progressFill: {
    height: '100%', background: '#2563EB', transition: 'width 0.3s',
  },
  questionCard: {
    background: '#fff', borderRadius: 12, padding: '24px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
  },
  questionMeta: {
    fontSize: 13, color: '#6B7280', marginBottom: 12, fontWeight: 500,
  },
  stem: {
    fontSize: 17, color: '#111827', lineHeight: 1.6, margin: '0 0 8px',
  },
  nav: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 20,
  },
  navBtn: {
    background: '#1F3864', color: '#fff', border: 'none',
    borderRadius: 8, padding: '10px 20px', fontSize: 14,
    fontWeight: 600, cursor: 'pointer',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 10000, padding: 16,
  },
}
