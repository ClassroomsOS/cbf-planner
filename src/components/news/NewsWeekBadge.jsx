const SKILL_ICONS = {
  speaking: '🎤',
  listening: '🎧',
  reading: '📖',
  writing: '✍️'
}

export default function NewsWeekBadge({ project, weekNumber, totalWeeks, onRemove }) {
  if (!project) return null

  const dueDate = new Date(project.due_date + 'T12:00:00')
  const today = new Date()
  const daysLeft = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))
  const icon = SKILL_ICONS[project.skill] || '📋'

  return (
    <div style={{
      background: 'linear-gradient(135deg, #EEF2FB 0%, #F8F4FF 100%)',
      borderRadius: 12, padding: '12px 16px',
      border: '1.5px solid #D0DCFF',
      display: 'flex', alignItems: 'center', gap: 14,
      marginBottom: 16
    }}>
      {/* Icon */}
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: '#1A3A8F', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, flexShrink: 0
      }}>
        {icon}
      </div>

      {/* Info */}
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 10, fontWeight: 800, color: '#1A3A8F',
          textTransform: 'uppercase', letterSpacing: '0.5px',
          marginBottom: 2
        }}>
          🎯 Esta guía prepara para
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1a2e' }}>
          {project.title}
          {project.skill && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: '#888',
              marginLeft: 8
            }}>
              ({project.skill})
            </span>
          )}
        </div>
      </div>

      {/* Week counter */}
      {weekNumber && totalWeeks && (
        <div style={{
          textAlign: 'center', padding: '6px 14px',
          background: 'white', borderRadius: 10,
          border: '1px solid #D0DCFF'
        }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#1A3A8F' }}>
            {weekNumber}/{totalWeeks}
          </div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#888' }}>
            SEMANA
          </div>
        </div>
      )}

      {/* Days remaining */}
      <div style={{
        textAlign: 'center', padding: '6px 14px',
        background: daysLeft <= 3 ? 'rgba(204,31,39,0.08)' : 'white',
        borderRadius: 10,
        border: daysLeft <= 3 ? '1px solid rgba(204,31,39,0.2)' : '1px solid #D0DCFF'
      }}>
        <div style={{
          fontSize: 18, fontWeight: 900,
          color: daysLeft <= 3 ? '#CC1F27' : daysLeft <= 7 ? '#B8860B' : '#1A6B3A'
        }}>
          {daysLeft}
        </div>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#888' }}>
          {daysLeft === 1 ? 'DÍA' : 'DÍAS'}
        </div>
      </div>

      {/* Remove link */}
      {onRemove && (
        <button
          onClick={onRemove}
          title="Desvincular NEWS"
          style={{
            border: 'none', background: 'none',
            color: '#ccc', cursor: 'pointer', fontSize: 16,
            padding: 4
          }}
        >
          ✕
        </button>
      )}
    </div>
  )
}
