import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../supabase'
import { gradeColor } from '../../utils/dictationUtils'
import CorrectedExamModal from './CorrectedExamModal'

export default function MonitorTab({ teacher }) {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [instances, setInstances] = useState([])
  const [results, setResults] = useState({})
  const [blueprint, setBlueprint] = useState(null)
  const channelRef = useRef(null)

  // ── Corrected view state ──
  const [correctedView, setCorrectedView]     = useState(null)
  const [correctedLoading, setCorrectedLoading] = useState(false)
  const [emailSent, setEmailSent]             = useState(new Set())
  const [emailLoading, setEmailLoading]       = useState(null)
  const [actionMsg, setActionMsg]             = useState(null)

  function showAction(msg) {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(null), 3000)
  }

  // Load active sessions
  useEffect(() => {
    supabase
      .from('dictation_sessions')
      .select('id, title, access_code, status, blueprint_id')
      .eq('teacher_id', teacher.id)
      .in('status', ['ready', 'active'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setSessions(data || [])
        if (data?.length > 0) setSelectedSession(data[0].id)
      })
  }, [teacher])

  // Load blueprint when session changes
  useEffect(() => {
    if (!selectedSession) return
    const ses = sessions.find(s => s.id === selectedSession)
    if (!ses?.blueprint_id) return
    supabase
      .from('dictation_blueprints')
      .select('id, title, subject, grade, difficulty, vocabulary, sections, audio_urls, assessment_mode')
      .eq('id', ses.blueprint_id)
      .single()
      .then(({ data }) => setBlueprint(data || null))
  }, [selectedSession, sessions])

  // Load instances for selected session + subscribe to Realtime
  useEffect(() => {
    if (!selectedSession) return

    loadInstances()

    const channel = supabase
      .channel(`dictation-monitor-${selectedSession}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'dictation_instances',
        filter: `session_id=eq.${selectedSession}`,
      }, () => loadInstances())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'dictation_results',
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

  async function openCorrectedView(inst) {
    setCorrectedLoading(inst.id)
    try {
      const { data: fullInst } = await supabase
        .from('dictation_instances')
        .select('id, student_name, student_section, student_code, generated_questions')
        .eq('id', inst.id)
        .single()
      const { data: resps } = await supabase
        .from('dictation_responses')
        .select('question_index, question_type, answer, correct_answer, is_correct, score, max_score')
        .eq('instance_id', inst.id)
        .order('question_index')
      setCorrectedView({ inst: fullInst || inst, responses: resps || [] })
    } finally {
      setCorrectedLoading(null)
    }
  }

  async function sendRepresentativeEmail(inst) {
    setEmailLoading(inst.id)
    try {
      const edgeFnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dictation-notify`
      const res = await fetch(edgeFnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instance_id: inst.id }),
      })
      const data = await res.json()
      if (data.ok) {
        setEmailSent(prev => new Set([...prev, inst.id]))
        showAction('📧 Email enviado al representante')
      } else {
        showAction(`❌ ${data.error || 'Error al enviar email'}`)
      }
    } catch {
      showAction('❌ Error de red al enviar email')
    } finally {
      setEmailLoading(null)
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
        {selectedSession && (
          <button
            className="dict-btn-sala"
            onClick={() => navigate(`/dictations/session/${selectedSession}`)}
          >
            🎛️ Sala de Control
          </button>
        )}
        <span className="dict-monitor-live">📡 En vivo</span>
      </div>

      {actionMsg && <div className="dict-monitor-action-msg">{actionMsg}</div>}

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
              <th>PDF</th>
            </tr>
          </thead>
          <tbody>
            {instances.map(inst => {
              const res = results[inst.id]
              const isSubmitted = inst.instance_status === 'submitted'
              const loading = correctedLoading === inst.id
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
                  <td>
                    {isSubmitted && (
                      <button
                        className="dict-monitor-pdf-btn"
                        onClick={() => openCorrectedView(inst)}
                        disabled={loading}
                        title="Ver respuestas corregidas y PDF"
                      >
                        {loading ? '⏳' : '📋'}
                      </button>
                    )}
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

      {/* Corrected Exam Modal */}
      <CorrectedExamModal
        view={correctedView}
        result={correctedView ? results[correctedView.inst?.id] : null}
        blueprint={blueprint}
        teacher={teacher}
        onClose={() => setCorrectedView(null)}
        emailSent={emailSent}
        emailLoading={emailLoading}
        onEmail={sendRepresentativeEmail}
      />
    </div>
  )
}
