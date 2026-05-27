import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { generateDictation } from '../utils/AIAssistant'
import {
  DIFFICULTY_CONFIG, VOICE_OPTIONS, QUESTION_POINTS,
  randomPrefix, generateDictationCode, colombianGrade, gradeLevel, gradeColor,
} from '../utils/dictationUtils'
import { logError, logActivity } from '../utils/logger'

// ── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'create',  label: '✏️ Crear',       icon: '✏️' },
  { key: 'list',    label: '📋 Mis Dictados', icon: '📋' },
  { key: 'monitor', label: '📡 Monitor',      icon: '📡' },
  { key: 'config',  label: '⚙️ Config',       icon: '⚙️' },
]

export default function DictationPage({ teacher }) {
  const [activeTab, setActiveTab] = useState('create')
  const { showToast } = useToast()

  return (
    <div className="dict-page">
      <header className="dict-header">
        <h1>🎧 Dictation Center</h1>
        <p className="dict-subtitle">Crea, monitorea y califica dictados automáticamente</p>
      </header>

      <nav className="dict-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`dict-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="dict-content">
        {activeTab === 'create'  && <CreateTab teacher={teacher} showToast={showToast} />}
        {activeTab === 'list'    && <ListTab teacher={teacher} showToast={showToast} />}
        {activeTab === 'monitor' && <MonitorTab teacher={teacher} />}
        {activeTab === 'config'  && <ConfigTab teacher={teacher} showToast={showToast} />}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: CREAR — Wizard 3 pasos
// ══════════════════════════════════════════════════════════════════════════════

function CreateTab({ teacher, showToast }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatingAudio, setGeneratingAudio] = useState(false)

  // Step 1 — Config
  const [assignments, setAssignments] = useState([])
  const [selectedGrade, setSelectedGrade] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [unitReference, setUnitReference] = useState('')
  const [difficulty, setDifficulty] = useState('Intermedio')
  const [vocabInput, setVocabInput] = useState('')
  const [vocabulary, setVocabulary] = useState([])
  const [voiceId, setVoiceId] = useState('en-US-JennyNeural')
  const [speed, setSpeed] = useState(0.9)

  // Step 2 — Generated
  const [generated, setGenerated] = useState(null)
  const [audioUrls, setAudioUrls] = useState({})

  // Step 3 — Publish
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState(30)

  // Load teacher assignments
  useEffect(() => {
    if (!teacher) return
    supabase
      .from('teacher_assignments')
      .select('grade, section, subject')
      .eq('teacher_id', teacher.id)
      .then(({ data }) => setAssignments(data || []))
  }, [teacher])

  // Derive unique grade+section and subjects
  const gradeOptions = [...new Set(assignments.map(a => `${a.grade} ${a.section}`))]
  const subjectOptions = [...new Set(assignments.map(a => a.subject))]

  // ── Add vocabulary word ──
  function addWord() {
    const w = vocabInput.trim()
    if (!w) return
    if (vocabulary.includes(w)) {
      showToast('Esa palabra ya está en la lista', 'warning')
      return
    }
    setVocabulary(prev => [...prev, w])
    setVocabInput('')
  }

  function pasteWords() {
    const words = vocabInput
      .split(/[,\n;]+/)
      .map(w => w.trim())
      .filter(w => w && !vocabulary.includes(w))
    if (words.length === 0) {
      showToast('No se encontraron palabras nuevas', 'warning')
      return
    }
    setVocabulary(prev => [...prev, ...words])
    setVocabInput('')
    showToast(`${words.length} palabras agregadas`, 'success')
  }

  function removeWord(w) {
    setVocabulary(prev => prev.filter(x => x !== w))
  }

  // ── Preview voice ──
  async function previewVoice() {
    if (!('speechSynthesis' in window)) {
      showToast('Tu navegador no soporta preview de voz', 'warning')
      return
    }
    const voice = VOICE_OPTIONS.find(v => v.id === voiceId)
    const utt = new SpeechSynthesisUtterance(vocabulary[0] || 'Hello, this is a test.')
    utt.lang = voice?.lang === 'es' ? 'es-CO' : 'en-US'
    utt.rate = speed
    window.speechSynthesis.speak(utt)
  }

  // ── Step 1 → Step 2: Generate ──
  async function handleGenerate() {
    if (vocabulary.length < 3) {
      showToast('Agrega al menos 3 palabras de vocabulario', 'warning')
      return
    }
    if (!selectedGrade) {
      showToast('Selecciona un grado', 'warning')
      return
    }

    setGenerating(true)
    try {
      const result = await generateDictation({
        vocabulary,
        unitReference,
        grade: selectedGrade,
        subject: selectedSubject || 'English',
        difficulty,
      })
      setGenerated(result)
      setTitle(result.title || `Dictation: ${unitReference || selectedSubject}`)
      setStep(2)
      showToast('Dictation generado por IA', 'success')
    } catch (err) {
      logError(err, { page: 'DictationPage', action: 'generateDictation' })
      showToast(err.message || 'Error al generar el dictation', 'error')
    } finally {
      setGenerating(false)
    }
  }

  // ── Generate audio via TTS Edge Function ──
  async function handleGenerateAudio() {
    if (!generated) return
    setGeneratingAudio(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const edgeFnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dictation-tts`

      // Collect all audio_text items from sections 1 & 2
      const textsSection1 = generated.sections[0].items.map(it => it.audio_text)
      const textsSection2 = generated.sections[1].items.map(it => it.audio_text)

      // Generate section 1 audio
      const res1 = await fetch(edgeFnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          texts: textsSection1,
          voice_id: voiceId,
          speed,
          blueprint_id: 'preview',
          school_id: teacher.school_id,
          section: 'listen_type',
        }),
      })
      const data1 = await res1.json()

      // Generate section 2 audio
      const res2 = await fetch(edgeFnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          texts: textsSection2,
          voice_id: voiceId,
          speed,
          blueprint_id: 'preview',
          school_id: teacher.school_id,
          section: 'listen_identify',
        }),
      })
      const data2 = await res2.json()

      if (data1.error || data2.error) {
        throw new Error(data1.error || data2.error)
      }

      setAudioUrls({
        listen_type: data1.audio_urls || [],
        listen_identify: data2.audio_urls || [],
      })
      showToast('Audio generado correctamente', 'success')
    } catch (err) {
      logError(err, { page: 'DictationPage', action: 'generateAudio' })
      showToast(err.message || 'Error al generar audio', 'error')
    } finally {
      setGeneratingAudio(false)
    }
  }

  // ── Step 3: Publish ──
  async function handlePublish() {
    if (!generated || !title.trim()) {
      showToast('Completa el título', 'warning')
      return
    }

    setLoading(true)
    try {
      const gradeParts = selectedGrade.split(' ')
      const baseGrade = gradeParts[0]
      const section = gradeParts.slice(1).join(' ')

      // 1. Insert blueprint
      const { data: blueprint, error: bpErr } = await supabase
        .from('dictation_blueprints')
        .insert({
          school_id: teacher.school_id,
          teacher_id: teacher.id,
          title,
          subject: selectedSubject || 'English',
          grade: selectedGrade,
          section,
          unit_reference: unitReference,
          difficulty,
          vocabulary,
          voice_config: { voice_id: voiceId, speed },
          sections: generated.sections,
          audio_urls: audioUrls,
          status: 'ready',
        })
        .select('id')
        .single()

      if (bpErr) throw bpErr

      // 2. Generate access code prefix
      const prefix = randomPrefix()

      // 3. Insert session
      const { data: session, error: sesErr } = await supabase
        .from('dictation_sessions')
        .insert({
          blueprint_id: blueprint.id,
          teacher_id: teacher.id,
          school_id: teacher.school_id,
          title,
          access_code: `DICT-${prefix}`,
          duration_minutes: duration,
          status: 'ready',
        })
        .select('id, access_code')
        .single()

      if (sesErr) throw sesErr

      // 4. Load students from roster
      const { data: students } = await supabase
        .from('school_students')
        .select('id, name, first_name, first_lastname, email, student_code, section')
        .eq('school_id', teacher.school_id)
        .eq('grade', baseGrade)
        .eq('section', section)
        .order('name')

      // 5. Generate instances per student
      if (students && students.length > 0) {
        const instances = students.map(st => ({
          session_id: session.id,
          student_id: st.id,
          student_email: st.email,
          student_name: st.name || `${st.first_name || ''} ${st.first_lastname || ''}`.trim(),
          student_section: st.section || section,
          student_code: st.student_code,
          access_code: generateDictationCode(prefix, st.student_code),
          generated_questions: generated.generatedQuestions,
        }))

        const { error: instErr } = await supabase
          .from('dictation_instances')
          .insert(instances)

        if (instErr) throw instErr
      }

      // 6. Re-upload audio with real blueprint_id (optional — preview URLs work too)
      // For now, keep the preview URLs — they are valid.

      logActivity('dictation_created', 'dictation_blueprints', blueprint.id, `Dictation "${title}" created with ${vocabulary.length} words`)

      showToast(`Dictation publicado. Código: ${session.access_code}`, 'success')

      // Reset wizard
      setStep(1)
      setGenerated(null)
      setAudioUrls({})
      setVocabulary([])
      setVocabInput('')
      setTitle('')
    } catch (err) {
      logError(err, { page: 'DictationPage', action: 'publishDictation' })
      showToast(err.message || 'Error al publicar', 'error')
    } finally {
      setLoading(false)
    }
  }

  // ── Render ──
  return (
    <div className="dict-create">
      {/* Step indicators */}
      <div className="dict-steps">
        {[1, 2, 3].map(s => (
          <div key={s} className={`dict-step-dot ${step === s ? 'active' : step > s ? 'done' : ''}`}>
            {step > s ? '✓' : s}
          </div>
        ))}
      </div>

      {/* ── STEP 1: Vocabulary + Config ── */}
      {step === 1 && (
        <div className="dict-step-panel">
          <h2>Paso 1: Vocabulario y configuración</h2>

          <div className="dict-form-grid">
            <div className="dict-field">
              <label>Grado + Sección</label>
              <select value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div className="dict-field">
              <label>Materia</label>
              <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="dict-field">
              <label>Unidad / Referencia</label>
              <input
                value={unitReference}
                onChange={e => setUnitReference(e.target.value)}
                placeholder="Ej: Uncover 4 — Unit 3"
              />
            </div>
          </div>

          {/* Difficulty selector */}
          <h3>Dificultad</h3>
          <div className="dict-difficulty-cards">
            {Object.values(DIFFICULTY_CONFIG).map(d => (
              <button
                key={d.key}
                className={`dict-diff-card ${difficulty === d.key ? 'selected' : ''}`}
                onClick={() => setDifficulty(d.key)}
              >
                <span className="dict-diff-icon">{d.icon}</span>
                <strong>{d.label}</strong>
                <span className="dict-diff-desc">{d.description}</span>
                <span className="dict-diff-count">{d.total} preguntas</span>
              </button>
            ))}
          </div>

          {/* Vocabulary input */}
          <h3>Vocabulario ({vocabulary.length} palabras)</h3>
          <div className="dict-vocab-row">
            <input
              value={vocabInput}
              onChange={e => setVocabInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addWord()}
              placeholder="Escribe una palabra o pega varias separadas por coma"
            />
            <button onClick={addWord} className="dict-btn-sm">+ Agregar</button>
            <button onClick={pasteWords} className="dict-btn-sm secondary">📋 Pegar lista</button>
          </div>

          {vocabulary.length > 0 && (
            <div className="dict-vocab-chips">
              {vocabulary.map(w => (
                <span key={w} className="dict-chip">
                  {w}
                  <button onClick={() => removeWord(w)} className="dict-chip-x">×</button>
                </span>
              ))}
            </div>
          )}

          {/* Voice selector */}
          <h3>Voz del dictado</h3>
          <div className="dict-voice-row">
            <select value={voiceId} onChange={e => setVoiceId(e.target.value)}>
              {VOICE_OPTIONS.filter(v => v.lang === 'en').map(v => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
            <label className="dict-speed-label">
              Velocidad: {speed.toFixed(1)}x
              <input
                type="range" min="0.5" max="1.5" step="0.1"
                value={speed} onChange={e => setSpeed(parseFloat(e.target.value))}
              />
            </label>
            <button onClick={previewVoice} className="dict-btn-sm secondary">🔊 Preview</button>
          </div>

          <div className="dict-actions">
            <button
              onClick={handleGenerate}
              disabled={generating || vocabulary.length < 3}
              className="dict-btn primary"
            >
              {generating ? '🤖 Generando...' : '🤖 Generar con IA'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Preview ── */}
      {step === 2 && generated && (
        <div className="dict-step-panel">
          <h2>Paso 2: Preview y Audio</h2>

          {generated.sections.map((sec, si) => (
            <div key={si} className="dict-preview-section">
              <h3>{sec.title}</h3>
              <p className="dict-preview-instr">{sec.instructions}</p>
              <div className="dict-preview-items">
                {sec.items.map((item, ii) => (
                  <div key={ii} className="dict-preview-item">
                    <span className="dict-preview-num">{ii + 1})</span>
                    {item.audio_text && (
                      <span className="dict-preview-audio-text">🔊 "{item.audio_text}"</span>
                    )}
                    {item.sentence && (
                      <span className="dict-preview-sentence">{item.sentence}</span>
                    )}
                    {item.options && (
                      <div className="dict-preview-options">
                        {item.options.map((opt, oi) => (
                          <span key={oi} className={`dict-preview-opt ${opt === item.correct_answer ? 'correct' : ''}`}>
                            {oi + 1}. {opt}
                          </span>
                        ))}
                      </div>
                    )}
                    <span className="dict-preview-answer">✓ {item.correct_answer}</span>
                    {/* Audio player if available */}
                    {audioUrls[sec.type]?.[ii] && (
                      <audio controls src={audioUrls[sec.type][ii]} className="dict-audio-mini" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="dict-actions">
            <button onClick={() => setStep(1)} className="dict-btn secondary">← Volver</button>
            <button
              onClick={handleGenerateAudio}
              disabled={generatingAudio}
              className="dict-btn"
              style={{ background: '#4BACC6' }}
            >
              {generatingAudio ? '🔊 Generando audio...' : '🔊 Generar Audio TTS'}
            </button>
            <button onClick={() => setStep(3)} className="dict-btn primary">
              Continuar →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Publish ── */}
      {step === 3 && (
        <div className="dict-step-panel">
          <h2>Paso 3: Publicar</h2>

          <div className="dict-form-grid">
            <div className="dict-field">
              <label>Título del dictation</label>
              <input value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="dict-field">
              <label>Duración (minutos)</label>
              <input
                type="number" min={5} max={90}
                value={duration} onChange={e => setDuration(parseInt(e.target.value) || 30)}
              />
            </div>
          </div>

          <div className="dict-publish-summary">
            <p><strong>Grado:</strong> {selectedGrade}</p>
            <p><strong>Materia:</strong> {selectedSubject}</p>
            <p><strong>Dificultad:</strong> {DIFFICULTY_CONFIG[difficulty]?.label}</p>
            <p><strong>Vocabulario:</strong> {vocabulary.length} palabras</p>
            <p><strong>Preguntas:</strong> {generated?.generatedQuestions?.length || 0}</p>
            <p><strong>Audio:</strong> {Object.values(audioUrls).flat().filter(Boolean).length > 0 ? '✅ Generado' : '⚠️ No generado (los estudiantes no escucharán audio)'}</p>
          </div>

          {/* Email structure (not operational) */}
          <div className="dict-email-notice">
            <p>📧 <strong>Próximamente:</strong> envío automático de resultados al correo del alumno y del representante.</p>
          </div>

          <div className="dict-actions">
            <button onClick={() => setStep(2)} className="dict-btn secondary">← Volver</button>
            <button
              onClick={handlePublish}
              disabled={loading || !title.trim()}
              className="dict-btn primary"
            >
              {loading ? '📡 Publicando...' : '🚀 Publicar Dictation'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: MIS DICTADOS
// ══════════════════════════════════════════════════════════════════════════════

function ListTab({ teacher, showToast }) {
  const [blueprints, setBlueprints] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [teacher])

  async function loadData() {
    setLoading(true)
    const [bpRes, sesRes] = await Promise.all([
      supabase
        .from('dictation_blueprints')
        .select('*')
        .eq('teacher_id', teacher.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('dictation_sessions')
        .select('*, dictation_instances(id, instance_status, student_name, student_code)')
        .eq('teacher_id', teacher.id)
        .order('created_at', { ascending: false }),
    ])
    setBlueprints(bpRes.data || [])
    setSessions(sesRes.data || [])
    setLoading(false)
  }

  async function closeSession(sessionId) {
    const { error } = await supabase
      .from('dictation_sessions')
      .update({ status: 'closed' })
      .eq('id', sessionId)
    if (error) {
      showToast('Error al cerrar sesión', 'error')
    } else {
      showToast('Sesión cerrada', 'success')
      loadData()
    }
  }

  if (loading) return <div className="dict-loading">Cargando...</div>

  if (sessions.length === 0) {
    return (
      <div className="dict-empty">
        <p>No tienes dictados creados aún.</p>
        <p>Usa la pestaña <strong>Crear</strong> para generar tu primer dictation.</p>
      </div>
    )
  }

  return (
    <div className="dict-list">
      {sessions.map(ses => {
        const bp = blueprints.find(b => b.id === ses.blueprint_id)
        const instances = ses.dictation_instances || []
        const submitted = instances.filter(i => i.instance_status === 'submitted').length
        const total = instances.length

        return (
          <div key={ses.id} className="dict-card">
            <div className="dict-card-header">
              <h3>{ses.title || bp?.title || 'Dictation'}</h3>
              <span className={`dict-status-badge ${ses.status}`}>{ses.status}</span>
            </div>
            <div className="dict-card-meta">
              <span>📝 {bp?.vocabulary?.length || 0} palabras</span>
              <span>📊 {bp?.difficulty || '?'}</span>
              <span>👥 {submitted}/{total} completados</span>
              <span>⏱ {ses.duration_minutes} min</span>
            </div>
            <div className="dict-card-code">
              <strong>Código:</strong> {ses.access_code}
              <button
                onClick={() => { navigator.clipboard.writeText(ses.access_code); showToast('Código copiado', 'info') }}
                className="dict-btn-sm"
              >
                📋
              </button>
            </div>
            {ses.status !== 'closed' && (
              <div className="dict-card-actions">
                <button onClick={() => closeSession(ses.id)} className="dict-btn-sm secondary">
                  🔒 Cerrar sesión
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: MONITOR EN VIVO
// ══════════════════════════════════════════════════════════════════════════════

function MonitorTab({ teacher }) {
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [instances, setInstances] = useState([])
  const [results, setResults] = useState({})
  const channelRef = useRef(null)

  // Load active sessions
  useEffect(() => {
    supabase
      .from('dictation_sessions')
      .select('id, title, access_code, status')
      .eq('teacher_id', teacher.id)
      .in('status', ['ready', 'active'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setSessions(data || [])
        if (data?.length > 0) setSelectedSession(data[0].id)
      })
  }, [teacher])

  // Load instances for selected session + subscribe to Realtime
  useEffect(() => {
    if (!selectedSession) return

    loadInstances()

    // Realtime subscription
    const channel = supabase
      .channel(`dictation-monitor-${selectedSession}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'dictation_instances',
        filter: `session_id=eq.${selectedSession}`,
      }, () => loadInstances())
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [selectedSession])

  async function loadInstances() {
    if (!selectedSession) return
    const { data } = await supabase
      .from('dictation_instances')
      .select('id, student_name, student_code, student_section, instance_status, started_at, submitted_at, tab_switches, time_spent_seconds')
      .eq('session_id', selectedSession)
      .order('student_name')

    setInstances(data || [])

    // Load results for submitted instances
    const submittedIds = (data || []).filter(i => i.instance_status === 'submitted').map(i => i.id)
    if (submittedIds.length > 0) {
      const { data: resData } = await supabase
        .from('dictation_results')
        .select('instance_id, colombian_grade, grade_level, total_score, max_score')
        .in('instance_id', submittedIds)
      const resMap = {}
      ;(resData || []).forEach(r => { resMap[r.instance_id] = r })
      setResults(resMap)
    }
  }

  const statusIcon = (s) => s === 'submitted' ? '✅' : s === 'started' ? '🔵' : '⚪'

  return (
    <div className="dict-monitor">
      <div className="dict-monitor-header">
        <select
          value={selectedSession || ''}
          onChange={e => setSelectedSession(e.target.value)}
        >
          {sessions.map(s => (
            <option key={s.id} value={s.id}>{s.title || s.access_code} ({s.status})</option>
          ))}
        </select>
        <span className="dict-monitor-live">📡 En vivo</span>
      </div>

      {instances.length === 0 ? (
        <p className="dict-empty">No hay estudiantes asignados a esta sesión.</p>
      ) : (
        <table className="dict-monitor-table">
          <thead>
            <tr>
              <th></th>
              <th>Estudiante</th>
              <th>Código</th>
              <th>Estado</th>
              <th>Nota</th>
              <th>Nivel</th>
              <th>Violaciones</th>
              <th>Tiempo</th>
            </tr>
          </thead>
          <tbody>
            {instances.map(inst => {
              const res = results[inst.id]
              return (
                <tr key={inst.id} className={`dict-monitor-row ${inst.instance_status}`}>
                  <td>{statusIcon(inst.instance_status)}</td>
                  <td>{inst.student_name || '—'}</td>
                  <td className="dict-code">{inst.student_code || '—'}</td>
                  <td>{inst.instance_status}</td>
                  <td style={{ color: res ? gradeColor(parseFloat(res.colombian_grade)) : '#999', fontWeight: 700 }}>
                    {res ? `${res.colombian_grade}/5.0` : '—'}
                  </td>
                  <td>{res?.grade_level || '—'}</td>
                  <td style={{ color: inst.tab_switches > 0 ? '#DC2626' : '#999' }}>
                    {inst.tab_switches || 0}
                  </td>
                  <td>
                    {inst.time_spent_seconds
                      ? `${Math.round(inst.time_spent_seconds / 60)} min`
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {/* Summary stats */}
      {instances.length > 0 && (
        <div className="dict-monitor-stats">
          <span>👥 {instances.length} estudiantes</span>
          <span>🔵 {instances.filter(i => i.instance_status === 'started').length} en progreso</span>
          <span>✅ {instances.filter(i => i.instance_status === 'submitted').length} completados</span>
          <span>⚪ {instances.filter(i => i.instance_status === 'ready').length} sin iniciar</span>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: CONFIGURACIÓN
// ══════════════════════════════════════════════════════════════════════════════

function ConfigTab({ teacher, showToast }) {
  const [telegramId, setTelegramId] = useState(teacher.telegram_chat_id || '')
  const [saving, setSaving] = useState(false)

  async function saveTelegram() {
    setSaving(true)
    const { error } = await supabase
      .from('teachers')
      .update({ telegram_chat_id: telegramId.trim() || null })
      .eq('id', teacher.id)
    setSaving(false)
    if (error) {
      showToast('Error al guardar', 'error')
    } else {
      showToast('Telegram ID guardado', 'success')
    }
  }

  return (
    <div className="dict-config">
      <h2>Configuración de Dictation</h2>

      <div className="dict-config-section">
        <h3>📱 Telegram</h3>
        <p>Ingresa tu Chat ID de Telegram para recibir notificaciones cuando los estudiantes se conecten y entreguen sus dictados.</p>
        <div className="dict-config-row">
          <input
            value={telegramId}
            onChange={e => setTelegramId(e.target.value)}
            placeholder="Ej: 2041749428"
          />
          <button onClick={saveTelegram} disabled={saving} className="dict-btn-sm">
            {saving ? 'Guardando...' : '💾 Guardar'}
          </button>
        </div>
      </div>

      <div className="dict-config-section">
        <h3>📧 Notificaciones por Email (próximamente)</h3>
        <p>Cuando esta función esté activa, los resultados se enviarán automáticamente al correo del alumno y del representante (<code>representative_email</code>).</p>
        <div className="dict-email-fields">
          <label>
            <input type="checkbox" disabled /> Enviar resultado al alumno
          </label>
          <label>
            <input type="checkbox" disabled /> Enviar resultado al representante
          </label>
        </div>
      </div>
    </div>
  )
}
