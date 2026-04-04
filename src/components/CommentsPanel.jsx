import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { canManage, roleLabel } from '../utils/roles'

export default function CommentsPanel({ planId, teacher, onClose }) {
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => { fetchComments() }, [planId])

  async function fetchComments() {
    setLoading(true)
    const { data } = await supabase
      .from('plan_comments')
      .select('*, author:author_id(full_name, initials, role)')
      .eq('plan_id', planId)
      .order('created_at', { ascending: true })
    setComments(data || [])
    setLoading(false)
  }

  async function sendComment() {
    if (!newComment.trim()) return
    setSending(true)
    await supabase.from('plan_comments').insert({
      plan_id:   planId,
      author_id: teacher.id,
      school_id: teacher.school_id,
      body:      newComment.trim(),
    })
    setNewComment('')
    await fetchComments()
    setSending(false)
  }

  async function toggleResolved(comment) {
    await supabase.from('plan_comments')
      .update({ resolved: !comment.resolved })
      .eq('id', comment.id)
    await fetchComments()
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: '340px',
      background: '#fff', boxShadow: '-4px 0 20px rgba(0,0,0,0.12)',
      display: 'flex', flexDirection: 'column', zIndex: 1000,
    }}>
      {/* Header */}
      <div style={{
        background: '#1F3864', color: '#fff', padding: '14px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 700, fontSize: '14px' }}>
          💬 Comentarios ({comments.length})
        </span>
        <button onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer' }}>
          ✕
        </button>
      </div>

      {/* Comments list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
            <div className="loading-spinner" />
          </div>
        )}
        {!loading && comments.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#aaa' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>💬</div>
            <p style={{ fontSize: '13px' }}>No hay comentarios aún.</p>
          </div>
        )}
        {comments.map(c => {
          const isMe = c.author_id === teacher.id
          const ini = c.author?.initials || c.author?.full_name?.slice(0,2).toUpperCase() || '??'
          return (
            <div key={c.id} style={{
              background: c.resolved ? '#f8fff4' : isMe ? '#f0f4ff' : '#fff9f0',
              border: `1px solid ${c.resolved ? '#9BBB59' : isMe ? '#c5d5f0' : '#fde8c8'}`,
              borderRadius: '10px', padding: '10px 12px',
              opacity: c.resolved ? 0.7 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: isMe ? '#2E5598' : '#F79646',
                  color: '#fff', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0,
                }}>
                  {ini}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#333' }}>
                    {c.author?.full_name || 'Docente'}
                    {canManage(c.author?.role) && (
                      <span style={{ marginLeft: '4px', fontSize: '10px', background: '#2E5598', color: '#fff', padding: '1px 5px', borderRadius: '8px' }}>
                        {roleLabel(c.author.role)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '10px', color: '#999' }}>{formatDate(c.created_at)}</div>
                </div>
                {(canManage(teacher.role) || c.author_id === teacher.id) && (
                  <button
                    onClick={() => toggleResolved(c)}
                    title={c.resolved ? 'Marcar pendiente' : 'Marcar resuelto'}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '14px', flexShrink: 0,
                    }}>
                    {c.resolved ? '↩️' : '✅'}
                  </button>
                )}
              </div>
              <div style={{ fontSize: '13px', color: '#444', lineHeight: 1.5, wordBreak: 'break-word' }}>
                {c.resolved && <span style={{ fontSize: '11px', color: '#9BBB59', fontWeight: 700, marginRight: '4px' }}>[Resuelto]</span>}
                {c.body}
              </div>
            </div>
          )
        })}
      </div>

      {/* Input */}
      <div style={{ padding: '12px', borderTop: '1px solid #eee', background: '#fafbff' }}>
        <textarea
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Escribe un comentario…"
          rows={3}
          style={{
            width: '100%', fontSize: '13px', padding: '8px 10px',
            border: '1px solid #dde5f0', borderRadius: '8px',
            resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && e.ctrlKey) sendComment()
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
          <span style={{ fontSize: '10px', color: '#bbb' }}>Ctrl+Enter para enviar</span>
          <button
            onClick={sendComment}
            disabled={sending || !newComment.trim()}
            style={{
              background: '#2E5598', color: '#fff', border: 'none',
              padding: '6px 14px', borderRadius: '6px', fontSize: '12px',
              cursor: 'pointer', fontWeight: 700,
              opacity: sending || !newComment.trim() ? 0.5 : 1,
            }}>
            {sending ? '⏳' : '📤 Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}
