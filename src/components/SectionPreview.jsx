// ── SectionPreview.jsx ────────────────────────────────────────────────────────
// Preview en tiempo real de una sección: texto + imágenes con layout elegido.
// Soporta 1-4 imágenes con grid automático.

import { memo } from 'react'
import DOMPurify from 'dompurify'

const SectionPreview = memo(function SectionPreview({ section, sectionMeta }) {
  const content = section?.content || ''
  const images  = section?.images  || []
  const time    = section?.time    || sectionMeta?.time || ''

  if (!content && !images.length) return null

  // Normaliza layout viejo (layout_mode) al nuevo campo image_layout
  const rawLayout = section?.image_layout ||
    (section?.layout_mode === 'side' ? 'right' : 'below')
  const layout = images.length > 0 ? rawLayout : 'below'

  const textBlock = content ? (
    <div
      style={{ fontSize: '12px', lineHeight: 1.8, color: '#222' }}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
    />
  ) : (
    <p style={{ color: '#ccc', fontSize: '12px', fontStyle: 'italic', margin: 0 }}>—</p>
  )

  const isSide = layout === 'right' || layout === 'left'
  const imageGrid = images.length > 0 ? buildImageGrid(images, isSide) : null

  let contentBlock
  if (!images.length) {
    contentBlock = textBlock
  } else if (layout === 'right') {
    contentBlock = (
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div style={{ flex: '0 0 58%', minWidth: 0 }}>{textBlock}</div>
        <div style={{ flex: '0 0 38%', minWidth: 0 }}>{imageGrid}</div>
      </div>
    )
  } else if (layout === 'left') {
    contentBlock = (
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div style={{ flex: '0 0 38%', minWidth: 0 }}>{imageGrid}</div>
        <div style={{ flex: '0 0 58%', minWidth: 0 }}>{textBlock}</div>
      </div>
    )
  } else {
    // below
    contentBlock = (
      <div>
        {content && textBlock}
        {images.length > 0 && (
          <div style={{ marginTop: content ? '10px' : 0 }}>{imageGrid}</div>
        )}
      </div>
    )
  }

  return (
    <div style={{
      border: '1px solid #e0e8f4', borderRadius: '6px',
      overflow: 'hidden', marginTop: '10px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {/* Preview header */}
      <div style={{
        background: '#f0f4ff', borderBottom: '1px solid #e0e8f4',
        padding: '5px 12px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#2E5598', textTransform: 'uppercase', letterSpacing: '.5px' }}>
          👁 Preview — {sectionMeta?.label}
        </span>
        <span style={{ fontSize: '10px', color: '#888' }}>{time}</span>
      </div>

      {/* Section color bar */}
      <div style={{
        background: '#' + (sectionMeta?.hex?.replace('#','') || '4F81BD'),
        color: '#fff', padding: '6px 12px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontWeight: 700, fontSize: '11px' }}>{sectionMeta?.label}</span>
        <span style={{ fontSize: '10px', opacity: .8 }}>{time}</span>
      </div>

      {/* Content */}
      <div style={{ padding: '10px 14px', background: '#fff' }}>
        {contentBlock}
      </div>
    </div>
  )
})

export default SectionPreview

// ── Image grid — tamaños óptimos por cantidad ─────────────────────────────────

function buildImageGrid(images, isSide = false) {
  const n    = Math.min(images.length, 6)
  const imgs = images.slice(0, 6)
  const gap  = '4px'

  const imgStyle = { width: '100%', objectFit: 'cover', borderRadius: '4px', display: 'block' }

  function imgBox(img, i, ratio = '4/3') {
    return (
      <div key={i} style={{ aspectRatio: ratio, overflow: 'hidden', borderRadius: '4px' }}>
        <img src={img.url} alt={img.name || ''} style={imgStyle} />
      </div>
    )
  }

  // Layout lateral: 1-2 → columna, 3+ → mini-grid 2 cols
  if (isSide) {
    if (n <= 2) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap }}>
          {imgs.map((img, i) => imgBox(img, i))}
        </div>
      )
    }
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap }}>
        {imgs.map((img, i) => imgBox(img, i, '1/1'))}
      </div>
    )
  }

  if (n === 1) {
    return (
      <div style={{ aspectRatio: '16/9', overflow: 'hidden', borderRadius: '4px' }}>
        <img src={imgs[0].url} alt={imgs[0].name || ''} style={imgStyle} />
      </div>
    )
  }
  if (n === 2) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap }}>
        {imgs.map((img, i) => imgBox(img, i))}
      </div>
    )
  }
  if (n === 3) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap }}>
        {imgs.map((img, i) => imgBox(img, i))}
      </div>
    )
  }
  if (n === 4) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap }}>
        {imgs.map((img, i) => imgBox(img, i))}
      </div>
    )
  }
  if (n === 5) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap }}>
          {imgs.slice(0, 3).map((img, i) => imgBox(img, i, '3/2'))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap }}>
          {imgs.slice(3, 5).map((img, i) => imgBox(img, i, '3/2'))}
        </div>
      </div>
    )
  }
  // 6 → 3×2
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap }}>
      {imgs.map((img, i) => imgBox(img, i, '3/2'))}
    </div>
  )
}
