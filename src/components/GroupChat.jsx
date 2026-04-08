// ── GroupChat.jsx ─────────────────────────────────────────────────────────────
// Salas de chat grupal para MessagesPage.
// Cada sala tiene participantes + mensajes en tiempo real via Supabase Realtime.
// Cualquier docente del colegio puede ver y unirse a todas las salas.

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'

function Avatar({ name, initials, size = 32, color = '#2E5598' }) {
  const ini = initials || (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, flexShrink: 0,
    }}>{ini}</div>
  )
}

const ROOM_COLORS = ['#2E5598','#9BBB59','#F79646','#8064A2','#C0504D','#4BACC6','#1A6B3A']
function roomColor(id) {
  let n = 0; for (const c of id || '') n += c.charCodeAt(0)
  return ROOM_COLORS[n % ROOM_COLORS.length]
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

// ── Create Room Modal ──────────────────────────────────────────────────────────
function CreateRoomModal({ teacher, allTeachers, onClose, onCreated }) {
  const { showToast } = useToast()
  const [name,    setName]    = useState('')
  const [picked,  setPicked]  = useState([teacher.id])
  const [saving,  setSaving]  = useState(false)

  function toggleTeacher(id) {
    if (id === teacher.id) return // siempre incluido
    setPicked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleCreate() {
    if (!name.trim()) { showToast('Escribe un nombre para la sala', 'error'); return }
    if (picked.length < 2) { showToast('Agrega al menos un participante más', 'error'); return }
    setSaving(true)
    const { data: room, error } = await supabase
      .from('message_rooms')
      .insert({ school_id: teacher.school_id, name: name.trim(), created_by: teacher.id })
      .select().single()
    if (error || !room) { showToast('Error al crear la sala', 'error'); setSaving(false); return }

    await supabase.from('room_participants').insert(
      picked.map(tid => ({ room_id: room.id, teacher_id: tid }))
    )
    showToast(`Sala "${room.name}" creada`, 'success')
    onCreated(room)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: 420, maxWidth: '95vw',
        boxShadow: '0 8px 32px rgba(0,0,0,.2)', overflow: 'hidden',
      }}>
        <div style={{
          background: 'linear-gradient(135deg,#1F3864,#2E5598)',
          color: '#fff', padding: '16px 20px', fontWeight: 700, fontSize: 15,
        }}>
          ➕ Nueva sala de chat
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>
              Nombre de la sala
            </label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Docentes de inglés, Grado 9°…"
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 8,
                border: '1.5px solid #D0D5DD', fontSize: 13, boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 8 }}>
              Participantes ({picked.length} seleccionados)
            </label>
            <div style={{
              border: '1px solid #E2E8F0', borderRadius: 8, maxHeight: 200,
              overflowY: 'auto', padding: '4px 0',
            }}>
              {allTeachers.map(t => {
                const isSelf = t.id === teacher.id
                const sel = picked.includes(t.id)
                return (
                  <div key={t.id}
                    onClick={() => toggleTeacher(t.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', cursor: isSelf ? 'default' : 'pointer',
                      background: sel ? '#F0F4FF' : '#fff',
                      opacity: isSelf ? .6 : 1,
                    }}>
                    <input type="checkbox" checked={sel} readOnly style={{ accentColor: '#2E5598' }} />
                    <Avatar name={t.full_name} initials={t.initials} size={26} color={sel ? '#2E5598' : '#94A3B8'} />
                    <span style={{ fontSize: 13, fontWeight: sel ? 600 : 400 }}>
                      {t.full_name}{isSelf ? ' (tú)' : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose}
              style={{
                padding: '9px 18px', borderRadius: 8, border: '1px solid #D0D5DD',
                background: '#fff', color: '#555', fontSize: 13, cursor: 'pointer',
              }}>
              Cancelar
            </button>
            <button type="button" onClick={handleCreate} disabled={saving}
              style={{
                padding: '9px 18px', borderRadius: 8, border: 'none',
                background: saving ? '#93C5FD' : '#1F3864',
                color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer',
              }}>
              {saving ? 'Creando…' : '✓ Crear sala'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main GroupChat component ──────────────────────────────────────────────────
export default function GroupChat({ teacher }) {
  const { showToast } = useToast()

  const [rooms,       setRooms]       = useState([])
  const [selected,    setSelected]    = useState(null)
  const [messages,    setMessages]    = useState([])
  const [tmap,        setTmap]        = useState({})
  const [body,        setBody]        = useState('')
  const [sending,     setSending]     = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [msgLoading,  setMsgLoading]  = useState(false)
  const [showCreate,  setShowCreate]  = useState(false)
  const [allTeachers, setAllTeachers] = useState([])

  const bottomRef   = useRef(null)
  const channelRef  = useRef(null)
  const inputRef    = useRef(null)

  // Load rooms + teachers map
  useEffect(() => {
    loadRooms()
    loadTeachers()
  }, [])

  async function loadRooms() {
    setLoading(true)
    const { data } = await supabase
      .from('message_rooms')
      .select('id, name, type, created_by, created_at, room_participants(teacher_id)')
      .eq('school_id', teacher.school_id)
      .order('created_at', { ascending: true })
    setRooms(data || [])
    setLoading(false)
  }

  async function loadTeachers() {
    const { data } = await supabase
      .from('teachers')
      .select('id, full_name, initials, role')
      .eq('school_id', teacher.school_id)
    const map = {}
    for (const t of data || []) map[t.id] = t
    setTmap(map)
    setAllTeachers(data || [])
  }

  // Load messages when room changes + subscribe Realtime
  useEffect(() => {
    if (!selected) return

    setMsgLoading(true)
    supabase
      .from('room_messages')
      .select('id, from_id, body, created_at')
      .eq('room_id', selected.id)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data }) => {
        setMessages(data || [])
        setMsgLoading(false)
      })

    // Realtime subscription
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase
      .channel(`room-msgs-${selected.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'room_messages',
        filter: `room_id=eq.${selected.id}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [selected?.id])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!body.trim() || !selected) return
    setSending(true)
    const { error } = await supabase.from('room_messages').insert({
      room_id: selected.id,
      from_id: teacher.id,
      body:    body.trim(),
    })
    if (error) showToast('Error al enviar', 'error')
    else setBody('')
    setSending(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  function onRoomCreated(room) {
    setRooms(prev => [...prev, { ...room, room_participants: [] }])
    setSelected(room)
  }

  const participantCount = (room) =>
    (room.room_participants || []).length

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 440 }}>

      {/* Left: room list */}
      <div style={{
        width: selected ? 260 : '100%', flexShrink: 0,
        borderRight: selected ? '1px solid #E2E8F0' : 'none',
        overflowY: 'auto', display: 'flex', flexDirection: 'column',
      }}>
        {/* Create button */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #F1F5F9' }}>
          <button type="button" onClick={() => setShowCreate(true)}
            style={{
              width: '100%', padding: '8px', borderRadius: 8,
              border: '1.5px dashed #2E5598', background: '#F8FAFF',
              color: '#2E5598', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
            ➕ Nueva sala
          </button>
        </div>

        {loading && (
          <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>
            Cargando salas…
          </div>
        )}

        {!loading && rooms.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>💬</div>
            No hay salas aún.<br />Crea la primera.
          </div>
        )}

        {rooms.map(room => (
          <div key={room.id}
            onClick={() => setSelected(room)}
            style={{
              padding: '12px 14px', cursor: 'pointer',
              background: selected?.id === room.id ? '#EEF2FF' : '#fff',
              borderBottom: '1px solid #F1F5F9',
              display: 'flex', alignItems: 'center', gap: 10,
              borderLeft: selected?.id === room.id ? `3px solid #2E5598` : '3px solid transparent',
            }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: roomColor(room.id), flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 16,
            }}>
              #
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: selected?.id === room.id ? 700 : 500,
                fontSize: 13, color: '#1F3864',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {room.name}
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>
                {participantCount(room)} participante{participantCount(room) !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Right: messages */}
      {selected && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Room header */}
          <div style={{
            padding: '10px 16px', borderBottom: '1px solid #E2E8F0',
            display: 'flex', alignItems: 'center', gap: 10, background: '#F8FAFF',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: roomColor(selected.id),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 14, fontWeight: 700,
            }}>#</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1F3864' }}>{selected.name}</div>
              <div style={{ fontSize: 11, color: '#94A3B8' }}>
                {participantCount(selected)} participantes
              </div>
            </div>
            <button type="button" onClick={() => setSelected(null)}
              style={{
                marginLeft: 'auto', background: 'none', border: 'none',
                color: '#94A3B8', cursor: 'pointer', fontSize: 18,
              }}>×</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {msgLoading && <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Cargando mensajes…</div>}
            {!msgLoading && messages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, marginTop: 40 }}>
                Sé el primero en escribir en esta sala.
              </div>
            )}
            {messages.map(msg => {
              const isOwn = msg.from_id === teacher.id
              const from  = tmap[msg.from_id]
              return (
                <div key={msg.id} style={{
                  display: 'flex', gap: 8, flexDirection: isOwn ? 'row-reverse' : 'row',
                  alignItems: 'flex-end',
                }}>
                  {!isOwn && (
                    <Avatar
                      name={from?.full_name}
                      initials={from?.initials}
                      size={28}
                      color={roomColor(msg.from_id)}
                    />
                  )}
                  <div style={{ maxWidth: '70%' }}>
                    {!isOwn && (
                      <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2, paddingLeft: 4 }}>
                        {from?.full_name?.split(' ').slice(0, 2).join(' ')}
                      </div>
                    )}
                    <div style={{
                      background: isOwn ? '#2E5598' : '#F1F5F9',
                      color: isOwn ? '#fff' : '#1F3864',
                      borderRadius: isOwn ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      padding: '9px 13px', fontSize: 13, lineHeight: 1.5,
                      wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                    }}>
                      {msg.body}
                    </div>
                    <div style={{
                      fontSize: 10, color: '#94A3B8', marginTop: 3,
                      textAlign: isOwn ? 'right' : 'left', paddingLeft: 4,
                    }}>
                      {formatTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            borderTop: '1px solid #E2E8F0', padding: '12px 16px',
            display: 'flex', gap: 8, alignItems: 'flex-end',
          }}>
            <textarea
              ref={inputRef}
              value={body}
              onChange={e => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Escribe un mensaje… (Enter para enviar)"
              style={{
                flex: 1, padding: '9px 12px', borderRadius: 10,
                border: '1.5px solid #D0D5DD', fontSize: 13,
                resize: 'none', lineHeight: 1.4, fontFamily: 'inherit',
                maxHeight: 100, overflowY: 'auto',
              }}
            />
            <button type="button" onClick={sendMessage} disabled={sending || !body.trim()}
              style={{
                padding: '9px 16px', borderRadius: 10, border: 'none',
                background: sending || !body.trim() ? '#93C5FD' : '#2E5598',
                color: '#fff', fontWeight: 700, fontSize: 13,
                cursor: sending || !body.trim() ? 'default' : 'pointer',
                flexShrink: 0,
              }}>
              {sending ? '…' : '↑'}
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateRoomModal
          teacher={teacher}
          allTeachers={allTeachers}
          onClose={() => setShowCreate(false)}
          onCreated={onRoomCreated}
        />
      )}
    </div>
  )
}
