// ── SessionControlPage.jsx ────────────────────────────────────────────────────
// /dictations/session/:sessionId — Sala de Control de Dictados en vivo.
// Docente: link compartible · monitor RT · advertencias · force-close · resultados

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { gradeColor, SECTION_META } from '../utils/dictationUtils'
import WarningModal from '../components/dictation/WarningModal'
import DictationPreview from '../components/dictation/DictationPreview'

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_ICON = {
  ready:       { icon: '⚪', label: 'Sin iniciar', color: '#9CA3AF' },
  started:     { icon: '🔵', label: 'En progreso', color: '#2563EB' },
  submitted:   { icon: '✅', label: 'Entregado',   color: '#15803D' },
  force_closed:{ icon: '🔴', label: 'Cerrado',     color: '#DC2626' },
}

const STUDENT_URL = `${window.location.origin}${import.meta.env.BASE_URL}#/eval/dictation`

function fmt(s) {
  if (s == null) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function SessionControlPage({ teacher }) {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  // ── Session data ──
  const [session, setSession]     = useState(null)
  const [blueprint, setBlueprint] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  // ── Students RT ──
  const [instances, setInstances] = useState([])
  const [results, setResults]     = useState({})
  const channelRef = useRef(null)

  // ── Broadcast control channel ──
  const ctrlChannelRef = useRef(null)

  // ── UI state ──
  const [selectedId, setSelectedId]   = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [copied, setCopied]           = useState(false)
  const [warningTarget, setWarningTarget] = useState(null) // { instanceId, studentName } | 'all'
  const [confirmClose, setConfirmClose]   = useState(null) // instance | null
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMsg, setActionMsg]         = useState(null)

  // ── Load session + blueprint ──────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: ses, error: sesErr } = await supabase
        .from('dictation_sessions')
        .select('id, title, access_code, status, duration_minutes, blueprint_id, teacher_id, school_id')
        .eq('id', sessionId)
        .single()

      if (sesErr || !ses) {
        setError('Sesión no encontrada.')
        setLoading(false)
        return
      }

      setSession(ses)

      // Load blueprint
      const { data: bp } = await supabase
        .from('dictation_blueprints')
        .select('id, title, subject, grade, section, difficulty, vocabulary, sections, audio_urls')
        .eq('id', ses.blueprint_id)
        .single()

      setBlueprint(bp)
      setLoading(false)
    }
    load()
  }, [sessionId])

  // ── Load instances + Realtime ─────────────────────────────────────────────

  useEffect(() => {
    if (!sessionId) return
    loadInstances()

    const channel = supabase
      .channel(`ctrl-instances-${sessionId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'dictation_instances',
        filter: `session_id=eq.${sessionId}`,
      }, () => loadInstances())
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'dictation_results',
      }, () => loadInstances())
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  async function loadInstances() {
    const { data } = await supabase
      .from('dictation_instances')
      .select('id, student_name, student_section, student_code, access_code, instance_status, started_at, submitted_at, time_spent_seconds, tab_switches, integrity_flags')
      .eq('session_id', sessionId)
      .order('student_name')

    setInstances(data || [])

    const ids = (data || []).filter(i => i.instance_status === 'submitted').map(i => i.id)
    if (ids.length > 0) {
      const { data: resData } = await supabase
        .from('dictation_results')
        .select('instance_id, colombian_grade, grade_level, total_score, max_score, section_scores')
        .in('instance_id', ids)
      const map = {}
      ;(resData || []).forEach(r => { map[r.instance_id] = r })
      setResults(map)
    }
  }

  // ── Broadcast control channel ─────────────────────────────────────────────

  useEffect(() => {
    if (!sessionId) return
    const channel = supabase.channel(`dictation-ctrl-${sessionId}`)
    channel.subscribe()
    ctrlChannelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  // ── Actions ───────────────────────────────────────────────────────────────

  async function sendWarning({ message, severity }) {
    const ch = ctrlChannelRef.current
    if (!ch) return
    const payload = warningTarget === 'all'
      ? { instanceId: null, message, severity }
      : { instanceId: warningTarget.instanceId, message, severity }

    await ch.send({ type: 'broadcast', event: 'teacher_warning', payload })
    showAction('⚠️ Advertencia enviada')
  }

  async function handleForceClose(inst) {
    setActionLoading(true)
    const ch = ctrlChannelRef.current

    // Broadcast first (immediate)
    if (ch) {
      await ch.send({ type: 'broadcast', event: 'force_close', payload: { instanceId: inst.id } })
    }

    // Update DB (persistent)
    await supabase
      .from('dictation_instances')
      .update({ instance_status: 'force_closed' })
      .eq('id', inst.id)

    setActionLoading(false)
    setConfirmClose(null)
    showAction('🔒 Examen cerrado')
    loadInstances()
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(STUDENT_URL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  function showAction(msg) {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(null), 3000)
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const selectedInst = instances.find(i => i.id === selectedId) || null
  const selectedResult = selectedInst ? results[selectedInst.id] : null

  const stats = {
    total:       instances.length,
    ready:       instances.filter(i => i.instance_status === 'ready').length,
    started:     instances.filter(i => i.instance_status === 'started').length,
    submitted:   instances.filter(i => i.instance_status === 'submitted').length,
    forceClosed: instances.filter(i => i.instance_status === 'force_closed').length,
    avgGrade:    (() => {
      const grades = instances.map(i => results[i.id]?.colombian_grade).filter(Boolean).map(Number)
      return grades.length ? (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(1) : null
    })(),
  }

  const blueprintSections = blueprint?.sections
    ? Object.values(blueprint.sections).flat()
    : []

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="ctrl-loading">
        <div className="ctrl-spinner">📡</div>
        <p>Cargando sala de control...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ctrl-error">
        <p>❌ {error}</p>
        <button onClick={() => navigate('/dictations')}>← Volver</button>
      </div>
    )
  }

  return (
    <div className="ctrl-root">
      {/* ── Top bar ── */}
      <div className="ctrl-topbar">
        <button className="ctrl-back" onClick={() => navigate('/dictations')}>← Dictados</button>
        <div className="ctrl-topbar-title">
          <span className="ctrl-topbar-icon">🎛️</span>
          <span>{session?.title || 'Sala de Control'}</span>
          <span className={`ctrl-session-badge ${session?.status}`}>{session?.status}</span>
        </div>
        <div className="ctrl-topbar-right">
          <span className="ctrl-live-dot">📡 En vivo</span>
          {actionMsg && <span className="ctrl-action-msg">{actionMsg}</span>}
        </div>
      </div>

      {/* ── 3-panel layout ── */}
      <div className="ctrl-layout">

        {/* ── LEFT PANEL ── */}
        <div className="ctrl-panel ctrl-panel-left">

          {/* Link compartible */}
          <div className="ctrl-section">
            <h4 className="ctrl-section-title">🔗 Link del estudiante</h4>
            <div className="ctrl-link-box">
              <span className="ctrl-link-url">{STUDENT_URL}</span>
              <button className={`ctrl-copy-btn ${copied ? 'copied' : ''}`} onClick={copyLink}>
                {copied ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
            <p className="ctrl-link-note">
              Los estudiantes ingresan con su <strong>código individual</strong> (generado al crear la sesión).
            </p>
          </div>

          {/* Preview toggle */}
          <div className="ctrl-section">
            <button
              className={`ctrl-preview-toggle ${showPreview ? 'active' : ''}`}
              onClick={() => setShowPreview(v => !v)}
            >
              {showPreview ? '🙈 Ocultar vista previa' : '👁 Ver examen (modo docente)'}
            </button>
            {showPreview && (
              <div className="ctrl-preview-container">
                <DictationPreview blueprint={blueprint} sections={blueprintSections} />
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="ctrl-section">
            <h4 className="ctrl-section-title">📊 Resumen</h4>
            <div className="ctrl-stats">
              <div className="ctrl-stat"><span className="ctrl-stat-n">{stats.total}</span><span>Total</span></div>
              <div className="ctrl-stat"><span className="ctrl-stat-n" style={{ color: '#9CA3AF' }}>{stats.ready}</span><span>En espera</span></div>
              <div className="ctrl-stat"><span className="ctrl-stat-n" style={{ color: '#2563EB' }}>{stats.started}</span><span>En progreso</span></div>
              <div className="ctrl-stat"><span className="ctrl-stat-n" style={{ color: '#15803D' }}>{stats.submitted}</span><span>Entregados</span></div>
              {stats.forceClosed > 0 && (
                <div className="ctrl-stat"><span className="ctrl-stat-n" style={{ color: '#DC2626' }}>{stats.forceClosed}</span><span>Cerrados</span></div>
              )}
              {stats.avgGrade && (
                <div className="ctrl-stat ctrl-stat-grade">
                  <span className="ctrl-stat-n" style={{ color: gradeColor(parseFloat(stats.avgGrade)) }}>
                    {stats.avgGrade}
                  </span>
                  <span>Prom. nota</span>
                </div>
              )}
            </div>

            {/* Warn all */}
            <button
              className="ctrl-warn-all-btn"
              onClick={() => setWarningTarget('all')}
            >
              ⚠️ Enviar advertencia a todos
            </button>
          </div>
        </div>

        {/* ── CENTER PANEL — Student table ── */}
        <div className="ctrl-panel ctrl-panel-center">
          <div className="ctrl-center-header">
            <h4>👥 Estudiantes</h4>
            <span className="ctrl-center-hint">Click en una fila para ver detalles</span>
          </div>

          {instances.length === 0 ? (
            <div className="ctrl-empty">
              <p>⚡ Esperando que los estudiantes ingresen...</p>
              <p className="ctrl-empty-sub">Las filas aparecerán en tiempo real cuando usen su código.</p>
            </div>
          ) : (
            <table className="ctrl-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Nombre</th>
                  <th>Sección</th>
                  <th>Entrada</th>
                  <th>Entrega</th>
                  <th>Trampas</th>
                  <th>Tiempo</th>
                  <th>Nota</th>
                  <th>Nivel</th>
                </tr>
              </thead>
              <tbody>
                {instances.map(inst => {
                  const st = STATUS_ICON[inst.instance_status] || STATUS_ICON.ready
                  const res = results[inst.id]
                  const isSelected = inst.id === selectedId
                  return (
                    <tr
                      key={inst.id}
                      className={`ctrl-row ${inst.instance_status} ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedId(isSelected ? null : inst.id)}
                    >
                      <td title={st.label}>
                        <span style={{ fontSize: '1.1rem' }}>{st.icon}</span>
                      </td>
                      <td className="ctrl-td-name">{inst.student_name || '—'}</td>
                      <td>{inst.student_section || '—'}</td>
                      <td>{fmtTime(inst.started_at)}</td>
                      <td>{fmtTime(inst.submitted_at)}</td>
                      <td>
                        {inst.tab_switches > 0 ? (
                          <span className="ctrl-violations-badge">{inst.tab_switches}</span>
                        ) : (
                          <span style={{ color: '#9CA3AF' }}>0</span>
                        )}
                      </td>
                      <td>{inst.time_spent_seconds ? fmt(inst.time_spent_seconds) : '—'}</td>
                      <td style={{ fontWeight: 700, color: res ? gradeColor(parseFloat(res.colombian_grade)) : '#9CA3AF' }}>
                        {res ? `${res.colombian_grade}/5.0` : '—'}
                      </td>
                      <td>{res?.grade_level || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── RIGHT PANEL — Student detail ── */}
        <div className="ctrl-panel ctrl-panel-right">
          {!selectedInst ? (
            <div className="ctrl-detail-empty">
              <span>👆</span>
              <p>Selecciona un estudiante para ver detalles y acciones</p>
            </div>
          ) : (
            <div className="ctrl-detail">
              {/* Student header */}
              <div className="ctrl-detail-header">
                <div className="ctrl-detail-status" title={STATUS_ICON[selectedInst.instance_status]?.label}>
                  {STATUS_ICON[selectedInst.instance_status]?.icon}
                </div>
                <div>
                  <h3 className="ctrl-detail-name">{selectedInst.student_name}</h3>
                  <p className="ctrl-detail-meta">{selectedInst.student_section} · Código: {selectedInst.student_code || '—'}</p>
                </div>
              </div>

              {/* Quick stats */}
              <div className="ctrl-detail-stats">
                <div className="ctrl-ds"><label>Entrada</label><span>{fmtTime(selectedInst.started_at)}</span></div>
                <div className="ctrl-ds"><label>Entrega</label><span>{fmtTime(selectedInst.submitted_at)}</span></div>
                <div className="ctrl-ds"><label>Tiempo</label><span>{selectedInst.time_spent_seconds ? fmt(selectedInst.time_spent_seconds) : '—'}</span></div>
                <div className="ctrl-ds"><label>Violaciones</label>
                  <span style={{ color: selectedInst.tab_switches > 0 ? '#DC2626' : '#15803D', fontWeight: 700 }}>
                    {selectedInst.tab_switches || 0}
                  </span>
                </div>
              </div>

              {/* Violation timeline */}
              {selectedInst.integrity_flags?.events?.length > 0 && (
                <div className="ctrl-timeline">
                  <h5>📋 Timeline de violaciones</h5>
                  <div className="ctrl-timeline-list">
                    {selectedInst.integrity_flags.events.map((ev, i) => (
                      <div key={i} className="ctrl-timeline-item">
                        <span className="ctrl-timeline-ts">
                          {new Date(ev.ts).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="ctrl-timeline-type">{ev.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Result summary (if submitted) */}
              {selectedResult && (
                <div className="ctrl-result-summary">
                  <h5>📊 Resultado</h5>
                  <div className="ctrl-result-grade" style={{ color: gradeColor(parseFloat(selectedResult.colombian_grade)) }}>
                    {selectedResult.colombian_grade}/5.0 — {selectedResult.grade_level}
                  </div>
                  <p className="ctrl-result-score">
                    {selectedResult.total_score}/{selectedResult.max_score} puntos
                  </p>
                  {selectedResult.section_scores && (
                    <div className="ctrl-result-sections">
                      {Object.entries(selectedResult.section_scores).map(([type, s]) => {
                        const meta = SECTION_META[type] || {}
                        return (
                          <div key={type} className="ctrl-result-sec" style={{ borderLeftColor: meta.color || '#888' }}>
                            <span>{meta.icon} {meta.label || type}</span>
                            <span>{s.correct}/{s.total} · {s.score}/{s.max} pts</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="ctrl-actions">
                {/* Warn — only for active students */}
                {(selectedInst.instance_status === 'started' || selectedInst.instance_status === 'ready') && (
                  <button
                    className="ctrl-action-btn ctrl-action-warn"
                    onClick={() => setWarningTarget({ instanceId: selectedInst.id, studentName: selectedInst.student_name })}
                  >
                    ⚠️ Enviar advertencia
                  </button>
                )}

                {/* Force close — only for active */}
                {selectedInst.instance_status === 'started' && (
                  <button
                    className="ctrl-action-btn ctrl-action-close"
                    onClick={() => setConfirmClose(selectedInst)}
                    disabled={actionLoading}
                  >
                    🔒 Cerrar examen remotamente
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Warning Modal ── */}
      {warningTarget && (
        <WarningModal
          studentName={warningTarget === 'all' ? 'todos los estudiantes' : warningTarget.studentName}
          onSend={sendWarning}
          onClose={() => setWarningTarget(null)}
        />
      )}

      {/* ── Confirm force-close ── */}
      {confirmClose && (
        <div className="ctrl-modal-overlay" onClick={() => setConfirmClose(null)}>
          <div className="ctrl-confirm-modal" onClick={e => e.stopPropagation()}>
            <h3>🔒 Cerrar examen</h3>
            <p>
              ¿Confirmas que deseas cerrar el examen de <strong>{confirmClose.student_name}</strong>?
            </p>
            <p className="ctrl-confirm-note">
              El estudiante verá una pantalla de "Examen cerrado" y no podrá continuar.
            </p>
            <div className="ctrl-confirm-actions">
              <button className="dict-btn-secondary" onClick={() => setConfirmClose(null)}>Cancelar</button>
              <button
                className="ctrl-confirm-danger"
                onClick={() => handleForceClose(confirmClose)}
                disabled={actionLoading}
              >
                {actionLoading ? 'Cerrando...' : '🔒 Confirmar cierre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
