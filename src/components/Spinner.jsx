/**
 * Spinner — inline animated circle for buttons and loading states.
 * Usage: <Spinner /> or <Spinner size={16} color="white" />
 *        <ProgressRing pct={65} size={48} />  ← SVG ring with percentage
 */

export function Spinner({ size = 14, color = 'currentColor', style = {} }) {
  return (
    <span
      className="cbf-spinner"
      style={{
        width: size, height: size,
        borderColor: `${color} ${color} ${color} transparent`,
        ...style,
      }}
    />
  )
}

export function ProgressRing({ pct = 0, size = 56, stroke = 4, color = '#2E5598', label = '' }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = circ * (pct / 100)
  return (
    <div className="cbf-progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e8edf5" strokeWidth={stroke} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.3s ease' }}
        />
      </svg>
      <div className="cbf-ring-label">{label || `${pct}%`}</div>
    </div>
  )
}

export function ProgressBar({ pct = 0, color = '#2E5598', label = '', height = 6 }) {
  return (
    <div className="cbf-progress-bar-wrap">
      {label && <div className="cbf-progress-bar-label">{label}</div>}
      <div className="cbf-progress-bar-track" style={{ height }}>
        <div
          className="cbf-progress-bar-fill"
          style={{ width: `${pct}%`, background: color, height, transition: 'width 0.3s ease' }}
        />
      </div>
      <div className="cbf-progress-bar-pct">{pct}%</div>
    </div>
  )
}
