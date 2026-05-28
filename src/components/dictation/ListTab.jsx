import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { printDictationHtml } from '../../utils/exportDictationHtml'
import { randomPrefix, generateDictationCode, DIFFICULTY_CONFIG } from '../../utils/dictationUtils'
import { logError, logActivity } from '../../utils/logger'

export default function ListTab({ teacher, showToast }) {
  const navigate = useNavigate()
  const [blueprints, setBlueprints] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedBp, setExpandedBp] = useState(null)

  // Filters
  const [filterGrade, setFilterGrade] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterSearch, setFilterSearch] = useState('')

  // Reuse
  const [reusing, setReusing] = useState(null) // blueprint id being reused
  const [reuseDuration, setReuseDuration] = useState(30)

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

  async function toggleArchive(bp) {
    const newStatus = bp.status === 'archived' ? 'ready' : 'archived'
    const { error } = await supabase
      .from('dictation_blueprints')
      .update({ status: newStatus })
      .eq('id', bp.id)
    if (error) {
      showToast('Error al cambiar estado', 'error')
    } else {
      showToast(newStatus === 'archived' ? 'Dictado archivado' : 'Dictado restaurado', 'success')
      loadData()
    }
  }

  async function handleReuse(bp) {
    setReusing(bp.id)
    try {
      const gradeParts = bp.grade.split(' ')
      const baseGrade = gradeParts[0]
      const section = gradeParts.slice(1).join(' ')
      const prefix = randomPrefix()

      // Create new session
      const { data: session, error: sesErr } = await supabase
        .from('dictation_sessions')
        .insert({
          blueprint_id: bp.id,
          teacher_id: teacher.id,
          school_id: teacher.school_id,
          title: bp.title,
          access_code: `DICT-${prefix}`,
          duration_minutes: reuseDuration,
          status: 'ready',
        })
        .select('id, access_code')
        .single()

      if (sesErr) throw sesErr

      // Load current roster
      const { data: students } = await supabase
        .from('school_students')
        .select('id, name, first_name, first_lastname, email, student_code, section')
        .eq('school_id', teacher.school_id)
        .eq('grade', baseGrade)
        .eq('section', section)
        .order('name')

      if (students && students.length > 0) {
        // Build generatedQuestions from blueprint sections
        let idx = 0
        const generatedQuestions = (bp.sections || []).flatMap(sec =>
          (sec.items || []).map(item => ({
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

        const instances = students.map(st => ({
          session_id: session.id,
          student_id: st.id,
          student_email: st.email,
          student_name: st.name || `${st.first_name || ''} ${st.first_lastname || ''}`.trim(),
          student_section: st.section || section,
          student_code: st.student_code,
          access_code: generateDictationCode(prefix, st.student_code),
          generated_questions: generatedQuestions,
        }))

        const { error: instErr } = await supabase
          .from('dictation_instances')
          .insert(instances)
        if (instErr) throw instErr
      }

      logActivity('dictation_reused', 'dictation_blueprints', bp.id, `Reused dictation "${bp.title}" — new session ${session.access_code}`)
      showToast(`Nueva sesión creada. Código: ${session.access_code}`, 'success')
      loadData()
    } catch (err) {
      logError(err, { page: 'DictationPage', action: 'reuseDictation' })
      showToast(err.message || 'Error al reusar dictado', 'error')
    } finally {
      setReusing(null)
    }
  }

  async function handlePrintPdf(bp) {
    const { data: schoolData } = await supabase.from('schools').select('*').eq('id', teacher.school_id).single()
    printDictationHtml({ blueprint: bp, school: schoolData, teacherName: teacher.full_name || teacher.email })
  }

  if (loading) return <div className="dict-loading">Cargando...</div>

  // Derive filter options
  const grades = [...new Set(blueprints.map(b => b.grade).filter(Boolean))]
  const subjects = [...new Set(blueprints.map(b => b.subject).filter(Boolean))]

  // Filter blueprints
  const filtered = blueprints.filter(bp => {
    if (filterGrade && bp.grade !== filterGrade) return false
    if (filterSubject && bp.subject !== filterSubject) return false
    if (filterSearch) {
      const q = filterSearch.toLowerCase()
      const match =
        (bp.title || '').toLowerCase().includes(q) ||
        (bp.unit_reference || '').toLowerCase().includes(q) ||
        (bp.vocabulary || []).some(w => w.toLowerCase().includes(q))
      if (!match) return false
    }
    return true
  })

  if (blueprints.length === 0) {
    return (
      <div className="dict-empty">
        <p>No tienes dictados creados aún.</p>
        <p>Usa la pestaña <strong>Crear</strong> para generar tu primer dictation.</p>
      </div>
    )
  }

  return (
    <div className="dict-library">
      {/* Filters */}
      <div className="dict-library-filters">
        <input
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          placeholder="Buscar por título, unidad o palabra..."
          className="dict-library-search"
        />
        <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)}>
          <option value="">Todos los grados</option>
          {grades.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
          <option value="">Todas las materias</option>
          {subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <p className="dict-library-count">{filtered.length} dictado{filtered.length !== 1 ? 's' : ''}</p>

      {/* Blueprint cards */}
      <div className="dict-library-list">
        {filtered.map(bp => {
          const bpSessions = sessions.filter(s => s.blueprint_id === bp.id)
          const isExpanded = expandedBp === bp.id
          const totalItems = (bp.sections || []).reduce((sum, s) => sum + (s.items?.length || 0), 0)
          const diffCfg = DIFFICULTY_CONFIG[bp.difficulty]

          return (
            <div key={bp.id} className={`dict-library-card ${bp.status === 'archived' ? 'archived' : ''}`}>
              <div
                className="dict-library-card-top"
                onClick={() => setExpandedBp(isExpanded ? null : bp.id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="dict-library-card-title">
                  <h3>{bp.title || 'Dictation'}</h3>
                  <span className={`dict-status-badge ${bp.status}`}>{bp.status}</span>
                </div>
                <div className="dict-card-meta">
                  <span>📚 {bp.grade}</span>
                  <span>📝 {bp.subject}</span>
                  <span>{diffCfg?.icon || '📊'} {bp.difficulty}</span>
                  <span>🔤 {bp.vocabulary?.length || 0} palabras</span>
                  <span>❓ {totalItems} items</span>
                  {bp.unit_reference && <span>📖 {bp.unit_reference}</span>}
                </div>
                <div className="dict-library-card-date">
                  {new Date(bp.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="dict-library-detail">
                  {/* Vocabulary */}
                  <div style={{ marginBottom: 12 }}>
                    <strong style={{ fontSize: 12, color: '#666' }}>Vocabulario:</strong>
                    <div className="dict-vocab-chips" style={{ marginTop: 4 }}>
                      {(bp.vocabulary || []).map(w => (
                        <span key={w} className="dict-chip readonly">{w}</span>
                      ))}
                    </div>
                  </div>

                  {/* Sections with answers */}
                  {(bp.sections || []).map((sec, si) => (
                    <div key={si} className="dict-library-section">
                      <h4 style={{ color: '#1F3864', fontSize: 13, marginBottom: 6 }}>{sec.title}</h4>
                      {sec.items.map((item, ii) => (
                        <div key={ii} className="dict-library-item">
                          <span className="dict-preview-num">{ii + 1})</span>
                          {item.audio_text && <span className="dict-preview-audio-text">🔊 "{item.audio_text}"</span>}
                          {item.sentence && <span className="dict-preview-sentence">{item.sentence}</span>}
                          {item.options && (
                            <div className="dict-preview-options">
                              {item.options.map((opt, oi) => (
                                <span key={oi} className={`dict-preview-opt ${opt === item.correct_answer ? 'correct' : ''}`}>
                                  {opt}
                                </span>
                              ))}
                            </div>
                          )}
                          <span className="dict-preview-answer">✓ {item.correct_answer}</span>
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* Sessions history */}
                  {bpSessions.length > 0 && (
                    <div className="dict-library-sessions">
                      <strong style={{ fontSize: 12, color: '#666' }}>Sesiones ({bpSessions.length}):</strong>
                      {bpSessions.map(ses => {
                        const insts = ses.dictation_instances || []
                        const submitted = insts.filter(i => i.instance_status === 'submitted').length
                        return (
                          <div key={ses.id} className="dict-library-session-row">
                            <span className={`dict-status-badge sm ${ses.status}`}>{ses.status}</span>
                            <span className="dict-code">{ses.access_code}</span>
                            <span>👥 {submitted}/{insts.length}</span>
                            <span>{new Date(ses.created_at).toLocaleDateString('es-CO')}</span>
                            {ses.status !== 'closed' && (
                              <>
                                <button
                                  onClick={() => navigate(`/dictations/session/${ses.id}`)}
                                  className="dict-btn-sm"
                                  style={{ fontSize: 11, padding: '2px 8px', background: '#1F3864', color: 'white', border: 'none' }}
                                >
                                  🎛️ Sala
                                </button>
                                <button onClick={() => closeSession(ses.id)} className="dict-btn-sm secondary" style={{ fontSize: 11, padding: '2px 8px' }}>
                                  🔒 Cerrar
                                </button>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="dict-card-actions" style={{ marginTop: 14 }}>
                    <button onClick={() => handlePrintPdf(bp)} className="dict-btn-sm secondary">📄 PDF</button>
                    <button onClick={() => toggleArchive(bp)} className="dict-btn-sm secondary">
                      {bp.status === 'archived' ? '📂 Restaurar' : '📦 Archivar'}
                    </button>
                    <div className="dict-reuse-row">
                      <input
                        type="number" min={5} max={90}
                        value={reuseDuration}
                        onChange={e => setReuseDuration(parseInt(e.target.value) || 30)}
                        style={{ width: 60, padding: '4px 6px', fontSize: 12, borderRadius: 6, border: '1px solid #d1d5db' }}
                        title="Duración (min)"
                      />
                      <span style={{ fontSize: 11, color: '#888' }}>min</span>
                      <button
                        onClick={() => handleReuse(bp)}
                        disabled={reusing === bp.id}
                        className="dict-btn-sm"
                        style={{ background: '#059669', color: 'white' }}
                      >
                        {reusing === bp.id ? 'Creando...' : '🔄 Nueva sesión'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
