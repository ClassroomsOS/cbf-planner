import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const TYPE_CONFIG = {
  plan_submitted: { icon: '📬', label: 'Guía enviada',   color: '#F79646' },
  plan_approved:  { icon: '✅', label: 'Guía aprobada',  color: '#9BBB59' },
  plan_rejected:  { icon: '❌', label: 'Guía rechazada', color: '#C0504D' },
}

const TARGET_LABELS = {
  all:     { label: 'Todos',    color: '#2E5598', bg: '#e8edf8' },
  teacher: { label: 'Docentes', color: '#4BACC6', bg: '#e8f7fb' },
  admin:   { label: 'Admin',    color: '#8064A2', bg: '#f0ecf8' },
}

export default function NotificationsPage({ teacher, onRead }) {
  const navigate   = useNavigate()
  const isAdmin    = teacher.role === 'admin'
  const [tab,      setTab]      = useState(isAdmin ? 'announcements' : 'notifs')
  const [notifs,   setNotifs]   = useState([])
  const [announce, setAnnounce] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState({ title: '', body: '', target_role: 'all' })
  const [sending,  setSending]  = useState(false)

  useEffect(() => { fetchAll() }, [teacher.id])

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchNotifs(), fetchAnnouncements()])
    setLoading(false)
  }

  async function fetchNotifs() {
    let query = supabase
      .from('notifications')
      .select('*, from:from_id(full_name, initials), plan:plan_id(grade, subject, week_number)')
      .eq('school_id', teacher.school_id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (isAdmin) {
      query = query.eq('to_role', 'admin')
    } else {
      query = query.eq('to_id', teacher.id)
    }
    const { data } = await query
    setNotifs(data || [])
    const ids = (data || []).filter(n => !n.read).map(n => n.id)
    if (ids.length) {
      await supabase.from('notifications').update({ read: true }).in('id', ids)
      onRead?.()
    }
  }

  async function fetchAnnouncements() {
    const { data } = await supabase
      .from('announcements')
      .select('*, author:author_id(full_name, initials)')
      .eq('school_id', teacher.school_id)
      .order('created_at', { ascending: false })
      .limit(30)
    setAnnounce(data || [])
  }

  async function sendAnnouncement() {
    if (!form.title.trim() || !form.body.trim()) return
    setSending(true)
    await supabase.from('announcements').insert({
      school_id:   teacher.school_id,
      author_id:   teacher.id,
      title:       form.title.trim(),
      body:        form.body.trim(),
      target_role: form.target_role,
    })
    setForm({ title: '', body: '', target_role: 'all' })
    setShowForm(false)
    await fetchAnnouncements()
    setSending(false)
  }

  async function deleteAnnouncement(id) {
    if (!confirm('¿Eliminar este anuncio?')) return
    await supabase.from('announcements').delete().eq('id', id)
    setAnnounce(prev => prev.filter(a => a.id !== id))
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  function timeAgo(ts) {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1)  return 'ahora mismo'
    if (mins < 60) return `hace ${mins} min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)  return `hace ${hrs} h`
    const days = Math.floor(hrs / 24)
    return `hace ${days} día${days > 1 ? 's' : ''}`
  }

  const tabs = [
    ...(isAdmin ? [{ key: 'announcements', label: '📢 Anuncios', count: announce.length }] : []),
    { key: 'notifs', label: '🔔 Notificaciones', count: notifs.filter(n => !n.read).length },
    ...(!isAdmin ? [{ key: 'announcements', label: '📢 Anuncios', count: announce.length }] : []),
  ]

  return (
    <div className="planner-wrap">
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1F3864 0%, #2E5598 100%)',
          color: '#fff', padding: '18px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '16px' }}>Centro de comunicaciones</div>
            <div style={{ fontSize: '11px', opacity: .7, marginTop: '2px' }}>
              {teacher.schools?.name || 'CBF'}
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => { setShowForm(true); setTab('announcements') }}
              style={{
                background: '#fff', color: '#2E5598', border: 'none',
                padding: '7px 14px', borderRadius: '8px', fontSize: '12px',
                fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}>
              📢 Nuevo anuncio
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid #eef2f8', background: '#fafbff' }}>
          {tabs.map(t => (
            <button key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer',
                background: 'none', fontSize: '13px',
                color: tab === t.key ? '#2E5598' : '#888',
                fontWeight: tab === t.key ? 700 : 400,
                borderBottom: tab === t.key ? '2px solid #2E5598' : '2px solid transparent',
                marginBottom: '-2px', transition: 'all .15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}>
              {t.label}
              {t.count > 0 && (
                <span style={{
                  background: tab === t.key ? '#2E5598' : '#ddd',
                  color: tab === t.key ? '#fff' : '#666',
                  fontSize: '10px', fontWeight: 700,
                  padding: '1px 6px', borderRadius: '10px',
                }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ padding: '16px 20px' }}>

          {/* ── ANUNCIOS ── */}
          {tab === 'announcements' && (
            <>
              {/* Compose form */}
              {showForm && isAdmin && (
                <div style={{
                  background: 'linear-gradient(135deg, #f0f4ff 0%, #e8f7fb 100%)',
                  border: '1.5px solid #c5d5f0', borderRadius: '12px',
                  padding: '16px', marginBottom: '16px',
                }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#2E5598', marginBottom: '12px' }}>
                    📢 Nuevo anuncio institucional
                  </div>
                  <div className="ge-field" style={{ marginBottom: '10px' }}>
                    <label>Título</label>
                    <input type="text" value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="Ej: Reunión de docentes — Viernes 7am" />
                  </div>
                  <div className="ge-field" style={{ marginBottom: '10px' }}>
                    <label>Mensaje</label>
                    <textarea rows={4} value={form.body}
                      onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                      placeholder="Escribe el contenido del anuncio…"
                      style={{ fontSize: '13px', resize: 'vertical' }} />
                  </div>
                  <div className="ge-field" style={{ marginBottom: '12px' }}>
                    <label>Destinatarios</label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {Object.entries(TARGET_LABELS).map(([key, cfg]) => (
                        <button key={key}
                          onClick={() => setForm(f => ({ ...f, target_role: key }))}
                          style={{
                            padding: '5px 14px', borderRadius: '20px', fontSize: '12px',
                            fontWeight: 600, cursor: 'pointer',
                            background: form.target_role === key ? cfg.color : cfg.bg,
                            color: form.target_role === key ? '#fff' : cfg.color,
                            border: `1.5px solid ${cfg.color}`,
                            transition: 'all .15s',
                          }}>
                          {cfg.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                    <button className="btn-primary btn-save"
                      disabled={sending || !form.title.trim() || !form.body.trim()}
                      onClick={sendAnnouncement}>
                      {sending ? '⏳ Publicando…' : '📢 Publicar anuncio'}
                    </button>
                  </div>
                </div>
              )}

              {loading && (
                <div style={{ textAlign: 'center', padding: '30px' }}>
                  <div className="loading-spinner" />
                </div>
              )}

              {!loading && announce.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#aaa' }}>
                  <div style={{ fontSize: '48px', marginBottom: '10px' }}>📢</div>
                  <p style={{ fontSize: '13px' }}>No hay anuncios publicados.</p>
                  {isAdmin && (
                    <button className="btn-primary"
                      onClick={() => setShowForm(true)}
                      style={{ marginTop: '12px', fontSize: '12px' }}>
                      Crear primer anuncio
                    </button>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {announce.map(a => {
                  const tgt = TARGET_LABELS[a.target_role] || TARGET_LABELS.all
                  const ini = a.author?.initials || a.author?.full_name?.slice(0,2).toUpperCase() || 'AD'
                  return (
                    <div key={a.id} style={{
                      background: '#fff',
                      border: '1.5px solid #e8edf8',
                      borderLeft: `4px solid ${tgt.color}`,
                      borderRadius: '10px', padding: '14px 16px',
                      boxShadow: '0 2px 8px rgba(46,85,152,0.06)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                          background: `linear-gradient(135deg, ${tgt.color} 0%, ${tgt.color}bb 100%)`,
                          color: '#fff', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: '13px', fontWeight: 700,
                        }}>
                          {ini}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 700, fontSize: '14px', color: '#1a2a4a' }}>
                              {a.title}
                            </span>
                            <span style={{
                              fontSize: '10px', fontWeight: 700, padding: '2px 8px',
                              borderRadius: '10px', background: tgt.bg, color: tgt.color,
                              border: `1px solid ${tgt.color}40`,
                            }}>
                              {tgt.label}
                            </span>
                          </div>
                          <div style={{ fontSize: '13px', color: '#444', lineHeight: 1.6, marginBottom: '8px', whiteSpace: 'pre-wrap' }}>
                            {a.body}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ fontSize: '11px', color: '#999' }}>
                              <strong style={{ color: '#666' }}>{a.author?.full_name}</strong>
                              {' · '}{timeAgo(a.created_at)}
                              <span style={{ marginLeft: '6px', opacity: .6 }}>({formatDate(a.created_at)})</span>
                            </div>
                            {isAdmin && (
                              <button
                                onClick={() => deleteAnnouncement(a.id)}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  color: '#C0504D', fontSize: '11px', padding: '2px 6px',
                                  borderRadius: '4px',
                                }}
                                title="Eliminar anuncio">
                                🗑 Eliminar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* ── NOTIFICACIONES ── */}
          {tab === 'notifs' && (
            <>
              {loading && (
                <div style={{ textAlign: 'center', padding: '30px' }}>
                  <div className="loading-spinner" />
                </div>
              )}

              {!loading && notifs.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#aaa' }}>
                  <div style={{ fontSize: '48px', marginBottom: '10px' }}>🔔</div>
                  <p style={{ fontSize: '13px' }}>No hay notificaciones.</p>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {notifs.map(n => {
                  const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.plan_submitted
                  return (
                    <div key={n.id}
                      onClick={() => n.plan_id && navigate(`/editor/${n.plan_id}`)}
                      style={{
                        display: 'flex', gap: '12px', alignItems: 'flex-start',
                        padding: '12px 14px', borderRadius: '10px',
                        background: !n.read ? cfg.color + '08' : '#fff',
                        border: `1.5px solid ${!n.read ? cfg.color + '40' : '#eee'}`,
                        cursor: n.plan_id ? 'pointer' : 'default',
                        transition: 'all .15s',
                      }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                        background: cfg.color + '20', color: cfg.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '16px',
                      }}>
                        {cfg.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', color: '#333', lineHeight: 1.5, marginBottom: '4px' }}>
                          {n.message}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: '10px', fontWeight: 700, padding: '2px 8px',
                            borderRadius: '10px', background: cfg.color + '20', color: cfg.color,
                          }}>
                            {cfg.label}
                          </span>
                          <span style={{ fontSize: '11px', color: '#999' }}>
                            {timeAgo(n.created_at)}
                          </span>
                          {n.plan && (
                            <span style={{ fontSize: '11px', color: '#888' }}>
                              · {n.plan.grade} · {n.plan.subject} · Sem. {n.plan.week_number}
                            </span>
                          )}
                        </div>
                      </div>
                      {n.plan_id && (
                        <span style={{ color: '#2E5598', fontSize: '16px', flexShrink: 0 }}>→</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
