import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const TYPE_CONFIG = {
  plan_submitted: { icon: '📬', label: 'Guía enviada',   color: '#F79646' },
  plan_approved:  { icon: '✅', label: 'Guía aprobada',  color: '#9BBB59' },
  plan_rejected:  { icon: '❌', label: 'Guía rechazada', color: '#C0504D' },
}

export default function NotificationsPage({ teacher, onRead }) {
  const navigate    = useNavigate()
  const [notifs, setNotifs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchNotifs() }, [teacher.id])

  async function fetchNotifs() {
    setLoading(true)
    const isAdmin = teacher.role === 'admin'

    let query = supabase
      .from('notifications')
      .select('*, from:from_id(full_name, initials), plan:plan_id(grade, subject, week_number)')
      .eq('school_id', teacher.school_id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (isAdmin) {
      query = query.eq('to_role', 'admin')
    } else {
      query = query.eq('from_id', teacher.id).eq('to_role', 'teacher')
    }

    const { data } = await query
    setNotifs(data || [])
    setLoading(false)

    // Mark all as read
    const ids = (data || []).filter(n => !n.read).map(n => n.id)
    if (ids.length) {
      await supabase.from('notifications').update({ read: true }).in('id', ids)
      onRead?.()
    }
  }

  function formatDate(ts) {
    const d = new Date(ts)
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return (
    <div className="ge-loading">
      <div className="loading-spinner" />
      <p>Cargando notificaciones…</p>
    </div>
  )

  return (
    <div className="planner-wrap">
      <div className="card">
        <div className="card-title">
          <div className="badge">🔔</div>
          Notificaciones
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#888', fontWeight: 400, textTransform: 'none' }}>
            {notifs.length} {notifs.length === 1 ? 'notificación' : 'notificaciones'}
          </span>
        </div>

        {notifs.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: '48px' }}>🔔</div>
            <p>No hay notificaciones.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {notifs.map(n => {
              const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.plan_submitted
              return (
                <div key={n.id}
                  className={`notif-card ${!n.read ? 'notif-unread' : ''}`}
                  onClick={() => n.plan_id && navigate(`/editor/${n.plan_id}`)}>
                  <div className="notif-icon"
                    style={{ background: cfg.color + '22', color: cfg.color }}>
                    {cfg.icon}
                  </div>
                  <div className="notif-body">
                    <div className="notif-message">{n.message}</div>
                    <div className="notif-meta">
                      <span className="notif-type-badge"
                        style={{ background: cfg.color + '22', color: cfg.color }}>
                        {cfg.label}
                      </span>
                      <span>{formatDate(n.created_at)}</span>
                    </div>
                  </div>
                  {n.plan_id && <span className="mp-arrow">→</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
