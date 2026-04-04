import { useState, useEffect } from 'react'
import { useFeatures } from '../context/FeaturesContext'
import { supabase } from '../supabase'
import { canManage } from '../utils/roles'
import { useToast } from '../context/ToastContext'

export default function MessagesPage({ teacher }) {
  const { features } = useFeatures()
  const { showToast } = useToast()
  if (features.messages === false) return (
    <div className="planner-wrap">
      <div className="card">
        <div className="empty-state">
          <div style={{ fontSize: '48px' }}>🔒</div>
          <p>Los mensajes están desactivados para este colegio.</p>
        </div>
      </div>
    </div>
  )
  const [messages,    setMessages]    = useState([])
  const [teachers,    setTeachers]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [showCompose, setShowCompose] = useState(false)
  const [selected,    setSelected]    = useState(null)
  const [form,        setForm]        = useState({ to_id: '', subject: '', body: '' })
  const [sending,     setSending]     = useState(false)
  const [tab,         setTab]         = useState('inbox') // inbox | sent

  useEffect(() => { fetchMessages(); fetchTeachers() }, [teacher.id])

  async function fetchMessages() {
    setLoading(true)
    const { data } = await supabase
      .from('messages')
      .select('*, from:from_id(full_name, initials), to:to_id(full_name, initials)')
      .eq('school_id', teacher.school_id)
      .or(`from_id.eq.${teacher.id},to_id.eq.${teacher.id}`)
      .order('created_at', { ascending: false })
    setMessages(data || [])
    setLoading(false)
  }

  async function fetchTeachers() {
    const { data } = await supabase
      .from('teachers')
      .select('id, full_name, initials, role')
      .eq('school_id', teacher.school_id)
      .neq('id', teacher.id)
    setTeachers(data || [])
  }

  async function sendMessage() {
    if (!form.to_id || !form.body.trim()) return
    setSending(true)
    const { error } = await supabase.from('messages').insert({
      school_id: teacher.school_id,
      from_id:   teacher.id,
      to_id:     form.to_id,
      subject:   form.subject.trim() || 'Sin asunto',
      body:      form.body.trim(),
      read:      false,
    })
    if (error) { showToast('Error al enviar el mensaje', 'error'); setSending(false); return }
    setForm({ to_id: '', subject: '', body: '' })
    setShowCompose(false)
    await fetchMessages()
    setSending(false)
    setTab('sent')
  }

  async function markRead(msg) {
    if (!msg.read && msg.to_id === teacher.id) {
      await supabase.from('messages').update({ read: true }).eq('id', msg.id)
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read: true } : m))
    }
    setSelected(msg)
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    })
  }

  const inbox = messages.filter(m => m.to_id === teacher.id)
  const sent  = messages.filter(m => m.from_id === teacher.id)
  const list  = tab === 'inbox' ? inbox : sent
  const unreadCount = inbox.filter(m => !m.read).length

  return (
    <div className="planner-wrap">
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{
          background: '#1F3864', color: '#fff',
          padding: '14px 20px', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontWeight: 700, fontSize: '15px' }}>
            ✉️ Mensajes
            {unreadCount > 0 && (
              <span style={{
                marginLeft: '8px', background: '#C0504D', color: '#fff',
                fontSize: '11px', fontWeight: 700, padding: '2px 7px',
                borderRadius: '10px',
              }}>{unreadCount}</span>
            )}
          </div>
          <button
            onClick={() => { setShowCompose(true); setSelected(null) }}
            style={{
              background: '#4BACC6', color: '#fff', border: 'none',
              padding: '6px 14px', borderRadius: '6px', fontSize: '12px',
              fontWeight: 700, cursor: 'pointer',
            }}>
            ✏️ Redactar
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
          {[
            { key: 'inbox', label: `📥 Recibidos (${inbox.length})` },
            { key: 'sent',  label: `📤 Enviados (${sent.length})` },
          ].map(t => (
            <button key={t.key}
              onClick={() => { setTab(t.key); setSelected(null); setShowCompose(false) }}
              style={{
                flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
                background: tab === t.key ? '#f0f4ff' : '#fff',
                color: tab === t.key ? '#2E5598' : '#666',
                fontWeight: tab === t.key ? 700 : 400,
                fontSize: '13px',
                borderBottom: tab === t.key ? '2px solid #2E5598' : '2px solid transparent',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', minHeight: '400px' }}>
          {/* List */}
          <div style={{
            width: selected || showCompose ? '40%' : '100%',
            borderRight: selected || showCompose ? '1px solid #eee' : 'none',
            overflowY: 'auto', maxHeight: '560px',
          }}>
            {loading && (
              <div style={{ padding: '30px', textAlign: 'center' }}>
                <div className="loading-spinner" />
              </div>
            )}
            {!loading && list.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: '#aaa' }}>
                <div style={{ fontSize: '36px', marginBottom: '8px' }}>✉️</div>
                <p style={{ fontSize: '13px' }}>
                  {tab === 'inbox' ? 'No hay mensajes recibidos.' : 'No hay mensajes enviados.'}
                </p>
              </div>
            )}
            {list.map(m => {
              const other = tab === 'inbox' ? m.from : m.to
              const isUnread = !m.read && m.to_id === teacher.id
              return (
                <div key={m.id}
                  onClick={() => markRead(m)}
                  style={{
                    padding: '12px 16px', cursor: 'pointer',
                    background: selected?.id === m.id ? '#f0f4ff' : isUnread ? '#fffbf0' : '#fff',
                    borderBottom: '1px solid #f0f0f0',
                    display: 'flex', gap: '10px', alignItems: 'flex-start',
                  }}>
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                    background: tab === 'inbox' ? '#F79646' : '#2E5598',
                    color: '#fff', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '12px', fontWeight: 700,
                  }}>
                    {other?.initials || other?.full_name?.slice(0,2).toUpperCase() || '??'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: isUnread ? 700 : 500, color: '#222' }}>
                        {other?.full_name || 'Desconocido'}
                      </span>
                      <span style={{ fontSize: '10px', color: '#999', flexShrink: 0 }}>
                        {formatDate(m.created_at)}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#555', fontWeight: isUnread ? 600 : 400 }}>
                      {m.subject}
                    </div>
                    <div style={{
                      fontSize: '11px', color: '#999',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {m.body}
                    </div>
                  </div>
                  {isUnread && (
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: '#F79646', flexShrink: 0, marginTop: '4px',
                    }} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Detail / Compose */}
          {(selected || showCompose) && (
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
              {showCompose && (
                <>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#2E5598', marginBottom: '14px' }}>
                    ✏️ Nuevo mensaje
                  </div>
                  <div className="ge-field" style={{ marginBottom: '10px' }}>
                    <label>Para</label>
                    <select value={form.to_id} onChange={e => setForm(f => ({ ...f, to_id: e.target.value }))}>
                      <option value="">— Seleccionar destinatario —</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.full_name} {canManage(t.role) ? '(Admin)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="ge-field" style={{ marginBottom: '10px' }}>
                    <label>Asunto</label>
                    <input type="text" value={form.subject}
                      onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                      placeholder="Asunto del mensaje" />
                  </div>
                  <div className="ge-field" style={{ marginBottom: '12px' }}>
                    <label>Mensaje</label>
                    <textarea rows={6} value={form.body}
                      onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                      placeholder="Escribe tu mensaje aquí…"
                      style={{ fontSize: '13px', resize: 'vertical' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="btn-secondary"
                      onClick={() => { setShowCompose(false) }}>
                      Cancelar
                    </button>
                    <button className="btn-primary btn-save"
                      disabled={sending || !form.to_id || !form.body.trim()}
                      onClick={sendMessage}>
                      {sending ? '⏳ Enviando…' : '📤 Enviar'}
                    </button>
                  </div>
                </>
              )}

              {selected && !showCompose && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <button className="btn-secondary" style={{ fontSize: '12px' }}
                      onClick={() => setSelected(null)}>
                      ← Volver
                    </button>
                    <button className="btn-primary" style={{ fontSize: '12px' }}
                      onClick={() => {
                        const other = tab === 'inbox' ? selected.from : selected.to
                        setForm({ to_id: other ? (tab === 'inbox' ? selected.from_id : selected.to_id) : '', subject: `Re: ${selected.subject}`, body: '' })
                        setShowCompose(true)
                        setSelected(null)
                      }}>
                      ↩️ Responder
                    </button>
                  </div>
                  <div style={{ background: '#f8faff', borderRadius: '10px', padding: '16px' }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#1F3864', marginBottom: '6px' }}>
                      {selected.subject}
                    </div>
                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '14px' }}>
                      De: <strong>{selected.from?.full_name}</strong> →
                      Para: <strong>{selected.to?.full_name}</strong> ·
                      {formatDate(selected.created_at)}
                    </div>
                    <div style={{ fontSize: '14px', color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {selected.body}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
