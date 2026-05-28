import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { generateDictation } from '../../utils/AIAssistant'
import {
  DIFFICULTY_CONFIG, VOICE_OPTIONS, QUESTION_POINTS, ASSESSMENT_MODES,
  getQuestionCounts, randomPrefix, generateDictationCode, buildManualSectionsScaffold,
  SECTION_META,
} from '../../utils/dictationUtils'
import { logError, logActivity } from '../../utils/logger'
import { printDictationHtml } from '../../utils/exportDictationHtml'
import VocabSetPicker from './VocabSetPicker'
import ManualEntryForm from './ManualEntryForm'
import AudioExportPanel from './AudioExportPanel'

export default function CreateTab({ teacher, showToast }) {
  const navigate = useNavigate()
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
  const [vocabulary, setVocabulary] = useState([])
  const [voices, setVoices] = useState(['en-US-JennyNeural'])
  const [speed, setSpeed] = useState(0.9)
  const [loadedSetName, setLoadedSetName] = useState('')
  const [assessmentMode, setAssessmentMode] = useState('dictation')

  // Entry mode
  const [entryMode, setEntryMode] = useState('ai') // 'ai' | 'manual'
  const [manualSections, setManualSections] = useState(null)

  // Step 2 — Generated
  const [generated, setGenerated] = useState(null)
  const [audioUrls, setAudioUrls] = useState({})

  // Progress
  const [aiMessage, setAiMessage]         = useState('')
  const [audioProgress, setAudioProgress] = useState(null) // null | { current, total, label }

  // Step 3 — Publish
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState(30)
  const [publishedSession, setPublishedSession] = useState(null) // { id, access_code }
  const [sendCodesState, setSendCodesState]     = useState(null) // null | 'sending' | { sent, skipped, errors[] }
  const [testEmailState, setTestEmailState]     = useState(null) // null | 'sending' | { ok, access_code, sent_to[], errors[] }
  const [testExtraEmail, setTestExtraEmail]     = useState(() => localStorage.getItem('cbf_test_extra_email') || '')

  // Load teacher assignments
  useEffect(() => {
    if (!teacher) return
    supabase
      .from('teacher_assignments')
      .select('grade, section, subject')
      .eq('teacher_id', teacher.id)
      .then(({ data }) => setAssignments(data || []))
  }, [teacher])

  const gradeOptions = [...new Set(assignments.map(a => `${a.grade} ${a.section}`))]
  const subjectOptions = [...new Set(assignments.map(a => a.subject))]

  function normalizeVocab(words) {
    return words.flatMap(w =>
      /[,;]/.test(w) ? w.split(/[,;]+/).map(s => s.trim()).filter(Boolean) : [w]
    )
  }

  const modeConfig = ASSESSMENT_MODES[assessmentMode] || ASSESSMENT_MODES.dictation
  const questionCounts = getQuestionCounts(difficulty, assessmentMode)

  // ── Preview voice (Azure TTS) ──
  const [previewing, setPreviewing] = useState(null) // null | voiceIndex
  const [previewAudio, setPreviewAudio] = useState(null)

  function stopPreview() {
    if (previewAudio) {
      previewAudio.pause()
      previewAudio.currentTime = 0
    }
    setPreviewing(null)
  }

  async function previewVoice(slotIndex) {
    stopPreview()
    const vId = voices[slotIndex] || voices[0]
    const opt = VOICE_OPTIONS.find(v => v.id === vId)
    const sampleText = opt?.lang === 'es'
      ? (vocabulary[0] || 'Hola, esta es una prueba de voz.')
      : (vocabulary[0] || 'Hello, this is a voice preview.')
    setPreviewing(slotIndex)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const edgeFnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dictation-tts`
      const res = await fetch(edgeFnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          texts: [sampleText],
          voice_id: vId,
          speed,
          blueprint_id: 'preview',
          school_id: teacher.school_id,
          section: 'preview',
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const url = data.audio_urls?.[0]
      if (!url) throw new Error('No audio URL returned')
      const audio = new Audio(url + '?t=' + Date.now())
      setPreviewAudio(audio)
      audio.onended = () => setPreviewing(null)
      audio.onerror = () => { setPreviewing(null); showToast('Error al reproducir preview', 'error') }
      audio.play()
    } catch (err) {
      setPreviewing(null)
      showToast(err.message || 'Error al generar preview de voz', 'error')
    }
  }

  function updateVoice(index, newVoiceId) {
    if (previewing === index) stopPreview()
    setVoices(prev => prev.map((v, i) => i === index ? newVoiceId : v))
  }

  function addVoice() {
    if (voices.length >= 4) return
    // Default to a different voice than the last selected
    const used = new Set(voices)
    const next = VOICE_OPTIONS.filter(v => v.lang === 'en' && !used.has(v.id))[0]?.id || 'en-US-GuyNeural'
    setVoices(prev => [...prev, next])
  }

  function removeVoice(index) {
    if (index === 0) return // can't remove the first voice
    if (previewing === index) stopPreview()
    setVoices(prev => prev.filter((_, i) => i !== index))
  }

  // ── Step 1 → Step 2: Manual mode ──
  function handleManualContinue() {
    if (vocabulary.length < 1) {
      showToast('Agrega al menos 1 palabra de vocabulario', 'warning')
      return
    }
    if (!selectedGrade) {
      showToast('Selecciona un grado', 'warning')
      return
    }
    const scaffold = buildManualSectionsScaffold(difficulty, assessmentMode)
    setManualSections(scaffold)
    setTitle(`${modeConfig.label}: ${unitReference || selectedSubject || 'Manual'}`)
    setStep(2)
  }

  // Convert manual sections to the same format as AI-generated
  function finalizeManualEntry() {
    if (!manualSections) return null
    const allItems = manualSections.flatMap(s => s.items)
    const filled = allItems.filter(it =>
      (it.correct_answer && it.correct_answer.trim()) ||
      (it.sentence && it.sentence.trim()) ||
      (it.word && it.word.trim()) ||
      (it.prompt && it.prompt.trim())
    )
    if (filled.length === 0) {
      showToast('Completa al menos un item antes de continuar', 'warning')
      return null
    }

    const cleanSections = manualSections.map(sec => ({
      ...sec,
      items: sec.items.filter(it =>
        (it.correct_answer && it.correct_answer.trim()) ||
        (it.sentence && it.sentence.trim()) ||
        (it.word && it.word.trim()) ||
        (it.prompt && it.prompt.trim())
      ),
    }))

    let idx = 0
    const generatedQuestions = cleanSections.flatMap(sec =>
      sec.items.map(item => ({
        index: idx++,
        question_type: sec.type,
        section_title: sec.title,
        audio_text: item.audio_text || null,
        sentence: item.sentence || null,
        word: item.word || null,
        prompt: item.prompt || null,
        required_words: item.required_words || null,
        options: item.options || null,
        correct_answer: item.correct_answer || '',
        max_score: item.max_score,
      }))
    )

    return {
      title: title || `${modeConfig.label}`,
      instructions: 'Complete each section carefully.',
      sections: cleanSections,
      generatedQuestions,
    }
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
    const AI_MESSAGES = [
      'Analizando vocabulario...',
      'Construyendo preguntas...',
      'Ajustando nivel de dificultad...',
      'Revisando estructura del assessment...',
      'Finalizando con IA...',
    ]
    let msgIdx = 0
    setAiMessage(AI_MESSAGES[0])
    const msgTimer = setInterval(() => {
      msgIdx = (msgIdx + 1) % AI_MESSAGES.length
      setAiMessage(AI_MESSAGES[msgIdx])
    }, 2200)
    try {
      const result = await generateDictation({
        vocabulary,
        unitReference,
        grade: selectedGrade,
        subject: selectedSubject || 'English',
        difficulty,
        assessmentMode,
      })
      setGenerated(result)
      setTitle(result.title || `${modeConfig.label}: ${unitReference || selectedSubject}`)
      setStep(2)
      showToast('Assessment generado por IA', 'success')
    } catch (err) {
      console.error('generateDictation error:', err)
      logError(err, { page: 'DictationPage', action: 'generateDictation' })
      showToast(err.message || 'Error al generar el assessment', 'error')
    } finally {
      clearInterval(msgTimer)
      setGenerating(false)
      setAiMessage('')
    }
  }

  // ── Generate audio via TTS Edge Function ──
  async function handleGenerateAudio(sourceOverride) {
    const source = sourceOverride || generated
    if (!source) {
      showToast('No hay assessment generado para crear audio', 'warning')
      return
    }
    setGeneratingAudio(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const edgeFnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dictation-tts`

      // Generate audio for all sections that have audio_text
      const audioSections = (source.sections || []).filter(s =>
        s.type === 'listen_type' || s.type === 'listen_identify' || s.type === 'listen_comprehension'
      )

      const newAudioUrls = {}
      const totalItems = audioSections.reduce((sum, s) => sum + s.items.filter(it => it.audio_text).length, 0)
      let doneItems = 0
      setAudioProgress({ current: 0, total: totalItems, label: '' })

      for (let sIdx = 0; sIdx < audioSections.length; sIdx++) {
        const sec = audioSections[sIdx]
        const texts = sec.items.map(it => it.audio_text).filter(Boolean)
        if (texts.length === 0) continue

        const sectionLabel = SECTION_META[sec.type]?.label || sec.type
        setAudioProgress({ current: doneItems, total: totalItems, label: `${SECTION_META[sec.type]?.icon || '🔊'} ${sectionLabel}` })

        const res = await fetch(edgeFnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            texts,
            voice_ids: voices,
            speed,
            blueprint_id: 'preview',
            school_id: teacher.school_id,
            section: sec.type,
          }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        newAudioUrls[sec.type] = data.audio_urls || []
        doneItems += texts.length
        setAudioProgress({ current: doneItems, total: totalItems, label: `${SECTION_META[sec.type]?.icon || '🔊'} ${sectionLabel}` })
      }

      setAudioUrls(newAudioUrls)
      showToast('Audio generado correctamente', 'success')
    } catch (err) {
      console.error('generateAudio error:', err)
      logError(err, { page: 'DictationPage', action: 'generateAudio' })
      showToast(err.message || 'Error al generar audio', 'error')
    } finally {
      setGeneratingAudio(false)
      setAudioProgress(null)
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
          voice_config: { voices, speed, assessment_mode: assessmentMode },
          sections: generated.sections,
          audio_urls: audioUrls,
          status: 'ready',
        })
        .select('id')
        .single()

      if (bpErr) throw bpErr

      const prefix = randomPrefix()

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

      const { data: students } = await supabase
        .from('school_students')
        .select('id, name, first_name, first_lastname, email, student_code, section')
        .eq('school_id', teacher.school_id)
        .eq('grade', baseGrade)
        .eq('section', section)
        .order('name')

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

      logActivity('dictation_created', 'dictation_blueprints', blueprint.id, `${modeConfig.label} "${title}" created with ${vocabulary.length} words`)

      showToast(`${modeConfig.label} publicado. Código: ${session.access_code}`, 'success')

      // Show post-publish panel
      setPublishedSession({ id: session.id, access_code: session.access_code })
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

      {/* ── POST-PUBLISH PANEL ── */}
      {publishedSession && (
        <div className="dict-postpublish-panel">
          <div className="dict-postpublish-icon">🎉</div>
          <h2>¡Dictado publicado!</h2>
          <p className="dict-postpublish-sub">Los estudiantes pueden ingresar ahora con su código personal.</p>

          <div className="dict-postpublish-link-box">
            <label>URL del estudiante</label>
            <div className="dict-postpublish-link-row">
              <span className="dict-postpublish-url">{`${window.location.origin}${import.meta.env.BASE_URL}eval/dictation`}</span>
              <button
                className="dict-postpublish-copy"
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}${import.meta.env.BASE_URL}eval/dictation`).then(() => showToast('URL copiada', 'success'))}
              >
                Copiar
              </button>
            </div>
            <p className="dict-postpublish-note">Cada estudiante usa su código individual generado automáticamente del roster.</p>
          </div>

          {/* Send codes by email */}
          <div className="dict-postpublish-email-box">
            {!sendCodesState && (
              <button
                className="dict-postpublish-btn dict-postpublish-btn-email"
                onClick={async () => {
                  setSendCodesState('sending')
                  try {
                    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dictation-send-codes`
                    const res = await fetch(url, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ session_id: publishedSession.id }),
                    })
                    const data = await res.json()
                    setSendCodesState({ sent: data.sent ?? 0, skipped: data.skipped ?? 0, errors: data.errors || [] })
                  } catch {
                    setSendCodesState({ sent: 0, skipped: 0, errors: ['Error de red'] })
                  }
                }}
              >
                📧 Enviar código a cada estudiante por email
              </button>
            )}
            {sendCodesState === 'sending' && (
              <p className="dict-postpublish-email-status sending">📡 Enviando correos...</p>
            )}
            {sendCodesState && typeof sendCodesState === 'object' && (
              <div className="dict-postpublish-email-result">
                <span className="dict-ppr-sent">✅ {sendCodesState.sent} correos enviados</span>
                {sendCodesState.skipped > 0 && (
                  <span className="dict-ppr-skipped">⚠️ {sendCodesState.skipped} sin email registrado</span>
                )}
                {sendCodesState.errors.length > 0 && (
                  <span className="dict-ppr-err">❌ {sendCodesState.errors.length} fallos</span>
                )}
                <button className="dict-ppr-retry" onClick={() => setSendCodesState(null)}>Reenviar</button>
              </div>
            )}
          </div>

          {/* Test email — send to teacher's own addresses */}
          <div className="dict-postpublish-test-box">
            <p className="dict-postpublish-test-label">🧪 Probar envío a mis correos</p>
            <div className="dict-postpublish-test-row">
              <span className="dict-postpublish-test-primary">{teacher.email}</span>
              <input
                className="dict-postpublish-test-input"
                type="email"
                placeholder="Correo adicional (opcional)"
                value={testExtraEmail}
                onChange={e => {
                  setTestExtraEmail(e.target.value)
                  localStorage.setItem('cbf_test_extra_email', e.target.value)
                }}
              />
              <button
                className="dict-postpublish-btn dict-postpublish-btn-test"
                disabled={testEmailState === 'sending'}
                onClick={async () => {
                  setTestEmailState('sending')
                  try {
                    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dictation-send-test`
                    const res = await fetch(url, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        session_id: publishedSession.id,
                        extra_email: testExtraEmail.trim() || undefined,
                      }),
                    })
                    const data = await res.json()
                    setTestEmailState(data)
                  } catch {
                    setTestEmailState({ ok: false, errors: ['Error de red'], sent_to: [] })
                  }
                }}
              >
                {testEmailState === 'sending' ? '📡 Enviando...' : '📨 Enviar prueba'}
              </button>
            </div>
            {testEmailState && typeof testEmailState === 'object' && (
              <div className="dict-postpublish-test-result">
                {testEmailState.ok
                  ? <span className="dict-ppr-sent">✅ Enviado a: {testEmailState.sent_to?.join(', ')}</span>
                  : <span className="dict-ppr-err">❌ Error al enviar</span>
                }
                {testEmailState.access_code && (
                  <span className="dict-postpublish-test-code">
                    Código de prueba: <strong>{testEmailState.access_code}</strong>
                  </span>
                )}
                <button className="dict-ppr-retry" onClick={() => setTestEmailState(null)}>Reenviar</button>
              </div>
            )}
          </div>

          <div className="dict-postpublish-actions">
            <button
              className="dict-postpublish-btn primary"
              onClick={() => navigate(`/dictations/session/${publishedSession.id}`)}
            >
              🎛️ Abrir Sala de Control
            </button>
            <button
              className="dict-postpublish-btn secondary"
              onClick={() => {
                setPublishedSession(null)
                setStep(1)
                setGenerated(null)
                setAudioUrls({})
                setVocabulary([])
                setLoadedSetName('')
                setTitle('')
              }}
            >
              ＋ Crear otro dictado
            </button>
          </div>
        </div>
      )}

      {!publishedSession && (<>
      {/* Step indicators */}
      <div className="dict-steps">
        {[1, 2, 3].map(s => (
          <div key={s} className={`dict-step-dot ${step === s ? 'active' : step > s ? 'done' : ''}`}>
            {step > s ? '✓' : s}
          </div>
        ))}
      </div>

      {/* ── STEP 1: Config ── */}
      {step === 1 && (
        <div className="dict-step-panel">
          <h2>Paso 1: Configuración del assessment</h2>

          {/* Assessment Mode Selector */}
          <h3>Tipo de evaluación</h3>
          <div className="dict-mode-cards">
            {Object.values(ASSESSMENT_MODES).map(m => (
              <button
                key={m.key}
                className={`dict-mode-card ${assessmentMode === m.key ? 'selected' : ''}`}
                style={{ '--mode-color': m.color }}
                onClick={() => setAssessmentMode(m.key)}
              >
                <span className="dict-mode-card-icon">{m.icon}</span>
                <strong>{m.label}</strong>
                <span className="dict-mode-card-desc">{m.description}</span>
              </button>
            ))}
          </div>

          {/* Question counts preview */}
          <div className="dict-counts-preview">
            {Object.entries(questionCounts).filter(([k]) => k !== 'total').map(([type, count]) => (
              <span key={type} className="dict-count-chip" style={{ background: SECTION_META[type]?.color || '#888' }}>
                {SECTION_META[type]?.icon} {SECTION_META[type]?.label}: {count}
              </span>
            ))}
            <span className="dict-count-chip dict-count-total">Total: {questionCounts.total}</span>
          </div>

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

          {/* Vocabulary — load from library only */}
          <h3>Vocabulario {vocabulary.length > 0 && <span style={{ fontWeight: 400 }}>({vocabulary.length} palabras{loadedSetName ? ` — ${loadedSetName}` : ''})</span>}</h3>

          <VocabSetPicker
            teacher={teacher}
            onLoadSet={(words, setName) => {
              const expanded = normalizeVocab(words)
              setVocabulary([...new Set(expanded)])
              setLoadedSetName(setName || '')
            }}
            showToast={showToast}
          />

          {vocabulary.length > 0 && (
            <div className="dict-vocab-chips">
              {vocabulary.map(w => (
                <span key={w} className="dict-chip">{w}</span>
              ))}
              <button
                onClick={() => { setVocabulary([]); setLoadedSetName('') }}
                className="dict-btn-sm secondary"
                style={{ marginLeft: 8 }}
              >
                Limpiar
              </button>
            </div>
          )}

          {vocabulary.length === 0 && (
            <p style={{ color: '#888', fontSize: 13, marginTop: 8 }}>
              Carga un vocabulario desde la <strong>Biblioteca de Vocabulario</strong> para continuar.
            </p>
          )}

          {/* Difficulty selector */}
          <h3>Dificultad</h3>
          <div className="dict-difficulty-cards">
            {Object.values(DIFFICULTY_CONFIG).map(d => {
              const counts = getQuestionCounts(d.key, assessmentMode)
              return (
                <button
                  key={d.key}
                  className={`dict-diff-card ${difficulty === d.key ? 'selected' : ''}`}
                  onClick={() => setDifficulty(d.key)}
                >
                  <span className="dict-diff-icon">{d.icon}</span>
                  <strong>{d.label}</strong>
                  <span className="dict-diff-desc">{d.description}</span>
                  <span className="dict-diff-count">{counts.total} preguntas</span>
                </button>
              )
            })}
          </div>

          {/* Multi-voice selector — only for modes that require audio */}
          {modeConfig.requiresAudio && (
            <>
              <h3>Voces del assessment</h3>
              <p className="dict-voice-hint-text">
                Las preguntas de audio rotan entre las voces seleccionadas.
                {voices.length >= 2 ? ' Las conversaciones de comprensión usarán Voz 1 (Speaker A) y Voz 2 (Speaker B).' : ' Agrega una segunda voz para que las conversaciones suenen más naturales.'}
              </p>

              <div className="dict-voice-slots">
                {voices.map((vId, i) => (
                  <div key={i} className="dict-voice-slot">
                    <span className="dict-voice-slot-num">
                      {i === 0 ? '🎤 Voz 1' : i === 1 ? '🎤 Voz 2' : i === 2 ? '🎤 Voz 3' : '🎤 Voz 4'}
                      {i === 0 && <span className="dict-voice-slot-role">· Speaker A</span>}
                      {i === 1 && <span className="dict-voice-slot-role">· Speaker B</span>}
                    </span>
                    <select
                      value={vId}
                      onChange={e => updateVoice(i, e.target.value)}
                      className="dict-voice-select"
                    >
                      <optgroup label="English">
                        {VOICE_OPTIONS.filter(v => v.lang === 'en').map(v => (
                          <option key={v.id} value={v.id}>{v.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Español">
                        {VOICE_OPTIONS.filter(v => v.lang === 'es').map(v => (
                          <option key={v.id} value={v.id}>{v.label}</option>
                        ))}
                      </optgroup>
                    </select>
                    {previewing === i
                      ? <button onClick={stopPreview} className="dict-btn-sm" style={{ background: '#C0504D', color: '#fff' }}>⏹ Stop</button>
                      : <button onClick={() => previewVoice(i)} disabled={previewing !== null} className="dict-btn-sm secondary">🔊</button>
                    }
                    {i > 0 && (
                      <button onClick={() => removeVoice(i)} className="dict-btn-sm" style={{ background: '#fee2e2', color: '#DC2626', padding: '4px 8px' }} title="Quitar voz">✕</button>
                    )}
                  </div>
                ))}
              </div>

              {voices.length < 4 && (
                <button onClick={addVoice} className="dict-btn-sm secondary" style={{ marginTop: 8 }}>
                  + Agregar voz ({voices.length}/4)
                </button>
              )}

              <label className="dict-speed-label" style={{ marginTop: 12 }}>
                Velocidad: {speed.toFixed(1)}x
                <input
                  type="range" min="0.5" max="1.5" step="0.1"
                  value={speed} onChange={e => setSpeed(parseFloat(e.target.value))}
                />
              </label>
            </>
          )}

          {/* Entry mode toggle */}
          <h3>Modo de entrada</h3>
          <div className="dict-mode-toggle">
            <button
              className={`dict-mode-btn ${entryMode === 'ai' ? 'active' : ''}`}
              onClick={() => setEntryMode('ai')}
            >
              🤖 IA genera todo
            </button>
            <button
              className={`dict-mode-btn ${entryMode === 'manual' ? 'active' : ''}`}
              onClick={() => setEntryMode('manual')}
            >
              ✍️ Yo escribo las oraciones
            </button>
          </div>

          {/* Action button */}
          <div className="dict-actions">
            {entryMode === 'ai' ? (
              <button
                onClick={handleGenerate}
                disabled={generating || vocabulary.length < 3}
                className="dict-btn primary"
              >
                {generating ? '🤖 Generando...' : `🤖 Generar con IA (${vocabulary.length} palabras)`}
              </button>
            ) : (
              <button
                onClick={handleManualContinue}
                disabled={vocabulary.length < 1}
                className="dict-btn primary"
              >
                ✍️ Continuar a edición manual
              </button>
            )}
            {vocabulary.length < 3 && entryMode === 'ai' && !generating && (
              <p style={{ color: '#C0504D', fontSize: 12, marginTop: 6 }}>Necesitas al menos 3 palabras en el vocabulario para generar</p>
            )}
          </div>

          {/* AI generation progress */}
          {generating && (
            <div className="dict-progress-box">
              <div className="dict-progress-label">
                <span className="dict-progress-icon">🤖</span>
                <span>{aiMessage}</span>
              </div>
              <div className="dict-progress-track">
                <div className="dict-progress-bar dict-progress-bar--indeterminate" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Preview (AI) ── */}
      {step === 2 && entryMode === 'ai' && generated && (
        <div className="dict-step-panel">
          <h2>Paso 2: Preview</h2>

          {generated.sections.map((sec, si) => (
            <div key={si} className="dict-preview-section" style={{ borderLeftColor: SECTION_META[sec.type]?.color || '#888' }}>
              <h3>{SECTION_META[sec.type]?.icon} {sec.title}</h3>
              <p className="dict-preview-instr">{sec.instructions}</p>
              <div className="dict-preview-items">
                {sec.items.map((item, ii) => (
                  <div key={ii} className="dict-preview-item">
                    <span className="dict-preview-num">{ii + 1})</span>
                    {item.audio_text && (
                      <span className="dict-preview-audio-text">🔊 "{item.audio_text}"</span>
                    )}
                    {item.word && (
                      <span className="dict-preview-word"><strong>{item.word}</strong></span>
                    )}
                    {item.sentence && (
                      <span className="dict-preview-sentence">{item.sentence}</span>
                    )}
                    {item.prompt && (
                      <span className="dict-preview-prompt">✍️ {item.prompt}</span>
                    )}
                    {item.required_words && item.required_words.length > 0 && (
                      <div className="dict-preview-req-words">
                        Required: {item.required_words.map((w, wi) => (
                          <span key={wi} className="dict-chip readonly">{w}</span>
                        ))}
                      </div>
                    )}
                    {item.options && (
                      <div className="dict-preview-options">
                        {item.options.map((opt, oi) => (
                          <span key={oi} className={`dict-preview-opt ${opt === item.correct_answer ? 'correct' : ''}`}>
                            {String.fromCharCode(65 + oi)}. {opt}
                          </span>
                        ))}
                      </div>
                    )}
                    {item.correct_answer && (
                      <span className="dict-preview-answer">✓ {item.correct_answer}</span>
                    )}
                    {audioUrls[sec.type]?.[ii] && (
                      <audio controls src={audioUrls[sec.type][ii]} className="dict-audio-mini" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Audio export panel — only if audio sections exist */}
          {modeConfig.requiresAudio && (
            <AudioExportPanel
              audioUrls={audioUrls}
              sections={(generated.sections || []).filter(s => s.type === 'listen_type' || s.type === 'listen_identify' || s.type === 'listen_comprehension')}
              title={title || generated.title}
              showToast={showToast}
            />
          )}

          <div className="dict-actions">
            <button onClick={() => setStep(1)} className="dict-btn secondary">← Volver</button>
            {modeConfig.requiresAudio && (
              <button
                onClick={() => handleGenerateAudio()}
                disabled={generatingAudio}
                className="dict-btn"
                style={{ background: '#4BACC6' }}
              >
                {generatingAudio ? '🔊 Generando audio...' : '🔊 Generar Audio TTS'}
              </button>
            )}
            <button
              onClick={async () => {
                const { data: schoolData } = await supabase.from('schools').select('*').eq('id', teacher.school_id).single()
                printDictationHtml({
                  blueprint: { ...generated, grade: selectedGrade, subject: selectedSubject, difficulty, unit_reference: unitReference, vocabulary, assessment_mode: assessmentMode },
                  school: schoolData,
                  teacherName: teacher.full_name || teacher.email,
                })
              }}
              className="dict-btn secondary"
            >
              📄 Exportar PDF
            </button>
            <button onClick={() => setStep(3)} className="dict-btn primary">
              Continuar →
            </button>
          </div>

          {/* Audio generation progress */}
          {generatingAudio && audioProgress && (
            <div className="dict-progress-box">
              <div className="dict-progress-label">
                <span>{audioProgress.label || '🔊 Generando audio...'}</span>
                <span className="dict-progress-count">{audioProgress.current}/{audioProgress.total} audios</span>
              </div>
              <div className="dict-progress-track">
                <div
                  className="dict-progress-bar"
                  style={{ width: audioProgress.total > 0 ? `${(audioProgress.current / audioProgress.total) * 100}%` : '0%' }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Manual Entry ── */}
      {step === 2 && entryMode === 'manual' && manualSections && (
        <div className="dict-step-panel">
          <h2>Paso 2: Escribe las oraciones</h2>
          <p style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>
            Completa cada sección. {modeConfig.requiresAudio ? 'El audio TTS se generará a partir del texto que ingreses.' : 'Este assessment no incluye audio.'}
          </p>

          <ManualEntryForm
            sections={manualSections}
            onChange={setManualSections}
            vocabulary={vocabulary}
          />

          {modeConfig.requiresAudio && Object.values(audioUrls).flat().filter(Boolean).length > 0 && (
            <AudioExportPanel
              audioUrls={audioUrls}
              sections={(manualSections || []).filter(s => s.type === 'listen_type' || s.type === 'listen_identify' || s.type === 'listen_comprehension')}
              title={title}
              showToast={showToast}
            />
          )}

          <div className="dict-actions" style={{ marginTop: 20 }}>
            <button onClick={() => setStep(1)} className="dict-btn secondary">← Volver</button>
            {modeConfig.requiresAudio && (
              <button
                onClick={() => {
                  const finalized = finalizeManualEntry()
                  if (finalized) {
                    setGenerated(finalized)
                    handleGenerateAudio(finalized)
                  }
                }}
                disabled={generatingAudio}
                className="dict-btn"
                style={{ background: '#4BACC6' }}
              >
                {generatingAudio ? '🔊 Generando audio...' : '🔊 Generar Audio TTS'}
              </button>
            )}
            <button
              onClick={() => {
                const finalized = finalizeManualEntry()
                if (finalized) {
                  setGenerated(finalized)
                  setStep(3)
                }
              }}
              className="dict-btn primary"
            >
              Continuar →
            </button>
          </div>

          {/* Audio generation progress */}
          {generatingAudio && audioProgress && (
            <div className="dict-progress-box">
              <div className="dict-progress-label">
                <span>{audioProgress.label || '🔊 Generando audio...'}</span>
                <span className="dict-progress-count">{audioProgress.current}/{audioProgress.total} audios</span>
              </div>
              <div className="dict-progress-track">
                <div
                  className="dict-progress-bar"
                  style={{ width: audioProgress.total > 0 ? `${(audioProgress.current / audioProgress.total) * 100}%` : '0%' }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Publish ── */}
      {step === 3 && (
        <div className="dict-step-panel">
          <h2>Paso 3: Publicar</h2>

          <div className="dict-form-grid">
            <div className="dict-field">
              <label>Título del assessment</label>
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
            <p><strong>Tipo:</strong> {modeConfig.icon} {modeConfig.label}</p>
            <p><strong>Grado:</strong> {selectedGrade}</p>
            <p><strong>Materia:</strong> {selectedSubject}</p>
            <p><strong>Dificultad:</strong> {DIFFICULTY_CONFIG[difficulty]?.label}</p>
            <p><strong>Vocabulario:</strong> {vocabulary.length} palabras</p>
            <p><strong>Preguntas:</strong> {generated?.generatedQuestions?.length || 0}</p>
            {modeConfig.requiresAudio && (
              <p><strong>Audio:</strong> {Object.values(audioUrls).flat().filter(Boolean).length > 0 ? '✅ Generado' : '⚠️ No generado'}</p>
            )}
          </div>

          <div className="dict-actions">
            <button onClick={() => setStep(2)} className="dict-btn secondary">← Volver</button>
            <button
              onClick={handlePublish}
              disabled={loading || !title.trim()}
              className="dict-btn primary"
            >
              {loading ? '📡 Publicando...' : `🚀 Publicar ${modeConfig.label}`}
            </button>
          </div>
        </div>
      )}
      </>)}
    </div>
  )
}
