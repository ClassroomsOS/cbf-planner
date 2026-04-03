import { useMemo } from 'react'
import { NEWS_PROJECT_STATUS, NEWS_SKILL_LABELS } from '../../utils/constants'

// Derive STATUS_COLORS from NEWS_PROJECT_STATUS
const STATUS_COLORS = Object.fromEntries(
  Object.entries(NEWS_PROJECT_STATUS).map(([key, val]) => [key, val.color])
)

// Extract just the emoji from SKILL_LABELS
const SKILL_ICONS = Object.fromEntries(
  Object.entries(NEWS_SKILL_LABELS).map(([key, val]) => [key, val.split(' ')[0]])
)

const ASSESSMENT_CONFIG = {
  QUIZ:      { icon: '📝', color: '#C0504D', label: 'Quiz' },
  DICTATION: { icon: '🎤', color: '#4BACC6', label: 'Dictation' },
  WORKSHOP:  { icon: '🔧', color: '#F79646', label: 'Workshop' },
}

export default function NewsTimeline({ projects, onEdit }) {
  const today = new Date()

  // Collect all dated events: projects + assessments
  const allEvents = useMemo(() => {
    const events = []
    projects.forEach(p => {
      if (p.due_date) {
        events.push({ kind: 'project', date: p.due_date, project: p })
      }
      ;(p.assessments || []).forEach(a => {
        if (a.date) {
          events.push({ kind: 'assessment', date: a.date, assessment: a, project: p })
        }
      })
    })
    return events.sort((a, b) => new Date(a.date) - new Date(b.date))
  }, [projects])

  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (allEvents.length === 0) return { minDate: today, maxDate: today, totalDays: 1 }
    const dates = allEvents.map(e => new Date(e.date + 'T12:00:00'))
    dates.push(today)
    const min = new Date(Math.min(...dates))
    const max = new Date(Math.max(...dates))
    min.setDate(min.getDate() - 7)
    max.setDate(max.getDate() + 7)
    const days = Math.max(1, Math.ceil((max - min) / (1000 * 60 * 60 * 24)))
    return { minDate: min, maxDate: max, totalDays: days }
  }, [allEvents])

  const todayPosition = useMemo(() => {
    const diff = Math.ceil((today - minDate) / (1000 * 60 * 60 * 24))
    return Math.max(0, Math.min(100, (diff / totalDays) * 100))
  }, [minDate, totalDays])

  const getPosition = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00')
    const diff = Math.ceil((d - minDate) / (1000 * 60 * 60 * 24))
    return Math.max(2, Math.min(98, (diff / totalDays) * 100))
  }

  const formatShortDate = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
  }

  if (allEvents.length === 0) return null

  // Split events into two rows to avoid overlaps
  const projectEvents  = allEvents.filter(e => e.kind === 'project')
  const assessmentEvents = allEvents.filter(e => e.kind === 'assessment')

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
      <div style={{ position: 'relative', minHeight: 130, marginBottom: 8 }}>

        {/* Base line */}
        <div style={{
          position: 'absolute', top: 64, left: 0, right: 0,
          height: 3, background: '#eee', borderRadius: 2
        }} />

        {/* Progress fill to today */}
        <div style={{
          position: 'absolute', top: 64, left: 0,
          width: `${todayPosition}%`,
          height: 3, background: 'linear-gradient(90deg, #1A3A8F, #2B8A45)',
          borderRadius: 2
        }} />

        {/* Today marker */}
        <div style={{
          position: 'absolute', left: `${todayPosition}%`, top: 54,
          transform: 'translateX(-50%)', textAlign: 'center', zIndex: 5
        }}>
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            background: '#CC1F27', border: '2px solid white',
            boxShadow: '0 2px 6px rgba(204,31,39,0.3)',
            margin: '0 auto 4px'
          }} />
          <span style={{ fontSize: 9, fontWeight: 800, color: '#CC1F27', whiteSpace: 'nowrap' }}>HOY</span>
        </div>

        {/* Projects — above the track */}
        {projectEvents.map((event, i) => {
          const { project } = event
          const position = getPosition(event.date)
          const color = STATUS_COLORS[project.status]
          const icon = SKILL_ICONS[project.skill] || '📋'
          const offset = i % 2 === 0 ? -54 : -36

          return (
            <div
              key={`proj-${project.id}`}
              onClick={() => onEdit(project)}
              style={{
                position: 'absolute', left: `${position}%`,
                top: 64 + offset - 28,
                transform: 'translateX(-50%)',
                textAlign: 'center', cursor: 'pointer', zIndex: 3,
              }}
              title={`${project.title} — ${formatShortDate(event.date)}`}
            >
              <div style={{
                background: color + '18', border: `1.5px solid ${color}50`,
                borderRadius: 8, padding: '4px 8px',
                whiteSpace: 'nowrap', maxWidth: 130,
                overflow: 'hidden', textOverflow: 'ellipsis'
              }}>
                <span style={{ fontSize: 11 }}>{icon}</span>
                <span style={{ fontSize: 10, fontWeight: 800, color, marginLeft: 3 }}>
                  {project.title.length > 16 ? project.title.slice(0, 14) + '…' : project.title}
                </span>
                <div style={{ fontSize: 9, color: '#888', fontWeight: 600 }}>
                  {formatShortDate(event.date)}
                </div>
              </div>
              {/* connector */}
              <div style={{
                width: 1, height: 14, background: color + '50',
                margin: '0 auto'
              }} />
              {/* dot on track */}
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: color, border: '2px solid white',
                boxShadow: `0 1px 4px ${color}40`,
                margin: '0 auto'
              }} />
            </div>
          )
        })}

        {/* Assessments — below the track */}
        {assessmentEvents.map((event, i) => {
          const { assessment } = event
          const cfg = ASSESSMENT_CONFIG[assessment.type] || ASSESSMENT_CONFIG.QUIZ
          const position = getPosition(event.date)
          const offset = i % 2 === 0 ? 18 : 36

          return (
            <div
              key={`ass-${assessment.id}`}
              style={{
                position: 'absolute', left: `${position}%`,
                top: 64 + offset + 10,
                transform: 'translateX(-50%)',
                textAlign: 'center', zIndex: 3,
              }}
              title={`${assessment.title || cfg.label} — ${formatShortDate(event.date)}${assessment.points ? ` · ${assessment.points}pts` : ''}`}
            >
              {/* dot on track */}
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: cfg.color, border: '2px solid white',
                boxShadow: `0 1px 4px ${cfg.color}40`,
                margin: '0 auto'
              }} />
              {/* connector */}
              <div style={{ width: 1, height: 10, background: cfg.color + '50', margin: '0 auto' }} />
              <div style={{
                background: cfg.color + '15', border: `1.5px solid ${cfg.color}40`,
                borderRadius: 8, padding: '3px 7px',
                whiteSpace: 'nowrap', maxWidth: 110,
                overflow: 'hidden', textOverflow: 'ellipsis'
              }}>
                <span style={{ fontSize: 10 }}>{cfg.icon}</span>
                <span style={{ fontSize: 9, fontWeight: 800, color: cfg.color, marginLeft: 2 }}>
                  {assessment.title || cfg.label}
                </span>
                <div style={{ fontSize: 9, color: '#888', fontWeight: 600 }}>
                  {formatShortDate(event.date)}{assessment.points ? ` · ${assessment.points}pts` : ''}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>📋 Proyecto</span>
        {Object.values(ASSESSMENT_CONFIG).map(cfg => (
          <span key={cfg.label} style={{ fontSize: 10, color: cfg.color, fontWeight: 600 }}>
            {cfg.icon} {cfg.label}
          </span>
        ))}
        <span style={{ fontSize: 10, color: '#CC1F27', fontWeight: 600 }}>● Hoy</span>
      </div>
    </div>
  )
}
