import { useState, useEffect, useCallback, memo } from 'react'
import { supabase } from '../supabase'
import { useFocusTrap } from '../hooks/useFocusTrap'

const SECTION_LABELS = {
  subject: 'Subject to be Worked', motivation: 'Motivation',
  activity: 'Activity', skill: 'Skill Development',
  closing: 'Closing', assignment: 'Assignment',
}

const SECTION_COLORS = {
  subject: '#4F81BD', motivation: '#4BACC6', activity: '#F79646',
  skill: '#8064A2', closing: '#9BBB59', assignment: '#4E84A2',
}

const CorrectionRequestModal = memo(function CorrectionRequestModal({ planId, teacher, onClose }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ section_key: 'subject', day_iso: '', body: '' })
  const [activeDays, setActiveDays] = useState([])

  const modalRef = useFocusTrap(true, onClose)

  const fetchPlanDays = useCallback(async () => {
    const { data } = await supabase
      .from('lesson_plans').select('content, monday_date')
      .eq('id', planId).single()
    if (data?.content?.days) {
      const days = Object.keys(data.content.days).sort()
      setActiveDays(days)
      if (days.length > 0) setForm(f => ({ ...f, day_iso: days[0] }))
    }
  }, [planId])

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('correction_requests')
      .select('*, author:author_id(full_name, initials, role)')
      .eq('plan_id', planId)
      .order('created_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }, [planId])

  useEffect(() => {
    fetchRequests()
    fetchPlanDays()
  }, [fetchRequests, fetchPlanDays])

  const sendRequest = useCallback(async () => {
    if (!form.body.trim() || !form.day_iso) return
    setSending(true)
    await supabase.from('correction_requests').insert({
      plan_id:     planId,
      author_id:   teacher.id,
      school_id:   teacher.school_id,
      section_key: form.section_key,
      day_iso:     form.day_iso,
      body:        form.body.trim(),
      status:      'pending',
    })
    setForm(f => ({ ...f, body: '' }))
    setShowForm(false)
    await fetchRequests()
    setSending(false)
  }, [form, planId, teacher.id, teacher.school_id, fetchRequests])

  const updateStatus = useCallback(async (id, status) => {
    await supabase.from('correction_requests').update({ status }).eq('id', id)
    await fetchRequests()
  }, [fetchRequests])

  const formatDate = useCallback((ts) => {
    return new Date(ts).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    })
  }, [])

  const formatDayISO = useCallback((iso) => {
    if (!iso) return ''
    const d = new Date(iso + 'T12:00:00')
    const days = ['Lunes','Martes','Miércoles','Jueves','Viernes']
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    return `${days[d.getDay()-1]} ${d.getDate()} ${months[d.getMonth()]}`
  }, [])

  const statusConfig = {
    pending:  { label: 'Pendiente', color: '#F79646', bg: '#fff9f0' },
    resolved: { label: 'Resuelto',  color: '#9BBB59', bg: '#f8fff4' },
    rejected: { label: 'Rechazado', color: '#C0504D', bg: '#fff4f4' },
  }

  return (
    <div className="sb-modal-overlay">
      <div ref={modalRef} className="sb-modal" style={{ maxWidth: '640px' }}>
        <div className="sb-modal-header">
          <h2>🔧 Solicitudes de corrección</h2>
          <button onClick={onClose} aria-label="Cerrar solicitudes de corrección">✕</button>
        </div>

        <div className="sb-modal-body">
          {/* New request button */}
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary btn-save"
              style={{ width: '100%', marginBottom: '16px', fontSize: '13px' }}>
              + Nueva solicitud de corrección
            </button>
          )}

          {/* Form */}
          {showForm && (
            <div style={{
              background: '#f0f4ff', border: '1px solid #c5d5f0',
              borderRadius: '10px', padding: '14px', marginBottom: '16px',
            }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#2E5598', marginBottom: '10px' }}>
                Nueva solicitud
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div className="ge-field">
                  <label>Día</label>
                  <select value={form.day_iso} onChange={e => setForm(f => ({ ...f, day_iso: e.target.value }))}>
                    {activeDays.map(iso => (
                      <option key={iso} value={iso}>{formatDayISO(iso)}</option>
                    ))}
                  </select>
                </div>
                <div className="ge-field">
                  <label>Sección</label>
                  <select value={form.section_key} onChange={e => setForm(f => ({ ...f, section_key: e.target.value }))}>
                    {Object.entries(SECTION_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="ge-field">
                <label>Descripción de la corrección</label>
                <textarea rows={3}
                  value={form.body}
                  onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                  placeholder="Describe qué debe corregirse en esta sección…"
                  style={{ fontSize: '13px', resize: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                <button className="btn-primary btn-save"
                  disabled={sending || !form.body.trim()}
                  onClick={sendRequest}>
                  {sending ? '⏳ Enviando…' : '📤 Enviar solicitud'}
                </button>
              </div>
            </div>
          )}

          {/* Requests list */}
          {loading && <div style={{ textAlign: 'center', padding: '20px' }}><div className="loading-spinner" /></div>}

          {!loading && requests.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px', color: '#aaa' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔧</div>
              <p style={{ fontSize: '13px' }}>No hay solicitudes de corrección.</p>
            </div>
          )}

          {requests.map(r => {
            const st = statusConfig[r.status] || statusConfig.pending
            const sColor = SECTION_COLORS[r.section_key] || '#4F81BD'
            return (
              <div key={r.id} style={{
                background: st.bg, border: `1px solid ${st.color}40`,
                borderLeft: `3px solid ${sColor}`,
                borderRadius: '8px', padding: '12px 14px', marginBottom: '10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, background: sColor + '22',
                        color: sColor, padding: '2px 8px', borderRadius: '10px',
                      }}>
                        {SECTION_LABELS[r.section_key]}
                      </span>
                      <span style={{ fontSize: '11px', color: '#888' }}>
                        {formatDayISO(r.day_iso)}
                      </span>
                      <span style={{
                        fontSize: '11px', fontWeight: 700, background: st.bg,
                        color: st.color, border: `1px solid ${st.color}`,
                        padding: '1px 8px', borderRadius: '10px', marginLeft: 'auto',
                      }}>
                        {st.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#444', lineHeight: 1.5, marginBottom: '6px' }}>
                      {r.body}
                    </div>
                    <div style={{ fontSize: '11px', color: '#999' }}>
                      {r.author?.full_name} · {formatDate(r.created_at)}
                    </div>
                  </div>
                </div>
                {r.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    <button
                      onClick={() => updateStatus(r.id, 'resolved')}
                      style={{
                        fontSize: '11px', padding: '3px 10px', borderRadius: '6px',
                        background: '#9BBB59', color: '#fff', border: 'none', cursor: 'pointer',
                      }}>
                      ✅ Marcar resuelto
                    </button>
                    {teacher.role === 'admin' && (
                      <button
                        onClick={() => updateStatus(r.id, 'rejected')}
                        style={{
                          fontSize: '11px', padding: '3px 10px', borderRadius: '6px',
                          background: '#C0504D', color: '#fff', border: 'none', cursor: 'pointer',
                        }}>
                        ❌ Rechazar
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="sb-modal-footer">
          <div style={{ flex: 1 }} />
          <button className="btn-primary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
})

export default CorrectionRequestModal
