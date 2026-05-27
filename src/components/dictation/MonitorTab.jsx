import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../supabase'
import { gradeColor } from '../../utils/dictationUtils'

export default function MonitorTab({ teacher }) {
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
