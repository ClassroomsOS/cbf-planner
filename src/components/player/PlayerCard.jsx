// ── PlayerCard.jsx ─────────────────────────────────────────────────────────────
// FIFA Ultimate Team style student card.
// Props: student, stats, photoUrl, onClick

import RadarChart from './RadarChart'

function getTier(rating) {
  if (rating >= 90) return 'gold'
  if (rating >= 75) return 'silver'
  if (rating >= 60) return 'bronze'
  return 'base'
}

function getInitials(student) {
  const f = student.first_name?.[0] || ''
  const l = student.first_lastname?.[0] || ''
  return (f + l).toUpperCase()
}

export default function PlayerCard({ student, stats = {}, photoUrl, overall = 0, badges, onClick }) {
  const tier = getTier(overall)
  const displayName = `${student.first_lastname || ''} ${student.first_name || ''}`.trim()

  return (
    <div className={`sp-card sp-card--${tier}`} onClick={onClick} role="button" tabIndex={0}>
      {/* Shimmer overlay for gold/silver */}
      {(tier === 'gold' || tier === 'silver') && <div className="sp-card-shimmer" />}

      {/* Overall Rating */}
      <div className="sp-card-rating">
        <span className="sp-card-rating-num">{overall}</span>
      </div>

      {/* Activity badges */}
      {badges && (badges.pending > 0 || badges.late > 0) && (
        <div className="sp-card-badges">
          {badges.pending > 0 && (
            <span className="sp-card-badge sp-card-badge--pending">{badges.pending}</span>
          )}
          {badges.late > 0 && (
            <span className="sp-card-badge sp-card-badge--late">{badges.late}</span>
          )}
        </div>
      )}

      {/* Avatar */}
      <div className="sp-card-avatar">
        {photoUrl ? (
          <img src={photoUrl} alt={displayName} className="sp-card-photo" />
        ) : (
          <div className="sp-card-initials">{getInitials(student)}</div>
        )}
      </div>

      {/* Name & info */}
      <div className="sp-card-name">{displayName}</div>
      <div className="sp-card-info">
        {student.grade} {student.section}
        {stats.dominant_skill && <span className="sp-card-skill"> · {stats.dominant_skill}</span>}
      </div>

      {/* Radar */}
      <div className="sp-card-radar">
        <RadarChart stats={stats} tier={tier} size={120} />
      </div>

      {/* Stat row */}
      <div className="sp-card-stats-row">
        <StatMini label="ACA" value={stats.aca} />
        <StatMini label="PAR" value={stats.par} />
        <StatMini label="CRE" value={stats.cre} />
        <StatMini label="LID" value={stats.lid} />
        <StatMini label="DIS" value={stats.dis} />
        <StatMini label="COL" value={stats.col} />
      </div>
    </div>
  )
}

function StatMini({ label, value = 0 }) {
  return (
    <div className="sp-stat-mini">
      <span className="sp-stat-mini-val">{value}</span>
      <span className="sp-stat-mini-lbl">{label}</span>
    </div>
  )
}

export { getTier, getInitials }
