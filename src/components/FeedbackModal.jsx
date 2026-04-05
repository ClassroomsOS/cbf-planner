import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { roleLabel, ROLE_STYLES } from '../utils/roles'

// ── FeedbackModal ─────────────────────────────────────────────────────────────
// Shared feedback panel for rector and coordinator to leave observations on
// any document type: 'guide' | 'news' | 'agenda'.
// Requires the `document_feedback` table in Supabase.
//
// SQL migration:
//   CREATE TABLE IF NOT EXISTS document_feedback (
//     id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//     school_id uuid NOT NULL REFERENCES schools(id),
//     entity_type text NOT NULL CHECK (entity_type IN ('guide','news','agenda')),
//     entity_id uuid NOT NULL,
//     entity_title text,
//     author_id uuid NOT NULL REFERENCES teachers(id),
//     body text NOT NULL,
//     resolved boolean DEFAULT false,
//     created_at timestamptz DEFAULT now()
//   );
//   ALTER TABLE document_feedback ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "School members can read feedback" ON document_feedback
//     FOR SELECT USING (school_id = (SELECT school_id FROM teachers WHERE id = auth.uid()));
//   CREATE POLICY "Feedback authors can insert" ON document_feedback
//     FOR INSERT WITH CHECK (author_id = auth.uid());
//   CREATE POLICY "Author can toggle resolved" ON document_feedback
//     FOR UPDATE USING (author_id = auth.uid());

const TYPE_LABELS = { guide: 'Guía', news: 'Proyecto NEWS', agenda: 'Agenda' }

export default function FeedbackModal({ entityType, entityId, entityTitle, teacher, onClose }) {
  const { showToast } = useToast()
  const [feedback, setFeedback] = useState([])
  const [body,     setBody]     = useState('')
  const [loading,  setLoading]  = useState(true)
  const [sending,  setSending]  = useState(false)

  useEffect(() => { loadFeedback() }, [entityId])

  async function loadFeedback() {
    setLoading(true)
    const { data } = await supabase
      .from('document_feedback')
      .select('*, author:author_id(full_name, initials, role)')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
    setFeedback(data || [])
    setLoading(false)
  }

  async function handleSend() {
    if (!body.trim()) return
    setSending(true)
    const { error } = await supabase.from('document_feedback').insert({
      school_id:    teacher.school_id,
      entity_type:  entityType,
      entity_id:    entityId,
      entity_title: entityTitle,
      author_id:    teacher.id,
      body:         body.trim(),
    })
    setSending(false)
    if (error) { showToast('Error al enviar feedback', 'error'); return }
    setBody('')
    await loadFeedback()
    showToast('Feedback enviado', 'success')
  }

  async function toggleResolved(fb) {
    const { error } = await supabase.from('document_feedback')
      .update({ resolved: !fb.resolved }).eq('id', fb.id)
    if (!error) setFeedback(prev => prev.map(f => f.id === fb.id ? { ...f, resolved: !fb.resolved } : f))
  }

  const openCount = feedback.filter(f => !f.resolved).length

  const modal = (
    <div className="sb-modal-overlay">
      <div className="sb-modal" style={{ maxWidth: '560px' }}>

        {/* Header */}
        <div className="sb-modal-header" style={{ background: 'linear-gradient(135deg,#1F3864,#2E5598)' }}>
          <div>
            <h2 style={{ margin: 0 }}>
              💬 Feedback — {TYPE_LABELS[entityType] || entityType}
            </h2>
            <div style={{ fontSize: '12px', opacity: .8, marginTop: '3px' }}>{entityTitle}</div>
          </div>
          <button onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="sb-modal-body">

          {/* New feedback input */}
          <div className="form-field" style={{ marginBottom: '14px' }}>
            <label>Nuevo comentario u observación</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={3}
              placeholder="Escribe tu observación, sugerencia o corrección…"
              style={{ fontSize: '12px', resize: 'vertical' }}
            />
          </div>
          <button className="btn-primary" style={{ fontSize: '12px', marginBottom: '20px' }}
            onClick={handleSend} disabled={sending || !body.trim()}>
            {sending ? '⏳ Enviando…' : '💬 Enviar feedback'}
          </button>

          {/* Divider + history */}
          <div style={{
            fontSize: '11px', fontWeight: 700, color: '#888',
            textTransform: 'uppercase', letterSpacing: '.5px',
            marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            Historial
            {openCount > 0 && (
              <span style={{
                background: '#C0504D', color: '#fff',
                borderRadius: '10px', padding: '1px 7px', fontSize: '10px', fontWeight: 800,
              }}>{openCount} pendiente{openCount !== 1 ? 's' : ''}</span>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#aaa', fontSize: '12px' }}>
              Cargando…
            </div>
          ) : feedback.length === 0 ? (
            <div style={{ padding: '16px 0', color: '#bbb', fontSize: '12px', textAlign: 'center' }}>
              Sin feedback previo para este documento
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {feedback.map(fb => {
                const roleStyle = ROLE_STYLES[fb.author?.role] || ROLE_STYLES.teacher
                const ini = fb.author?.initials ||
                  (fb.author?.full_name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                return (
                  <div key={fb.id} style={{
                    padding: '10px 12px', borderRadius: '8px',
                    background: fb.resolved ? '#f9f9f9' : '#f0f4ff',
                    border: `1px solid ${fb.resolved ? '#e0e0e0' : '#bfcfff'}`,
                    opacity: fb.resolved ? 0.6 : 1,
                    transition: 'opacity .2s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: roleStyle.bg, color: roleStyle.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', fontWeight: 800, border: `1.5px solid ${roleStyle.color}40`,
                        flexShrink: 0,
                      }}>{ini}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '11px', color: '#333' }}>
                          {fb.author?.full_name || '—'}
                        </div>
                        <div style={{ fontSize: '10px', color: '#aaa' }}>
                          {roleLabel(fb.author?.role || 'teacher')}
                        </div>
                      </div>
                      <div style={{ marginLeft: 'auto', fontSize: '10px', color: '#bbb', textAlign: 'right' }}>
                        {new Date(fb.created_at).toLocaleDateString('es-CO', {
                          day: '2-digit', month: 'short',
                        })}<br />
                        {new Date(fb.created_at).toLocaleTimeString('es-CO', {
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </div>
                    </div>
                    <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#333', lineHeight: 1.55 }}>
                      {fb.body}
                    </p>
                    <button
                      onClick={() => toggleResolved(fb)}
                      style={{
                        fontSize: '10px', background: 'none',
                        border: `1px solid ${fb.resolved ? '#ccc' : '#2E5598'}`,
                        borderRadius: '4px', padding: '2px 8px', cursor: 'pointer',
                        color: fb.resolved ? '#aaa' : '#2E5598', fontWeight: 600,
                      }}>
                      {fb.resolved ? '↩ Reabrir' : '✓ Marcar resuelto'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
