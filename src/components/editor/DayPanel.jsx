import { useState, useRef } from 'react'
import { useFeatures } from '../../context/FeaturesContext'
import { SECTIONS, RICH_SECTIONS } from '../../utils/constants'
import { getDayName, formatDateEN } from '../../utils/dateUtils'
import { buildEmptySection } from '../../utils/guideEditorUtils'
import LayoutSelectorModal, { LAYOUT_ELIGIBLE } from '../LayoutSelectorModal'
import RichEditor from '../RichEditor'
import ImageUploader from '../ImageUploader'
import { SmartBlocksList } from '../SmartBlocks'
import { AISuggestButton } from '../AIComponents'
import SectionPreview from '../SectionPreview'

// ── VideoList ─────────────────────────────────────────────────────────────────

function getEmbedUrl(url) {
  if (!url) return null
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vi = url.match(/vimeo\.com\/(\d+)/)
  if (vi) return `https://player.vimeo.com/video/${vi[1]}`
  return null
}

function VideoList({ videos = [], onChange }) {
  function addVideo() {
    onChange([...videos, { url: '', label: '' }])
  }
  function updateVideo(idx, field, value) {
    onChange(videos.map((v, i) => i === idx ? { ...v, [field]: value } : v))
  }
  function removeVideo(idx) {
    onChange(videos.filter((_, i) => i !== idx))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {videos.map((v, idx) => {
        const embedUrl = getEmbedUrl(v.url)
        return (
          <div key={idx} style={{ border: '1px solid #c5d5f0', borderRadius: '8px', padding: '10px', background: '#f8faff' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
              <input
                type="url"
                placeholder="URL de YouTube o Vimeo"
                value={v.url || ''}
                onChange={e => updateVideo(idx, 'url', e.target.value)}
                style={{ flex: 1, fontSize: '12px', padding: '5px 8px', borderRadius: '6px', border: '1px solid #c5d5f0' }}
              />
              <input
                type="text"
                placeholder="Título (opcional)"
                value={v.label || ''}
                onChange={e => updateVideo(idx, 'label', e.target.value)}
                style={{ width: '140px', fontSize: '12px', padding: '5px 8px', borderRadius: '6px', border: '1px solid #c5d5f0' }}
              />
              <button
                onClick={() => removeVideo(idx)}
                style={{ background: '#fee', border: '1px solid #fcc', borderRadius: '6px', padding: '4px 8px', color: '#c00', cursor: 'pointer', fontWeight: 700 }}>
                ✕
              </button>
            </div>
            {embedUrl ? (
              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '6px' }}>
                <iframe
                  src={embedUrl}
                  frameBorder="0"
                  allowFullScreen
                  title={v.label || 'Video'}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                />
              </div>
            ) : v.url ? (
              <div style={{ fontSize: '11px', color: '#e07000', padding: '4px 0' }}>⚠️ URL no reconocida — usa un link de YouTube o Vimeo</div>
            ) : null}
          </div>
        )
      })}
      <button
        onClick={addVideo}
        style={{ alignSelf: 'flex-start', fontSize: '12px', padding: '5px 12px', borderRadius: '7px',
                 border: '1px solid #c5d5f0', background: '#f0f4ff', color: '#2E5598', cursor: 'pointer', fontWeight: 600 }}>
        + Agregar video
      </button>
    </div>
  )
}

// ── DayPanel ─────────────────────────────────────────────────────────────────

