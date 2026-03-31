const STATUS_CONFIG = {
  draft: { label: 'Borrador', color: '#888', bg: '#f5f5f5', icon: '✏️' },
  published: { label: 'Publicado', color: '#1A3A8F', bg: '#EEF2FB', icon: '📢' },
  in_progress: { label: 'En curso', color: '#B8860B', bg: '#FFFDF0', icon: '🔄' },
  completed: { label: 'Completado', color: '#1A6B3A', bg: '#EEFBF0', icon: '✅' }
}

const SKILL_LABELS = {
  speaking: '🎤 Speaking',
  listening: '🎧 Listening',
  reading: '📖 Reading',
  writing: '✍️ Writing'
}

const STATUS_FLOW = {
  draft: 'published',
  published: 'in_progress',
  in_progress: 'completed'
}

export default function NewsProjectCard({ project, onEdit, onDelete, onStatusChange }) {
  const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.draft
  const dueDate = new Date(project.due_date + 'T12:00:00')
  const today = new Date()
  const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))
  const isOverdue = daysUntilDue < 0 && project.status !== 'completed'
  const criteriaCount = Array.isArray(project.rubric) ? project.rubric.length : 0
  const nextStatus = STATUS_FLOW[project.status]

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
  }

  return (
    <div style={{
      background: 'white', borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      border: isOverdue ? '2px solid #CC1F27' : '1px solid #eee',
      transition: 'all 0.18s',
      display: 'flex', flexDirection: 'column'
    }}>
      {/* Top color bar */}
      <div style={{
        height: 4,
        background: project.status === 'completed' ? '#1A6B3A' :
                     project.status === 'in_progress' ? '#B8860B' :
                     project.status === 'published' ? '#1A3A8F' : '#ccc'
      }} />

      <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1a1a2e', margin: 0, lineHeight: 1.3 }}>
              {project.title}
            </h3>
            {project.skill && (
              <span style={{
                fontSize: 11, fontWeight: 700, color: '#1A3A8F',
                marginTop: 4, display: 'inline-block'
              }}>
                {SKILL_LABELS[project.skill] || project.skill}
              </span>
            )}
          </div>
          <span style={{
            padding: '3px 10px', borderRadius: 20,
            background: status.bg, color: status.color,
            fontSize: 10, fontWeight: 800,
            whiteSpace: 'nowrap'
          }}>
            {status.icon} {status.label}
          </span>
        </div>

        {/* Description preview */}
        <p style={{
          fontSize: 12, color: '#666', lineHeight: 1.5,
          margin: '0 0 12px',
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden'
        }}>
          {project.description}
        </p>

        {/* Info chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {/* Due date */}
          <span style={{
            ...chipStyle,
            color: isOverdue ? '#CC1F27' : '#555',
            background: isOverdue ? 'rgba(204,31,39,0.08)' : '#f5f5f5'
          }}>
            📅 {formatDate(project.due_date)}
            {project.status !== 'completed' && (
              <span style={{ marginLeft: 4, fontWeight: 800 }}>
                {isOverdue ? `(${Math.abs(daysUntilDue)}d atrás)` :
                 daysUntilDue === 0 ? '(hoy)' :
                 `(${daysUntilDue}d)`}
              </span>
            )}
          </span>

          {/* Criteria count */}
          {criteriaCount > 0 && (
            <span style={chipStyle}>
              📊 {criteriaCount} criterios
            </span>
          )}

          {/* Biblical principle */}
          {project.biblical_principle && (
            <span style={chipStyle}>
              ✝️ {project.biblical_principle}
            </span>
          )}

          {/* Textbook */}
          {project.textbook_reference?.book && (
            <span style={chipStyle}>
              📘 {project.textbook_reference.book}
              {project.textbook_reference.units?.length > 0 &&
                ` U${project.textbook_reference.units.join(',')}`}
            </span>
          )}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Actions */}
        <div style={{
          display: 'flex', gap: 8, justifyContent: 'space-between',
          borderTop: '1px solid #f0f0f0', paddingTop: 12, marginTop: 4
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onEdit} style={actionBtnStyle}>
              ✏️ Editar
            </button>
            {project.status === 'draft' && (
              <button onClick={onDelete} style={{ ...actionBtnStyle, color: '#CC1F27' }}>
                🗑️
              </button>
            )}
          </div>
          {nextStatus && (
            <button
              onClick={() => onStatusChange(project.id, nextStatus)}
              style={{
                ...actionBtnStyle,
                background: STATUS_CONFIG[nextStatus].bg,
                color: STATUS_CONFIG[nextStatus].color,
                fontWeight: 800
              }}
            >
              → {STATUS_CONFIG[nextStatus].label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const chipStyle = {
  padding: '3px 8px', borderRadius: 6,
  background: '#f5f5f5', color: '#555',
  fontSize: 11, fontWeight: 600,
  display: 'inline-flex', alignItems: 'center', gap: 4
}

const actionBtnStyle = {
  padding: '6px 12px', border: '1px solid #eee', borderRadius: 8,
  background: 'white', color: '#555',
  fontSize: 11, fontWeight: 700, cursor: 'pointer',
  transition: 'all 0.15s'
}
