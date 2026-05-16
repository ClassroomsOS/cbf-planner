// ── PatternPicker.jsx ─────────────────────────────────────────────────────────
// Slide-over panel for browsing and selecting activity patterns.
//
// Features:
//   • All patterns organized by family (Input, Processing, Output, Activation, Assessment)
//   • Contextual help panel: why it works, teacher steps, student steps
//   • AI suggestions highlighted with ⭐ based on sectionMeta + subject + skills
//   • Clicking a pattern calls onSelect(pattern) and closes the picker

import { useState } from 'react'
import {
  ACTIVITY_PATTERNS,
  PATTERN_FAMILIES,
  suggestPatterns,
} from '../../utils/activityPatterns'

const FAMILY_META = {
  [PATTERN_FAMILIES.INPUT]:      { label: { es: 'Entrada (I DO)',        en: 'Input (I DO)'          }, color: '#1B3564', bg: '#EEF3FA', phase: 'I DO'   },
  [PATTERN_FAMILIES.PROCESSING]: { label: { es: 'Procesamiento (WE DO)', en: 'Processing (WE DO)'    }, color: '#16A34A', bg: '#F0FDF4', phase: 'WE DO'  },
  [PATTERN_FAMILIES.OUTPUT]:     { label: { es: 'Producción (YOU DO)',    en: 'Output (YOU DO)'       }, color: '#7c3aed', bg: '#F5F3FF', phase: 'YOU DO' },
  [PATTERN_FAMILIES.ACTIVATION]: { label: { es: 'Activación',            en: 'Activation'            }, color: '#B45309', bg: '#FFFBEB', phase: null      },
  [PATTERN_FAMILIES.ASSESSMENT]: { label: { es: 'Cierre / Evaluación',   en: 'Closing / Assessment'  }, color: '#0891B2', bg: '#F0F9FF', phase: null      },
}

const SKILL_ICONS = {
  speaking:         '🎤',
  listening:        '🎧',
  reading:          '📖',
  writing:          '✍️',
  grammar:          '✏️',
  vocabulary:       '🔤',
  'critical-thinking': '💭',
  kinesthetic:      '🏃',
}

