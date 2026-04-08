import { useState, memo } from 'react'
import useEleot, { ELEOT_DOMAINS, domainStatus } from '../hooks/useEleot'

// ── EleotCoveragePanel ───────────────────────────────────────────────────────
// Muestra cobertura eleot® en tiempo real basada en los Smart Blocks
// de la guía actual. Colapsable. Se integra en GuideEditorPage.
//
// Props:
//   content   — lesson_plan.content JSONB
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  covered: { icon: '✓', label: 'cubierto', color: '#1A6B3A', bg: '#f0fff4', border: '#b8e8c8' },
  partial: { icon: '◎', label: 'parcial',  color: '#B8860B', bg: '#fffbeb', border: '#e8d5a0' },
  weak:    { icon: '⚠', label: 'débil',    color: '#CC4E10', bg: '#fff5f0', border: '#f0c8b8' },
}

function DomainRow({ domainId, score }) {
  const [hovered, setHovered] = useState(false)
  const domain = ELEOT_DOMAINS[domainId]
  const status = domainStatus(score)
  const cfg    = STATUS_CONFIG[status]
  const pct    = Math.round(score * 100)
  const barPct = Math.min(pct, 100)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0',
        borderRadius: 4, cursor: 'default',
      }}
    >
      {/* Domain letter */}
      <span style={{
        width: 18, height: 18, borderRadius: 4, display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 10, fontWeight: 900, flexShrink: 0,
        background: domain.color, color: '#fff',
      }}>
        {domainId}
      </span>

      {/* Label */}
      <span style={{
        fontSize: 10, color: '#555', width: 80, flexShrink: 0, fontWeight: 500,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {hovered ? domain.full : domain.label}
      </span>

      {/* Bar */}
      <div style={{ flex: 1, height: 6, background: '#eee', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3,
          width: `${barPct}%`,
          background: status === 'covered' ? domain.color
                    : status === 'partial' ? `${domain.color}99`
                    : '#ddd',
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Status icon */}
      <span style={{
        fontSize: 10, fontWeight: 700, color: cfg.color,
        width: 14, textAlign: 'center', flexShrink: 0,
      }}>
        {cfg.icon}
      </span>
    </div>
  )
}

const EleotCoveragePanel = memo(function EleotCoveragePanel({ content }) {
  const [collapsed, setCollapsed] = useState(false)
  const { coverage, weakDomains, blockCount, suggestions, overallScore } = useEleot(content)

  const hasBlocks = blockCount > 0
  const overallPct = Math.round(overallScore * 100)

  return (
    <div style={{
      borderTop: '1px solid #e8e8e8',
      background: '#fafafa',
      fontSize: 11,
    }}>
      {/* ── Header (always visible) ── */}
      <button
        onClick={() => setCollapsed(p => !p)}
        style={{
          width: '100%', padding: '8px 10px', background: 'transparent', border: 'none',
          display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 12, flexShrink: 0 }}>📊</span>
        <span style={{ flex: 1, fontSize: 10, fontWeight: 800, color: '#1F3864', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          eleot®
        </span>

        {/* Overall score pill */}
        {hasBlocks && (
          <span style={{
            fontSize: 9, fontWeight: 800,
            color: overallPct >= 65 ? '#1A6B3A' : overallPct >= 40 ? '#B8860B' : '#CC4E10',
            background: overallPct >= 65 ? '#f0fff4' : overallPct >= 40 ? '#fffbeb' : '#fff5f0',
            border: `1px solid ${overallPct >= 65 ? '#b8e8c8' : overallPct >= 40 ? '#e8d5a0' : '#f0c8b8'}`,
            borderRadius: 8, padding: '1px 6px', flexShrink: 0,
          }}>
            {overallPct}%
          </span>
        )}

        {/* Weak domain badges */}
        {weakDomains.length > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 700, color: '#CC4E10',
            background: '#fff5f0', border: '1px solid #f0c8b8',
            borderRadius: 8, padding: '1px 5px', flexShrink: 0,
          }}>
            ⚠ {weakDomains.join(' ')}
          </span>
        )}

        <span style={{
          fontSize: 10, color: '#999', flexShrink: 0,
          transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
          transition: 'transform 0.2s', display: 'inline-block',
        }}>▾</span>
      </button>

      {/* ── Body (collapsible) ── */}
      {!collapsed && (
        <div style={{ padding: '0 10px 10px' }}>

          {!hasBlocks ? (
            <div style={{ fontSize: 10, color: '#aaa', fontStyle: 'italic', textAlign: 'center', padding: '6px 0' }}>
              Agrega Smart Blocks para ver cobertura
            </div>
          ) : (
            <>
              {/* Domain bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 }}>
                {Object.keys(ELEOT_DOMAINS).map(d => (
                  <DomainRow key={d} domainId={d} score={coverage[d] || 0} />
                ))}
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <span key={key} style={{ fontSize: 9, color: cfg.color, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontWeight: 700 }}>{cfg.icon}</span> {cfg.label}
                  </span>
                ))}
                <span style={{ fontSize: 9, color: '#aaa', marginLeft: 'auto' }}>
                  {blockCount} bloque{blockCount !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Suggestions for weak domains */}
              {suggestions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {suggestions.map(({ domain, domainLabel, suggestion }) => (
                    <div key={domain} style={{
                      background: '#fff5f0', border: '1px solid #f0c8b8',
                      borderRadius: 6, padding: '5px 8px',
                      fontSize: 10, color: '#7a2a10', lineHeight: 1.4,
                    }}>
                      <strong>{domain} {domainLabel}</strong> débil —{' '}
                      considera agregar{' '}
                      <span style={{ fontWeight: 700 }}>{suggestion?.label}</span>
                      {suggestion?.reason && (
                        <span style={{ color: '#a05030' }}> ({suggestion.reason})</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* All covered celebration */}
              {weakDomains.length === 0 && (
                <div style={{
                  fontSize: 10, color: '#1A6B3A', background: '#f0fff4',
                  border: '1px solid #b8e8c8', borderRadius: 6, padding: '4px 8px',
                  textAlign: 'center', fontWeight: 600,
                }}>
                  ✓ Todos los dominios cubiertos
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
})

export default EleotCoveragePanel
