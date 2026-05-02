// ── RadarChart.jsx ─────────────────────────────────────────────────────────────
// SVG hexagonal radar chart for 6 stats.
// Adapted for glass/acrylic cards (dark text on semi-transparent background).

const LABELS = [
  { key: 'aca', label: 'ACA', full: 'Academico' },
  { key: 'par', label: 'PAR', full: 'Participacion' },
  { key: 'cre', label: 'CRE', full: 'Creatividad' },
  { key: 'lid', label: 'LID', full: 'Liderazgo' },
  { key: 'dis', label: 'DIS', full: 'Disciplina' },
  { key: 'col', label: 'COL', full: 'Colaboracion' },
]

const SIZE = 140
const CENTER = SIZE / 2
const RADIUS = 52
const LEVELS = [0.25, 0.5, 0.75, 1.0]

function polarToXY(angle, radius) {
  const rad = (angle - 90) * (Math.PI / 180)
  return [CENTER + radius * Math.cos(rad), CENTER + radius * Math.sin(rad)]
}

function getPoints(values, radius) {
  return LABELS.map((_, i) => {
    const angle = (360 / 6) * i
    const val = (values[i] || 0) / 99
    return polarToXY(angle, radius * val)
  })
}

export default function RadarChart({ stats = {}, tier = 'base', size = SIZE }) {
  const values = LABELS.map(l => stats[l.key] || 0)
  const dataPoints = getPoints(values, RADIUS)
  const polygon = dataPoints.map(p => p.join(',')).join(' ')

  const tierColors = {
    gold:   { stroke: '#b8860b', fill: 'rgba(255,215,0,0.18)', glow: 'rgba(255,215,0,0.3)' },
    silver: { stroke: '#475569', fill: 'rgba(71,85,105,0.12)', glow: 'rgba(71,85,105,0.2)' },
    bronze: { stroke: '#92400e', fill: 'rgba(205,127,50,0.15)', glow: 'rgba(205,127,50,0.25)' },
    base:   { stroke: '#1d4ed8', fill: 'rgba(29,78,216,0.12)', glow: 'rgba(29,78,216,0.2)' },
  }
  const tc = tierColors[tier] || tierColors.base

  return (
    <svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`} className="sp-radar-svg">
      {/* Grid levels */}
      {LEVELS.map((lv, li) => {
        const pts = LABELS.map((_, i) => {
          const angle = (360 / 6) * i
          return polarToXY(angle, RADIUS * lv).join(',')
        }).join(' ')
        return (
          <polygon
            key={li}
            points={pts}
            fill="none"
            stroke="rgba(0,0,0,0.06)"
            strokeWidth="0.6"
          />
        )
      })}

      {/* Axis lines */}
      {LABELS.map((_, i) => {
        const angle = (360 / 6) * i
        const [x, y] = polarToXY(angle, RADIUS)
        return (
          <line
            key={i}
            x1={CENTER} y1={CENTER}
            x2={x} y2={y}
            stroke="rgba(0,0,0,0.05)"
            strokeWidth="0.5"
          />
        )
      })}

      {/* Data polygon */}
      <polygon
        points={polygon}
        fill={tc.fill}
        stroke={tc.stroke}
        strokeWidth="1.8"
        style={{ filter: `drop-shadow(0 0 6px ${tc.glow})` }}
      />

      {/* Data points */}
      {dataPoints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill={tc.stroke} />
      ))}

      {/* Labels */}
      {LABELS.map((l, i) => {
        const angle = (360 / 6) * i
        const [x, y] = polarToXY(angle, RADIUS + 14)
        return (
          <text
            key={l.key}
            x={x} y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(0,0,0,0.5)"
            fontSize="7"
            fontWeight="600"
            fontFamily="system-ui, sans-serif"
          >
            {l.label}
          </text>
        )
      })}

      {/* Value numbers */}
      {LABELS.map((l, i) => {
        const angle = (360 / 6) * i
        const [x, y] = polarToXY(angle, RADIUS + 22)
        return (
          <text
            key={`v_${l.key}`}
            x={x} y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(0,0,0,0.35)"
            fontSize="6"
            fontFamily="system-ui, sans-serif"
          >
            {values[i]}
          </text>
        )
      })}
    </svg>
  )
}

export { LABELS }
