import { useState, useEffect } from 'react'
import { supabase } from '../../supabase'
import { generateDictation } from '../../utils/AIAssistant'
import {
  DIFFICULTY_CONFIG, VOICE_OPTIONS, QUESTION_POINTS,
  randomPrefix, generateDictationCode, buildManualSectionsScaffold,
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
  const [vocabInput, setVocabInput] = useState('')
  const [vocabulary, setVocabulary] = useState([])
  const [voiceId, setVoiceId] = useState('en-US-JennyNeural')
  const [speed, setSpeed] = useState(0.9)

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
  const [previewing, setPreviewing] = useState(false)

  function stopPreview() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setPreviewing(false)
  }

  function previewVoice() {
    if (!('speechSynthesis' in window)) {
      showToast('Tu navegador no soporta preview de voz', 'warning')
      return
    }
    window.speechSynthesis.cancel()
    const opt = VOICE_OPTIONS.find(v => v.id === voiceId)
    const sampleText = opt?.lang === 'es'
      ? (vocabulary[0] || 'Hola, esta es una prueba de voz.')
      : (vocabulary[0] || 'Hello, this is a voice test.')
    const utt = new SpeechSynthesisUtterance(sampleText)
    utt.lang = opt?.lang === 'es' ? 'es-CO' : 'en-US'
    utt.rate = speed

    const voices = window.speechSynthesis.getVoices()
    if (voices.length && opt) {
      const match = voices.find(v => v.lang.startsWith(opt.lang === 'es' ? 'es' : 'en'))
      if (match) utt.voice = match
    }

    utt.onstart = () => setPreviewing(true)
    utt.onend = () => setPreviewing(false)
    utt.onerror = () => setPreviewing(false)
    window.speechSynthesis.speak(utt)
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
    const scaffold = buildManualSectionsScaffold(difficulty)
    setManualSections(scaffold)
    setTitle(`Dictation: ${unitReference || selectedSubject || 'Manual'}`)
    setStep(2)
  }

  // Convert manual sections to the same format as AI-generated
  function finalizeManualEntry() {
    if (!manualSections) return null
    // Validate: at least some items filled
    const allItems = manualSections.flatMap(s => s.items)
    const filled = allItems.filter(it =>
      (it.correct_answer && it.correct_answer.trim()) ||
      (it.sentence && it.sentence.trim())
    )
    if (filled.length === 0) {
      showToast('Completa al menos un item antes de continuar', 'warning')
      return null
    }

    // Filter out empty items and build generatedQuestions
    const cleanSections = manualSections.map(sec => ({
      ...sec,
      items: sec.items.filter(it =>
        (it.correct_answer && it.correct_answer.trim()) ||
        (it.sentence && it.sentence.trim())
      ),
    }))

    let idx = 0
    const generatedQuestions = cleanSections.flatMap(sec =>
      sec.items.map(item => ({
        index: idx++,
        question_type: sec.type,
        section_title: sec.title,
        audio_text: item.audio_text || '',
        sentence: item.sentence || '',
        options: item.options || null,
        correct_answer: item.correct_answer || '',
        max_score: item.max_score,
      }))
    )

    return {
      title: title || 'Manual Dictation',
      instructions: 'Listen carefully and answer each section.',
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
  async function handleGenerateAudio(sourceOverride) {
    const source = sourceOverride || generated
    if (!source) return
    setGeneratingAudio(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const edgeFnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dictation-tts`

      // Collect all audio_text items from sections 1 & 2
      const textsSection1 = source.sections[0].items.map(it => it.audio_text).filter(Boolean)
      const textsSection2 = source.sections[1].items.map(it => it.audio_text).filter(Boolean)

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

          <VocabSetPicker
            teacher={teacher}
            vocabulary={vocabulary}
            onLoadSet={(words) => setVocabulary(prev => {
              const merged = [...new Set([...prev, ...words])]
              return merged
            })}
            showToast={showToast}
          />

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

          <div className="dict-actions">
            {entryMode === 'ai' ? (
              <button
                onClick={handleGenerate}
                disabled={generating || vocabulary.length < 3}
                className="dict-btn primary"
              >
                {generating ? '🤖 Generando...' : '🤖 Generar con IA'}
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
          </div>
        </div>
      )}

      {/* ── STEP 2: Preview (AI) or Manual Entry ── */}
      {step === 2 && entryMode === 'ai' && generated && (
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
                    {audioUrls[sec.type]?.[ii] && (
                      <audio controls src={audioUrls[sec.type][ii]} className="dict-audio-mini" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Audio export panel */}
          <AudioExportPanel
            audioUrls={audioUrls}
            sections={generated.sections}
            title={title || generated.title}
            showToast={showToast}
          />

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
            <button
              onClick={async () => {
                const { data: schoolData } = await supabase.from('schools').select('*').eq('id', teacher.school_id).single()
                printDictationHtml({
                  blueprint: { ...generated, grade: selectedGrade, subject: selectedSubject, difficulty, unit_reference: unitReference, vocabulary },
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
            Completa cada sección. El audio TTS se generará a partir del texto que ingreses.
          </p>

          <ManualEntryForm
            sections={manualSections}
            onChange={setManualSections}
            vocabulary={vocabulary}
          />

          {/* Audio export panel (after TTS generation) */}
          {Object.values(audioUrls).flat().filter(Boolean).length > 0 && (
            <AudioExportPanel
              audioUrls={audioUrls}
              sections={manualSections}
              title={title}
              showToast={showToast}
            />
          )}

          <div className="dict-actions" style={{ marginTop: 20 }}>
            <button onClick={() => setStep(1)} className="dict-btn secondary">← Volver</button>
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
