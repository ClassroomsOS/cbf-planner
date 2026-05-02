// ── RadarChart.jsx ─────────────────────────────────────────────────────────────
// SVG hexagonal radar chart for 6 stats (FIFA-style).
// Props: stats = { aca, par, cre, lid, dis, col } — each 0-99

const LABELS = [
  { key: 'aca', label: 'ACA', full: 'Académico' },
  { key: 'par', label: 'PAR', full: 'Participación' },
  { key: 'cre', label: 'CRE', full: 'Creatividad' },
  { key: 'lid', label: 'LID', full: 'Liderazgo' },
  { key: 'dis', label: 'DIS', full: 'Disciplina' },
  { key: 'col', label: 'COL', full: 'Colaboración' },
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
    gold: { stroke: '#FFD700', fill: 'rgba(255,215,0,0.15)', glow: 'rgba(255,215,0,0.4)' },
    silver: { stroke: '#A0AEC0', fill: 'rgba(160,174,192,0.12)', glow: 'rgba(160,174,192,0.3)' },
    bronze: { stroke: '#CD7F32', fill: 'rgba(205,127,50,0.12)', glow: 'rgba(205,127,50,0.3)' },
    base: { stroke: '#60A5FA', fill: 'rgba(96,165,250,0.12)', glow: 'rgba(96,165,250,0.3)' },
  }
  const tc = tierColors[tier] || tierColors.base

  const scale = size / SIZE

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
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="0.5"
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
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="0.5"
          />
        )
      })}

      {/* Data polygon */}
      <polygon
        points={polygon}
        fill={tc.fill}
        stroke={tc.stroke}
        strokeWidth="1.5"
        style={{ filter: `drop-shadow(0 0 4px ${tc.glow})` }}
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
            fill="rgba(255,255,255,0.7)"
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
            fill="rgba(255,255,255,0.5)"
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