export default function PatternPicker({ onSelect, onClose, aiContext = {} }) {
  const [activeFamily, setActiveFamily] = useState(PATTERN_FAMILIES.PROCESSING)
  const [detail,       setDetail]       = useState(null)   // pattern being previewed
  const [lang,         setLang]         = useState('es')

  // Build AI suggestions based on context
  const suggested = suggestPatterns({
    skills:   aiContext.skills   || [],
    keywords: aiContext.keywords || [],
    family:   null,
  })
  const suggestedIds = new Set(suggested.slice(0, 4).map(p => p.id))

  const families = Object.values(PATTERN_FAMILIES)
  const visiblePatterns = ACTIVITY_PATTERNS.filter(p => p.family === activeFamily)

  function handleSelect(pattern) {
    onSelect(pattern)
    onClose()
  }

  return (
    <div className="pp-overlay" role="dialog" aria-modal="true" aria-label="Selector de patrones de actividad">
      <div className="pp-panel">

        {/* ── Header ── */}
        <div className="pp-header">
          <div className="pp-header-left">
            <h2 className="pp-title">Patrones de Actividad</h2>
            <p className="pp-subtitle">Estructuras probadas que se llenan con tu contenido</p>
          </div>
          <div className="pp-header-right">
            <button
              className={`pp-lang-btn ${lang === 'es' ? 'active' : ''}`}
              onClick={() => setLang('es')}
            >ES</button>
            <button
              className={`pp-lang-btn ${lang === 'en' ? 'active' : ''}`}
              onClick={() => setLang('en')}
            >EN</button>
            <button className="pp-close-btn" onClick={onClose} aria-label="Cerrar">✕</button>
          </div>
        </div>

        {/* ── AI suggestions strip ── */}
        {suggested.length > 0 && (
          <div className="pp-ai-strip">
            <span className="pp-ai-label">⭐ Sugeridos para esta sección:</span>
            {suggested.slice(0, 3).map(p => (
              <button key={p.id} className="pp-ai-chip" onClick={() => setDetail(p)}>
                {p.icon} {p.name[lang]}
              </button>
            ))}
          </div>
        )}

        <div className="pp-body">
          {/* ── Family tabs ── */}
          <div className="pp-families">
            {families.map(fam => {
              const meta = FAMILY_META[fam]
              const count = ACTIVITY_PATTERNS.filter(p => p.family === fam).length
              return (
                <button
                  key={fam}
                  className={`pp-family-tab ${activeFamily === fam ? 'active' : ''}`}
                  style={{ '--fam-color': meta.color, '--fam-bg': meta.bg }}
                  onClick={() => { setActiveFamily(fam); setDetail(null) }}
                >
                  <span className="pp-family-name">{meta.label[lang]}</span>
                  {meta.phase && <span className="pp-family-phase">{meta.phase}</span>}
                  <span className="pp-family-count">{count}</span>
                </button>
              )
            })}
          </div>

          {/* ── Pattern list + detail panel ── */}
          <div className="pp-content">

            {/* Pattern list */}
            <div className="pp-list">
              {visiblePatterns.map(pattern => {
                const isSuggested = suggestedIds.has(pattern.id)
                const isActive    = detail?.id === pattern.id
                const fmeta       = FAMILY_META[pattern.family]
                return (
                  <div
                    key={pattern.id}
                    className={`pp-card ${isActive ? 'active' : ''} ${isSuggested ? 'suggested' : ''}`}
                    style={{ '--card-color': fmeta.color }}
                    onClick={() => setDetail(detail?.id === pattern.id ? null : pattern)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter') setDetail(pattern) }}
                    aria-expanded={isActive}
                  >
                    <div className="pp-card-top">
                      <span className="pp-card-icon">{pattern.icon}</span>
                      <div className="pp-card-info">
                        <span className="pp-card-name">
                          {isSuggested && <span className="pp-star">⭐</span>}
                          {pattern.name[lang]}
                        </span>
                        <div className="pp-card-meta">
                          <span className="pp-card-grouping">
                            {pattern.grouping === 'pairs' ? '👥 Parejas' :
                             pattern.grouping === 'whole-class' ? '🏫 Clase entera' :
                             pattern.grouping === 'individual' ? '🧑 Individual' :
                             pattern.grouping === 'teams' ? '⚽ Equipos' : pattern.grouping}
                          </span>
                          <span className="pp-card-duration">
                            ⏱ {pattern.duration.typical} min
                          </span>
                        </div>
                        <div className="pp-card-skills">
                          {(pattern.skills || []).map(s => (
                            <span key={s} className="pp-skill-chip">{SKILL_ICONS[s] || '📌'} {s}</span>
                          ))}
                        </div>
                      </div>
                      <span className="pp-card-arrow">{isActive ? '▲' : '▼'}</span>
                    </div>

                    {/* Inline description when active */}
                    {isActive && (
                      <p className="pp-card-desc">{pattern.description[lang]}</p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Detail panel */}
            {detail && (
              <div className="pp-detail" style={{ '--detail-color': FAMILY_META[detail.family].color }}>
                <div className="pp-detail-header">
                  <span className="pp-detail-icon">{detail.icon}</span>
                  <div>
                    <h3 className="pp-detail-title">{detail.name[lang]}</h3>
                    <p className="pp-detail-desc">{detail.description[lang]}</p>
                  </div>
                </div>

                {/* Why it works */}
                <div className="pp-detail-section pp-detail-why">
                  <h4>¿Por qué funciona?</h4>
                  <p>{detail.whyItWorks[lang]}</p>
                </div>

                {/* Teacher steps */}
                <div className="pp-detail-section">
                  <h4>📋 Pasos del docente</h4>
                  <div className="pp-steps">
                    {Object.entries(detail.teacherSteps).map(([phase, text]) => (
                      <div key={phase} className="pp-step-item">
                        <span className="pp-step-phase">
                          {phase === 'before' ? 'Antes' : phase === 'during' ? 'Durante' : 'Después'}
                        </span>
                        <p>{text[lang]}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Student steps */}
                <div className="pp-detail-section">
                  <h4>🧑‍🎓 Pasos del estudiante</h4>
                  <ol className="pp-student-steps">
                    {(detail.studentSteps || []).map((step, idx) => (
                      <li key={idx}>{step[lang]}</li>
                    ))}
                  </ol>
                </div>

                {/* Duration + grouping */}
                <div className="pp-detail-chips">
                  <span className="pp-detail-chip">
                    ⏱ {detail.duration.min}–{detail.duration.max} min (típico: {detail.duration.typical} min)
                  </span>
                  <span className="pp-detail-chip">
                    {detail.grouping === 'pairs' ? '👥 Parejas' :
                     detail.grouping === 'whole-class' ? '🏫 Clase entera' :
                     detail.grouping === 'individual' ? '🧑 Individual' :
                     detail.grouping === 'teams' ? '⚽ Equipos' : detail.grouping}
                  </span>
                </div>

                <button
                  className="pp-select-btn"
                  onClick={() => handleSelect(detail)}
                >
                  Usar este patrón →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
