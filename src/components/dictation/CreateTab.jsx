import { useState, useEffect } from 'react'
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
  const [voiceId, setVoiceId] = useState('en-US-JennyNeural')
  const [speed, setSpeed] = useState(0.9)
  const [loadedSetName, setLoadedSetName] = useState('')
  const [assessmentMode, setAssessmentMode] = useState('dictation')

  // Entry mode
  const [entryMode, setEntryMode] = useState('ai') // 'ai' | 'manual'
  const [manualSections, setManualSections] = useState(null)

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
  const [previewing, setPreviewing] = useState(false)
  const [previewAudio, setPreviewAudio] = useState(null)

  function stopPreview() {
    if (previewAudio) {
      previewAudio.pause()
      previewAudio.currentTime = 0
    }
    setPreviewing(false)
  }

  async function previewVoice() {
    const opt = VOICE_OPTIONS.find(v => v.id === voiceId)
    const sampleText = opt?.lang === 'es'
      ? (vocabulary[0] || 'Hola, esta es una prueba de voz.')
      : (vocabulary[0] || 'Hello, this is a voice preview.')
    setPreviewing(true)
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
          voice_id: voiceId,
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
      audio.onended = () => setPreviewing(false)
      audio.onerror = () => { setPreviewing(false); showToast('Error al reproducir preview', 'error') }
      audio.play()
    } catch (err) {
      setPreviewing(false)
      showToast(err.message || 'Error al generar preview de voz', 'error')
    }
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
      setGenerating(false)
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

      // Only generate audio for sections that have audio_text
      const audioSections = (source.sections || []).filter(s =>
        s.type === 'listen_type' || s.type === 'listen_identify'
      )

      const newAudioUrls = {}

      for (const sec of audioSections) {
        const texts = sec.items.map(it => it.audio_text).filter(Boolean)
        if (texts.length === 0) continue

        const res = await fetch(edgeFnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            texts,
            voice_id: voiceId,
            speed,
            blueprint_id: 'preview',
            school_id: teacher.school_id,
            section: sec.type,
          }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        newAudioUrls[sec.type] = data.audio_urls || []
      }

      setAudioUrls(newAudioUrls)
      showToast('Audio generado correctamente', 'success')
    } catch (err) {
      console.error('generateAudio error:', err)
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
          voice_config: { voice_id: voiceId, speed, assessment_mode: assessmentMode },
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

      // Reset wizard
      setStep(1)
      setGenerated(null)
      setAudioUrls({})
      setVocabulary([])
      setLoadedSetName('')
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

          {/* Voice selector — only for modes that require audio */}
          {modeConfig.requiresAudio && (
            <>
              <h3>Voz del dictado</h3>
              <div className="dict-voice-row">
                <select value={voiceId} onChange={e => { stopPreview(); setVoiceId(e.target.value) }}>
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
                <label className="dict-speed-label">
                  Velocidad: {speed.toFixed(1)}x
                  <input
                    type="range" min="0.5" max="1.5" step="0.1"
                    value={speed} onChange={e => setSpeed(parseFloat(e.target.value))}
                  />
                </label>
                {previewing
                  ? <button onClick={stopPreview} className="dict-btn-sm" style={{ background: '#C0504D', color: '#fff' }}>Stop</button>
                  : <button onClick={previewVoice} className="dict-btn-sm secondary">🔊 Preview</button>
                }
              </div>
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
            {vocabulary.length < 3 && entryMode === 'ai' && (
              <p style={{ color: '#C0504D', fontSize: 12, marginTop: 6 }}>Necesitas al menos 3 palabras en el vocabulario para generar</p>
            )}
          </div>
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
              sections={(generated.sections || []).filter(s => s.type === 'listen_type' || s.type === 'listen_identify')}
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
              sections={(manualSections || []).filter(s => s.type === 'listen_type' || s.type === 'listen_identify')}
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
    </div>
  )
}
