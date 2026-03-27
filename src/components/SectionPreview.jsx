// ── SectionPreview.jsx ────────────────────────────────────────────────────────
// Preview en tiempo real de cómo se verá una sección en el export HTML/DOCX

export default function SectionPreview({ section, sectionMeta, dayLabel, unit }) {
  const content = section?.content || ''
  const images  = section?.images  || []
  const time    = section?.time    || sectionMeta?.time || ''

  if (!content && !images.length) return null

  // Mismo algoritmo de decideLayout que exportHtml.js
  const plainLen = content.replace(/<[^>]+>/g, '').length
  const layout   = images.length > 0 && plainLen < 400 ? 'side' : 'stack'

  const textBlock = content ? (
    <div
      style={{ fontSize: '12px', lineHeight: 1.8, color: '#222' }}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  ) : (
    <p style={{ color: '#ccc', fontSize: '12px', fontStyle: 'italic', margin: 0 }}>—</p>
  )

  const imageBlock = images.length > 0 ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {images.map((img, i) => (
        <img
          key={i}
          src={img.url}
          alt={img.name || ''}
          style={{
            maxWidth: '100%', maxHeight: '140px', width: 'auto', height: 'auto',
            borderRadius: '4px', border: '1px solid #ddd', objectFit: 'contain',
            display: 'block',
          }}
        />
      ))}
    </div>
  ) : null

  let contentBlock
  if (!images.length) {
    contentBlock = textBlock
  } else if (layout === 'side') {
    contentBlock = (
      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: '0 0 62%' }}>{textBlock}</div>
        <div style={{ flex: '0 0 35%' }}>{imageBlock}</div>
      </div>
    )
  } else {
    contentBlock = (
      <div>
        {textBlock}
        <div style={{
          marginTop: '10px', paddingTop: '8px',
          borderTop: '2px dashed #e0e8f4',
          display: 'flex', flexWrap: 'wrap', gap: '8px',
        }}>
          {images.map((img, i) => (
            <img key={i} src={img.url} alt={img.name || ''}
              style={{
                maxWidth: '200px', maxHeight: '140px', width: 'auto', height: 'auto',
                borderRadius: '4px', border: '1px solid #ddd', objectFit: 'contain',
              }}
            />
          ))}
        </div>
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

      {/* Section header (como en el export) */}
      <div style={{
        background: '#' + (sectionMeta?.hex?.replace('#','') || '4F81BD'),
        color: '#fff', padding: '6px 12px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontWeight: 700, fontSize: '11px' }}>
          {sectionMeta?.label}
        </span>
        <span style={{ fontSize: '10px', opacity: .8 }}>{time}</span>
      </div>

      {/* Content */}
      <div style={{ padding: '10px 14px', background: '#fff' }}>
        {contentBlock}
      </div>
    </div>
  )
}
