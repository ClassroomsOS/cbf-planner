// ── NewsEventDetail.jsx ──────────────────────────────────────────────────────
// Expandable detail panel for a selected timeline event.

import { NEWS_PROJECT_STATUS, NEWS_SKILL_LABELS, SKILL_COLOR } from '../../utils/constants'

function formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00')
    .toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function daysUntil(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  return Math.ceil((d - today) / (1000 * 60 * 60 * 24))
}

export default function NewsEventDetail({ event, onClose, onEditProject }) {
  if (!event) return null

  const ev = event
  const status = NEWS_PROJECT_STATUS[ev.status] || NEWS_PROJECT_STATUS.draft
  const skillLabel = ev.skill ? (NEWS_SKILL_LABELS[ev.skill] || ev.skill) : null
  const skillColor = SKILL_COLOR[ev.skill ? ev.skill.charAt(0).toUpperCase() + ev.skill.slice(1) : ''] || '#1A3A8F'
  const days = daysUntil(ev.date)
  const countdownText = days === 0 ? 'Hoy' : days > 0 ? `En ${days} día${days !== 1 ? 's' : ''}` : `Hace ${Math.abs(days)} día${Math.abs(days) !== 1 ? 's' : ''}`
  const countdownColor = days < 0 ? '#DC2626' : days <= 3 ? '#D97706' : '#15803D'

  return (
    <div className="nt-detail nt-detail--expanded">
      <div className="nt-detail-inner">
        {/* Header */}
        <div className="nt-detail-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 22 }}>{ev.icon}</span>
              <span className="nt-detail-name">{ev.nombre}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {ev.porcentaje > 0 && (
                <span style={{
                  background: ev.color + '18', color: ev.color, fontWeight: 800,
                  fontSize: 12, padding: '2px 10px', borderRadius: 8
                }}>
                  {ev.porcentaje}%
                </span>
              )}
              <span style={{
                background: status.bg, color: status.color,
                fontSize: 10, fontWeight: 800, padding: '2px 10px', borderRadius: 12
              }}>
                {status.icon} {status.label}
              </span>
              {ev.tier === 'entrega' && (
                <span style={{
                  background: '#FEE2E2', color: '#DC2626',
                  fontSize: 10, fontWeight: 800, padding: '2px 10px', borderRadius: 12
                }}>
                  🏁 Entrega del proyecto
                </span>
              )}
            </div>
          </div>
          <button className="nt-detail-close" onClick={onClose}>✕</button>
        </div>

        {/* Grid */}
        <div className="nt-detail-grid">
          <div className="nt-detail-field">
            <label>Fecha</label>
            <span>{formatDate(ev.date)}</span>
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: countdownColor }}>
              ({countdownText})
            </span>
          </div>
          <div className="nt-detail-field">
            <label>Proyecto NEWS</label>
            <span style={{ color: skillColor, fontWeight: 700 }}>{ev.projectTitle}</span>
          </div>
          <div className="nt-detail-field">
            <label>Materia</label>
            <span>{ev.subject}</span>
          </div>
          <div className="nt-detail-field">
            <label>Grado / Sección</label>
            <span>{ev.grade} {ev.section}</span>
          </div>
          {skillLabel && (
            <div className="nt-detail-field">
              <label>Habilidad</label>
              <span style={{
                background: skillColor + '15', color: skillColor,
                padding: '2px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700
              }}>
                {skillLabel}
              </span>
            </div>
          )}
          <div className="nt-detail-field">
            <label>Tipo</label>
            <span style={{ color: ev.color, fontWeight: 700 }}>
              {ev.icon} {ev.label}
            </span>
          </div>
        </div>

        {/* Description */}
        {ev.descripcion && (
          <div className="nt-detail-desc">{ev.descripcion}</div>
        )}

        {/* Actions */}
        <div className="nt-detail-actions">
          <button className="nt-detail-btn" onClick={() => onEditProject?.(ev.projectId)}>
            ✏️ Editar Proyecto
          </button>
        </div>
      </div>
    </div>
  )
}
