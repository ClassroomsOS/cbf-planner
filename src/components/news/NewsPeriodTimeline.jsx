// ── NewsPeriodTimeline.jsx ────────────────────────────────────────────────────
// Horizontal week-card Gantt timeline aggregating ALL activities from ALL NEWS
// projects in the selected period. Supports compact (inline) and full mode.

import { useMemo, useState, useRef, useEffect } from 'react'
import {
  SKILL_COLOR, NEWS_SKILL_LABELS, NEWS_PROJECT_STATUS,
  detectActivityType, isoMonday, formatWeekRange
} from '../../utils/constants'

const TIER_ORDER = { entrega: 0, 'high-stakes': 1, assessment: 2, routine: 3 }

function getSchoolWeekNum(monStr, allMondays) {
  const sorted = [...allMondays].sort()
  return sorted.indexOf(monStr) + 1
}

function formatShortDate(dateStr) {
  return new Date(dateStr + 'T12:00:00')
    .toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

export default function NewsPeriodTimeline({
  projects, compact, onEventClick, selectedEventId, onNavigateToFull
}) {
  const scrollRef = useRef(null)
  const currentRef = useRef(null)
  const [filterSubject, setFilterSubject] = useState('')

  // ── Aggregate events across all projects ───────────────────────────────────
  const { events, subjects, legendItems } = useMemo(() => {
    const evts = []
    const subjectSet = new Set()
    const legendSet = new Map()

    projects.forEach(p => {
      subjectSet.add(p.subject)
      const skillColor = SKILL_COLOR[
        p.skill ? p.skill.charAt(0).toUpperCase() + p.skill.slice(1) : ''
      ] || '#1A3A8F'

      // Activities
      ;(p.actividades_evaluativas || []).forEach((a, idx) => {
        if (!a.fecha) return
        const at = detectActivityType(a.nombre)
        if (!legendSet.has(at.label)) legendSet.set(at.label, at)
        evts.push({
          id: `${p.id}-act-${idx}`,
          date: a.fecha,
          kind: 'activity',
          nombre: a.nombre,
          descripcion: a.descripcion || '',
          porcentaje: a.porcentaje || 0,
          skill: p.skill,
          skillColor,
          projectTitle: p.title,
          projectId: p.id,
          subject: p.subject,
          grade: p.grade,
          section: p.section,
          status: p.status,
          ...at
        })
      })

      // Due date milestone
      if (p.due_date) {
        evts.push({
          id: `${p.id}-due`,
          date: p.due_date,
          kind: 'project-due',
          nombre: `Entrega: ${p.title}`,
          descripcion: p.description || '',
          porcentaje: null,
          skill: p.skill,
          skillColor,
          projectTitle: p.title,
          projectId: p.id,
          subject: p.subject,
          grade: p.grade,
          section: p.section,
          status: p.status,
          icon: '🏁',
          color: skillColor,
          label: 'Entrega',
          tier: 'entrega'
        })
      }
    })

    return {
      events: evts,
      subjects: Array.from(subjectSet).sort(),
      legendItems: Array.from(legendSet.values())
    }
  }, [projects])

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!filterSubject) return events
    return events.filter(e => e.subject === filterSubject)
  }, [events, filterSubject])

  // ── Group by ISO Monday ────────────────────────────────────────────────────
  const { weekMap, sortedMondays, todayMonday } = useMemo(() => {
    const map = {}
    filtered.forEach(e => {
      const mon = isoMonday(e.date)
      if (!map[mon]) map[mon] = []
      map[mon].push(e)
    })
    // Sort events within each week by tier then date
    Object.values(map).forEach(arr =>
      arr.sort((a, b) => (TIER_ORDER[a.tier] ?? 3) - (TIER_ORDER[b.tier] ?? 3) || a.date.localeCompare(b.date))
    )
    const sorted = Object.keys(map).sort()
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    return { weekMap: map, sortedMondays: sorted, todayMonday: isoMonday(todayStr) }
  }, [filtered])

  // ── Auto-scroll to current week ────────────────────────────────────────────
  useEffect(() => {
    if (currentRef.current && scrollRef.current) {
      const container = scrollRef.current
      const el = currentRef.current
      const left = el.offsetLeft - container.offsetLeft - 20
      container.scrollTo({ left, behavior: 'smooth' })
    }
  }, [sortedMondays])

  if (events.length === 0) {
    return (
      <div className="nt-container" style={{ textAlign: 'center', padding: '24px 20px' }}>
        <p style={{ color: '#999', fontSize: 13 }}>
          Sin actividades con fecha en este período. Agrega fechas en las actividades de tus proyectos NEWS.
        </p>
      </div>
    )
  }

  const maxVisible = compact ? 3 : 99

  return (
    <div className={`nt-container${compact ? ' nt-compact' : ''}`}>
      {/* Header */}
      <div className="nt-header">
        <span style={{ fontSize: 18 }}>🗓</span>
        <span className="nt-title">Timeline del Período</span>
        <span className="nt-count">{filtered.length} eventos</span>
        {compact && onNavigateToFull && (
          <button onClick={onNavigateToFull}
            style={{
              marginLeft: 'auto', padding: '4px 12px', borderRadius: 8,
              border: '1.5px solid #dde6f8', background: 'white',
              color: '#1A3A8F', fontSize: 11, fontWeight: 700, cursor: 'pointer'
            }}>
            Ver completo →
          </button>
        )}
      </div>

      {/* Legend */}
      {!compact && (
        <div className="nt-legend">
          <span className="nt-legend-item" style={{ color: '#1A3A8F' }}>🏁 Entrega</span>
          {legendItems.map(li => (
            <span key={li.label} className="nt-legend-item" style={{ color: li.color }}>
              {li.icon} {li.label}
            </span>
          ))}
        </div>
      )}

      {/* Filters */}
      {!compact && subjects.length > 1 && (
        <div className="nt-filters">
          <button className={`nt-chip${!filterSubject ? ' nt-chip--active' : ''}`}
            onClick={() => setFilterSubject('')}>
            Todas
          </button>
          {subjects.map(s => (
            <button key={s} className={`nt-chip${filterSubject === s ? ' nt-chip--active' : ''}`}
              onClick={() => setFilterSubject(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Week cards scroll */}
      <div className="nt-scroll" ref={scrollRef}>
        {sortedMondays.map(mon => {
          const weekEvents = weekMap[mon]
          const isCurrent = mon === todayMonday
          const weekNum = getSchoolWeekNum(mon, sortedMondays)
          const visible = weekEvents.slice(0, maxVisible)
          const hidden = weekEvents.length - visible.length

          return (
            <div key={mon}
              ref={isCurrent ? currentRef : undefined}
              className={`nt-week${isCurrent ? ' nt-week--current' : ''}`}>
              {/* Week header */}
              <div className={`nt-week-hdr${isCurrent ? ' nt-week-hdr--current' : ''}`}>
                <div>
                  <span className="nt-week-label">Sem. {weekNum}</span>
                  {isCurrent && <span className="nt-week-badge">Esta</span>}
                </div>
                <span className="nt-week-range">{formatWeekRange(mon)}</span>
              </div>

              {/* Events */}
              <div className="nt-week-body">
                {visible.map(ev => (
                  <EventItem key={ev.id} event={ev}
                    selected={selectedEventId === ev.id}
                    onClick={() => onEventClick?.(ev)} />
                ))}
                {hidden > 0 && (
                  <div className="nt-more"
                    onClick={() => onNavigateToFull?.()}>
                    +{hidden} más...
                  </div>
                )}
                {weekEvents.length === 0 && (
                  <div className="nt-week-empty">Sin eventos</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Event Item ───────────────────────────────────────────────────────────────
function EventItem({ event, selected, onClick }) {
  const ev = event
  const tierClass = `nt-event--${ev.tier}`
  const borderColor = ev.color

  const tierStyle = ev.tier === 'entrega'
    ? { background: ev.color + '14', borderColor: ev.color + '50' }
    : ev.tier === 'high-stakes'
    ? { borderLeftColor: ev.color }
    : { borderLeftColor: ev.color, background: ev.color + '08' }

  return (
    <div className={`nt-event ${tierClass}${selected ? ' nt-event--selected' : ''}`}
      style={tierStyle}
      onClick={onClick}
      title={`${ev.nombre} — ${formatShortDate(ev.date)}${ev.porcentaje ? ` · ${ev.porcentaje}%` : ''}`}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {ev.tier === 'entrega' && (
          <span className="nt-event-badge" style={{ background: ev.color }}>
            🏁 ENTREGA
          </span>
        )}
        {ev.tier !== 'entrega' && <span className="nt-event-icon">{ev.icon}</span>}
        <span className="nt-event-name" style={{ color: ev.tier === 'entrega' ? ev.color : '#333' }}>
          {ev.tier === 'entrega' ? ev.projectTitle : ev.nombre}
        </span>
        {ev.porcentaje > 0 && (
          <span className="nt-event-pct" style={{ background: ev.color + '18', color: ev.color }}>
            {ev.porcentaje}%
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
        <span className="nt-event-date">{formatShortDate(ev.date)}</span>
        {ev.tier !== 'entrega' && (
          <span className="nt-event-project"
            style={{ background: ev.skillColor + '15', color: ev.skillColor }}>
            {ev.projectTitle.length > 18 ? ev.projectTitle.slice(0, 16) + '…' : ev.projectTitle}
          </span>
        )}
      </div>
    </div>
  )
}