export default function DayPanel({ iso, day, setContentField, toggleDayActive, openSections, toggleSection, planId, grade, subject, objective, principles }) {
  const { features } = useFeatures()
  const base = ['days', iso]
  const [layoutModal,    setLayoutModal]    = useState(null)
  const [sectionPreviews, setSectionPreviews] = useState({})
  const sectionRefs = useRef({})

  function togglePreview(key) {
    setSectionPreviews(p => ({ ...p, [key]: !p[key] }))
  }

  function jumpToSection(s) {
    const sKey = `${iso}-${s.key}`
    if (!openSections[sKey]) toggleSection(sKey)
    setTimeout(() => {
      sectionRefs.current[s.key]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  function getContentPeek(html) {
    if (!html) return ''
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return text.length > 64 ? text.slice(0, 64) + '…' : text
  }

  function wordCount(html) {
    if (!html) return 0
    return html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length
  }

  return (
    <div className="card">
      <div className="ge-day-header" style={{ background: '#1F3864', color: '#fff' }}>
        📅 {getDayName(iso)} — {formatDateEN(iso)}
      </div>

      <div className="ge-toggle-row">
        <input type="checkbox" id={`active-${iso}`}
          checked={day.active !== false}
          onChange={e => toggleDayActive(iso, e.target.checked)} />
        <label htmlFor={`active-${iso}`}>Hay clase este día</label>
      </div>

      {day.active === false ? (
        <div className="coming-soon-notice">
          ⚠️ Sin clase este día. Activa la casilla para agregar contenido.
        </div>
      ) : (
        <>
          <div className="ge-grid-3" style={{ marginBottom: '14px' }}>
            <div className="ge-field">
              <label>Períodos / Horario</label>
              <input type="text" value={day.class_periods || ''}
                placeholder="Ej: 1st+4th (2 hrs)"
                onChange={e => setContentField([...base,'class_periods'], e.target.value)} />
            </div>
            <div className="ge-field">
              <label>Asignatura / Unidad</label>
              <input type="text" value={day.unit || ''}
                placeholder="Ej: Unit 1 – Tell Me About It!"
                onChange={e => setContentField([...base,'unit'], e.target.value)} />
            </div>
            <div className="ge-field">
              <label>Fecha (etiqueta)</label>
              <input type="text" value={day.date_label || formatDateEN(iso)}
                onChange={e => setContentField([...base,'date_label'], e.target.value)} />
            </div>
          </div>

          {/* ── Sticky section navigator ── */}
          <div className="ge-section-nav">
            {SECTIONS.map(s => {
              const sKey     = `${iso}-${s.key}`
              const section  = day.sections?.[s.key]
              const hasContent = !!(section?.content || (section?.images||[]).length || (section?.smartBlocks||[]).length)
              return (
                <button
                  key={s.key}
                  className={`ge-section-nav-pill ${openSections[sKey] ? 'active' : ''}`}
                  style={{ '--pill-color': s.hex }}
                  onClick={() => jumpToSection(s)}
                  title={s.label}
                >
                  <span className={`ge-nav-dot ${hasContent ? 'filled' : ''}`} />
                  {s.short}
                </button>
              )
            })}
          </div>

          {SECTIONS.map(s => {
            const sKey    = `${iso}-${s.key}`
            const isOpen  = openSections[sKey]
            const section = day.sections?.[s.key] || buildEmptySection(s.time)
            const peek    = getContentPeek(section.content)
            const sbCount  = (section.smartBlocks || []).length
            const imgCount = (section.images      || []).length
            const vidCount = (section.videos      || []).length
            const hasContent = !!(section.content || imgCount || sbCount)
            const wc = wordCount(section.content)
            const showPreview = sectionPreviews[s.key]

            return (
              <div key={s.key} className="ge-section-block"
                ref={el => sectionRefs.current[s.key] = el}>

                {/* ── Header ── */}
                <div className={`ge-section-hdr ${isOpen ? 'open' : ''}`}
                  style={{ background: s.hex }}
                  onClick={() => toggleSection(sKey)}
                  tabIndex={0}
                  role="button"
                  aria-expanded={isOpen}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(sKey) } }}>

                  {isOpen ? (
                    <>
                      <div className="ge-section-hdr-left">
                        <span className="ge-section-label">{s.label}</span>
                        <span className="ge-section-time">{section.time || s.time}</span>
                      </div>
                      <span className="ge-section-arrow">▲</span>
                    </>
                  ) : (
                    <>
                      <div className="ge-section-hdr-left">
                        <span className={`ge-section-status-dot ${hasContent ? 'done' : ''}`} />
                        <span className="ge-section-label">{s.label}</span>
                        {peek && <span className="ge-section-peek">{peek}</span>}
                      </div>
                      <div className="ge-section-hdr-right">
                        {sbCount  > 0 && <span className="ge-chip">🧩 {sbCount}</span>}
                        {imgCount > 0 && <span className="ge-chip">🖼 {imgCount}</span>}
                        {vidCount > 0 && <span className="ge-chip">🎬 {vidCount}</span>}
                        <span className="ge-section-arrow">▼</span>
                      </div>
                    </>
                  )}
                </div>

                {/* ── Animated body ── */}
                <div className={`ge-section-body-wrap ${isOpen ? 'open' : ''}`}>
                  <div className="ge-section-body">

                    <div className="ge-field" style={{ maxWidth: '180px' }}>
                      <label>Tiempo estimado</label>
                      <input type="text" value={section.time || s.time}
                        onChange={e => setContentField([...base,'sections',s.key,'time'], e.target.value)} />
                    </div>

                    <div className="ge-field">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label style={{ margin: 0 }}>Contenido / Actividades</label>
                        <button
                          onClick={e => { e.stopPropagation(); togglePreview(s.key) }}
                          style={{
                            fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                            border: '1px solid #c5d5f0', background: showPreview ? '#f0f4ff' : '#fff',
                            color: '#2E5598', cursor: 'pointer', fontWeight: 600,
                          }}>
                          {showPreview ? '👁 Ocultar preview' : '👁 Ver preview'}
                        </button>
                      </div>
                      <RichEditor
                        value={section.content || ''}
                        onChange={val => setContentField([...base,'sections',s.key,'content'], val)}
                        placeholder="Describe las actividades de esta sección…"
                        minHeight={120}
                      />
                      {wc > 0 && (
                        <div className="ge-word-count">{wc} palabra{wc !== 1 ? 's' : ''}</div>
                      )}
                      {features.wysiwyg !== false && showPreview && (section.content || imgCount > 0) && (
                        <SectionPreview section={section} sectionMeta={s} />
                      )}
                    </div>

                    {/* ── Sugerencia IA, imágenes, SmartBlocks y video — solo en RICH_SECTIONS ── */}
                    {RICH_SECTIONS.includes(s.key) && <>
                      {features.ai_suggest !== false && <AISuggestButton
                        section={s}
                        grade={grade}
                        subject={subject}
                        objective={objective}
                        unit={day.unit}
                        dayName={getDayName(iso)}
                        existingContent={section.content}
                        onInsert={val => setContentField([...base,'sections',s.key,'content'], val)}
                        principles={principles}
                      />}

                      <div className="ge-field">
                        <label>Imágenes</label>
                        <ImageUploader
                          planId={planId}
                          dayIso={iso}
                          sectionKey={s.key}
                          images={section.images || []}
                          onChange={imgs => setContentField([...base,'sections',s.key,'images'], imgs)}
                        />
                      </div>
                      <div className="ge-field">
                        <label>🧩 Bloques Inteligentes</label>
                        <SmartBlocksList
                          blocks={section.smartBlocks || []}
                          onChange={blocks => setContentField([...base,'sections',s.key,'smartBlocks'], blocks)}
                          aiContext={{
                            sectionMeta:     s,
                            grade,
                            subject,
                            objective,
                            unit:            day.unit,
                            dayName:         getDayName(iso),
                            existingContent: section.content,
                            principles,
                          }}
                        />
                      </div>
                      <div className="ge-field">
                        <label>🎬 Videos (YouTube / Vimeo)</label>
                        <VideoList
                          videos={section.videos || []}
                          onChange={vids => setContentField([...base,'sections',s.key,'videos'], vids)}
                        />
                      </div>
                    </>}

                    {/* ── Layout visual (solo secciones elegibles) ── */}
                    {LAYOUT_ELIGIBLE.includes(s.key) && (
                      <div style={{ marginTop: '6px', paddingTop: '10px', borderTop: '1px dashed #dde3f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '12px', color: '#888' }}>
                            {(() => {
                              const l = section.image_layout || (section.layout_mode === 'side' ? 'right' : section.layout_mode === 'stack' ? 'below' : null)
                              return l === 'below' ? 'Imágenes abajo' : l === 'right' ? 'Texto | Imágenes' : l === 'left' ? 'Imágenes | Texto' : 'Sin distribución configurada'
                            })()}
                          </span>
                          <button
                            style={{
                              fontSize: '12px', padding: '4px 12px', borderRadius: '7px',
                              border: '1px solid #4BACC6', background: '#f0faff',
                              color: '#2E5598', cursor: 'pointer', fontWeight: 600,
                            }}
                            onClick={() => setLayoutModal({ sectionKey: s.key, sectionLabel: s.label })}>
                            🖼 Distribuir imágenes
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )
          })}
        </>
      )}

      {/* ── Layout Selector Modal ── */}
      {layoutModal && (
        <LayoutSelectorModal
          isOpen={!!layoutModal}
          onClose={() => setLayoutModal(null)}
          onConfirm={({ image_layout }) => {
            setContentField([...base, 'sections', layoutModal.sectionKey, 'image_layout'], image_layout)
          }}
          sectionLabel={layoutModal.sectionLabel}
          currentLayout={day.sections?.[layoutModal.sectionKey]?.image_layout ||
            (day.sections?.[layoutModal.sectionKey]?.layout_mode === 'side' ? 'right' : 'below')}
        />
      )}
    </div>
  )
}
