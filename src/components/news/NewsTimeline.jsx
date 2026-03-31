import { useMemo } from 'react'

const STATUS_COLORS = {
  draft: '#ccc',
  published: '#1A3A8F',
  in_progress: '#B8860B',
  completed: '#1A6B3A'
}

const SKILL_ICONS = {
  speaking: '🎤',
  listening: '🎧',
  reading: '📖',
  writing: '✍️'
}

export default function NewsTimeline({ projects, onEdit }) {
  const today = new Date()
  
  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (projects.length === 0) return { minDate: today, maxDate: today, totalDays: 1 }
    
    const dates = projects.flatMap(p => {
      const d = [new Date(p.due_date + 'T12:00:00')]
      if (p.start_date) d.push(new Date(p.start_date + 'T12:00:00'))
      return d
    })
    dates.push(today)
    
    const min = new Date(Math.min(...dates))
    const max = new Date(Math.max(...dates))
    // Add padding
    min.setDate(min.getDate() - 7)
    max.setDate(max.getDate() + 7)
    const days = Math.max(1, Math.ceil((max - min) / (1000 * 60 * 60 * 24)))
    
    return { minDate: min, maxDate: max, totalDays: days }
  }, [projects])

  const todayPosition = useMemo(() => {
    const diff = Math.ceil((today - minDate) / (1000 * 60 * 60 * 24))
    return Math.max(0, Math.min(100, (diff / totalDays) * 100))
  }, [minDate, totalDays])

  const formatShortDate = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
  }

  if (projects.length === 0) return null

  return (
    <div style={{
      background: 'white', borderRadius: 14, padding: '20px 24px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      marginBottom: 24, overflow: 'hidden'
    }}>
      <h3 style={{
        fontSize: 12, fontWeight: 800, color: '#1A3A8F',
        textTransform: 'uppercase', letterSpacing: '0.5px',
        marginBottom: 16
      }}>
        Timeline del período
      </h3>

      {/* Timeline track */}
      <div style={{ position: 'relative', minHeight: 80, marginBottom: 8 }}>
        {/* Base line */}
        <div style={{
          position: 'absolute', top: 30, left: 0, right: 0,
          height: 3, background: '#eee', borderRadius: 2
        }} />

        {/* Progress fill to today */}
        <div style={{
          position: 'absolute', top: 30, left: 0,
          width: `${todayPosition}%`,
          height: 3, background: 'linear-gradient(90deg, #1A3A8F, #2B8A45)',
          borderRadius: 2
        }} />

        {/* Today marker */}
        <div style={{
          position: 'absolute', left: `${todayPosition}%`, top: 20,
          transform: 'translateX(-50%)', textAlign: 'center', zIndex: 5
        }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            background: '#CC1F27', border: '2px solid white',
            boxShadow: '0 2px 6px rgba(204,31,39,0.3)',
            margin: '0 auto 4px'
          }} />
          <span style={{
            fontSize: 9, fontWeight: 800, color: '#CC1F27',
            whiteSpace: 'nowrap'
          }}>
            HOY
          </span>
        </div>

        {/* Project milestones */}
        {projects.map((project, i) => {
          const dueDate = new Date(project.due_date + 'T12:00:00')
          const diff = Math.ceil((dueDate - minDate) / (1000 * 60 * 60 * 24))
          const position = Math.max(2, Math.min(98, (diff / totalDays) * 100))
          const color = STATUS_COLORS[project.status]
          const icon = SKILL_ICONS[project.skill] || '📋'
          // Stagger vertically to avoid overlaps
          const row = i % 2 === 0 ? -24 : 48

          return (
            <div
              key={project.id}
              onClick={() => onEdit(project)}
              style={{
                position: 'absolute',
                left: `${position}%`,
                top: row < 0 ? row : 42,
                transform: 'translateX(-50%)',
                textAlign: 'center',
                cursor: 'pointer',
                zIndex: 3,
                transition: 'transform 0.15s'
              }}
              title={`${project.title} — ${formatShortDate(project.due_date)}`}
            >
              {/* Connector line */}
              <div style={{
                position: 'absolute',
                left: '50%', 
                top: row < 0 ? '100%' : 'auto',
                bottom: row < 0 ? 'auto' : '100%',
                width: 1, height: Math.abs(row) - 6,
                background: color, opacity: 0.3,
                transform: 'translateX(-50%)'
              }} />

              {/* Dot on track */}
              <div style={{
                position: 'absolute',
                left: '50%',
                top: row < 0 ? `calc(100% + ${Math.abs(row) - 6}px)` : `calc(-${Math.abs(row) - 36}px)`,
                transform: 'translate(-50%, -50%)',
                width: 10, height: 10, borderRadius: '50%',
                background: color, border: '2px solid white',
                boxShadow: `0 1px 4px ${color}40`
              }} />

              {/* Label */}
              <div style={{
                background: color + '15',
                border: `1.5px solid ${color}40`,
                borderRadius: 8, padding: '4px 10px',
                whiteSpace: 'nowrap',
                maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis'
              }}>
                <span style={{ fontSize: 12 }}>{icon}</span>
                <span style={{
                  fontSize: 10, fontWeight: 800, color,
                  marginLeft: 4
                }}>
                  {project.title}
                </span>
                <div style={{ fontSize: 9, color: '#888', fontWeight: 600 }}>
                  {formatShortDate(project.due_date)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
