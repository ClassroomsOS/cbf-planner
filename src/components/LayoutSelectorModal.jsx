import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

// ── Sections elegibles para layout visual ─────────────────────────────────────
export const LAYOUT_ELIGIBLE = ['motivation', 'activity', 'skill']

// ── Opciones de layout ────────────────────────────────────────────────────────
const LAYOUT_OPTIONS = [
  {
    id: 'none',
    label: 'Solo texto',
    desc: 'Sin imagen. Para instrucciones densas.',
    ratio: null,
  },
  {
    id: 'stack',
    label: 'Texto → Imagen',
    desc: 'Texto arriba, imagen abajo a ancho completo.',
    ratio: '16:9 o 4:3',
  },
  {
    id: 'side',
    label: 'Doble columna',
    desc: 'Texto 60% + imagen 40% en paralelo.',
    ratio: '1:1 o 3:4 vertical',
  },
]

// ── Nombre del bucket en Supabase Storage ─────────────────────────────────────
// ⚠️ Verifica que coincida con el nombre real del bucket en tu proyecto Supabase
const STORAGE_BUCKET = 'guide-images'

// ── Componente principal ──────────────────────────────────────────────────────

export default function LayoutSelectorModal({
  isOpen,
  onClose,
  onConfirm,
  sectionLabel,
  sectionKey,
  planId,
  dayIso,
  currentLayout = 'none',
  currentImageUrl = null,
}) {
  const [step,           setStep]           = useState(1)
  const [selectedLayout, setSelectedLayout] = useState(currentLayout)
  const [imageUrl,       setImageUrl]       = useState(currentImageUrl)
  const [uploading,      setUploading]      = useState(false)
  const [uploadError,    setUploadError]    = useState(null)

  // Resetear estado cada vez que se abre el modal
  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setSelectedLayout(currentLayout)
      setImageUrl(currentImageUrl)
      setUploadError(null)
    }
  }, [isOpen])

  if (!isOpen) return null

  // ── Subir imagen a Supabase Storage ──
  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    const ext  = file.name.split('.').pop()
    const path = `plans/${planId}/${dayIso}/${sectionKey}_layout.${ext}`
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: true })
    if (error) {
      setUploadError('Error al subir la imagen. Intenta de nuevo.')
      setUploading(false)
      return
    }
    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(path)
    setImageUrl(publicUrl)
    setUploading(false)
  }

  function handleConfirm() {
    onConfirm({ layout_mode: selectedLayout, layout_image_url: imageUrl })
    onClose()
  }

  function handleNext() {
    // Si elige "Solo texto", salta directo al paso 3 (vista previa)
    if (step === 1 && selectedLayout === 'none') { setStep(3); return }
    setStep(s => s + 1)
  }

  const selectedOption = LAYOUT_OPTIONS.find(o => o.id === selectedLayout)
  const needsImage     = selectedLayout !== 'none'

  return (
    <div style={S.overlay}>
      <div style={S.modal}>

        {/* ── Header ── */}
        <div style={S.header}>
          <span style={S.headerTitle}>🖼 Organizar contenido visual</span>
          <span style={S.headerSub}>{sectionLabel}</span>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* ── Steps indicator ── */}
        <div style={S.stepsBar}>
          {['Layout', 'Imagen', 'Vista previa'].map((label, i) => {
            const num     = i + 1
            const done    = step > num
            const active  = step === num
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  ...S.stepDot,
                  background: done ? '#9BBB59' : active ? '#2E5598' : '#dde3f0',
                  color: done || active ? '#fff' : '#aaa',
                }}>
                  {done ? '✓' : num}
                </div>
                <span style={{ fontSize: '12px', fontWeight: active ? 700 : 400, color: active ? '#2E5598' : '#aaa' }}>
                  {label}
                </span>
                {i < 2 && <div style={{ width: '20px', height: '2px', background: done ? '#9BBB59' : '#dde3f0' }} />}
              </div>
            )
          })}
        </div>

        {/* ── PASO 1: Elegir layout ── */}
        {step === 1 && (
          <div style={S.body}>
            <p style={S.bodyTitle}>¿Cómo quieres organizar el contenido de esta sección?</p>
            <div style={S.cards}>
              {LAYOUT_OPTIONS.map(opt => (
                <div
                  key={opt.id}
                  style={{ ...S.card, ...(selectedLayout === opt.id ? S.cardSelected : {}) }}
                  onClick={() => setSelectedLayout(opt.id)}
                >
                  <div style={S.cardIcon}>
                    {opt.id === 'none'  && <IconNone  selected={selectedLayout === opt.id} />}
                    {opt.id === 'stack' && <IconStack selected={selectedLayout === opt.id} />}
                    {opt.id === 'side'  && <IconSide  selected={selectedLayout === opt.id} />}
                  </div>
                  <div style={S.cardLabel}>{opt.label}</div>
                  <div style={S.cardDesc}>{opt.desc}</div>
                  {opt.ratio && <div style={S.cardRatio}>📐 {opt.ratio}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PASO 2: Subir imagen ── */}
        {step === 2 && (
          <div style={S.body}>
            {selectedOption?.ratio && (
              <div style={S.ratioHint}>
                📐 Proporción recomendada: <strong>{selectedOption.ratio}</strong>
              </div>
            )}

            {imageUrl ? (
              // Ya hay imagen
              <div style={{ textAlign: 'center' }}>
                <img
                  src={imageUrl} alt="preview"
                  style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', marginBottom: '14px', objectFit: 'contain' }}
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <label style={S.btnUpload}>
                    🔄 Cambiar imagen
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
                  </label>
                  <button style={S.btnRemove} onClick={() => setImageUrl(null)}>🗑 Quitar</button>
                </div>
              </div>
            ) : (
              // Sin imagen aún
              <div style={S.uploadArea}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>🖼</div>
                <p style={{ margin: '0 0 16px', color: '#555', fontSize: '14px' }}>
                  Sube una imagen para esta sección
                </p>
                <label style={{ ...S.btnUpload, cursor: uploading ? 'wait' : 'pointer' }}>
                  {uploading ? '⏳ Subiendo…' : '📁 Elegir imagen'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploading} />
                </label>
                {uploadError && (
                  <p style={{ color: '#c00', fontSize: '12px', marginTop: '10px' }}>{uploadError}</p>
                )}
                <button style={S.btnSkip} onClick={() => setStep(3)}>
                  Dejar pendiente →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── PASO 3: Vista previa ── */}
        {step === 3 && (
          <div style={S.body}>
            <p style={S.bodyTitle}>Vista previa del resultado</p>
            <div style={S.previewBox}>
              {selectedLayout === 'none' && (
                <div style={{ padding: '14px', background: '#f0f4ff', borderRadius: '8px', color: '#555', fontSize: '13px', lineHeight: 1.5 }}>
                  Solo texto — el contenido de la sección se mostrará a ancho completo en la guía.
                </div>
              )}
              {selectedLayout === 'stack' && (
                <div>
                  <div style={S.previewTextBlock}>📝 Texto de la sección (ancho completo)</div>
                  <div style={{ marginTop: '8px' }}>
                    {imageUrl
                      ? <img src={imageUrl} alt="layout preview" style={{ width: '100%', borderRadius: '8px', maxHeight: '160px', objectFit: 'cover' }} />
                      : <div style={S.placeholder}>[ IMAGEN PENDIENTE — 16:9 o 4:3 ]</div>
                    }
                  </div>
                </div>
              )}
              {selectedLayout === 'side' && (
                <div style={{ display: 'flex', gap: '8px', minHeight: '100px' }}>
                  <div style={{ ...S.previewTextBlock, flex: '0 0 60%' }}>📝 Texto (60%)</div>
                  <div style={{ flex: '0 0 38%' }}>
                    {imageUrl
                      ? <img src={imageUrl} alt="layout preview" style={{ width: '100%', height: '100%', borderRadius: '8px', objectFit: 'cover' }} />
                      : <div style={{ ...S.placeholder, height: '100%', minHeight: '80px' }}>[ IMAGEN PENDIENTE — 1:1 o 3:4 ]</div>
                    }
                  </div>
                </div>
              )}
            </div>
            {!imageUrl && needsImage && (
              <p style={{ fontSize: '12px', color: '#888', marginTop: '10px', textAlign: 'center' }}>
                💡 La guía se guardará con un placeholder. Puedes agregar la imagen más tarde.
              </p>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div style={S.footer}>
          {step > 1
            ? <button style={S.btnSecondary} onClick={() => setStep(s => s - 1)}>← Atrás</button>
            : <div />
          }
          {step < 3 && (
            <button style={S.btnPrimary} onClick={handleNext}>
              Siguiente →
            </button>
          )}
          {step === 3 && (
            <button style={S.btnConfirm} onClick={handleConfirm}>
              ✓ Confirmar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Íconos SVG de layout ──────────────────────────────────────────────────────

function IconNone({ selected }) {
  const c = selected ? '#2E5598' : '#8099C0'
  return (
    <svg width="64" height="44" viewBox="0 0 64 44" fill="none">
      <rect x="4"  y="8"  width="56" height="6" rx="2" fill={c} opacity="0.8"/>
      <rect x="4"  y="19" width="56" height="6" rx="2" fill={c} opacity="0.5"/>
      <rect x="4"  y="30" width="38" height="6" rx="2" fill={c} opacity="0.3"/>
    </svg>
  )
}

function IconStack({ selected }) {
  const c = selected ? '#2E5598' : '#8099C0'
  return (
    <svg width="64" height="44" viewBox="0 0 64 44" fill="none">
      <rect x="4"  y="4"  width="56" height="5" rx="2" fill={c} opacity="0.8"/>
      <rect x="4"  y="12" width="56" height="5" rx="2" fill={c} opacity="0.5"/>
      <rect x="4"  y="22" width="56" height="18" rx="3" fill="#4BACC6" opacity={selected ? 0.7 : 0.4}/>
      <text x="32" y="34" textAnchor="middle" fontSize="9" fill="#fff" fontWeight="600">imagen</text>
    </svg>
  )
}

function IconSide({ selected }) {
  const c = selected ? '#2E5598' : '#8099C0'
  return (
    <svg width="64" height="44" viewBox="0 0 64 44" fill="none">
      <rect x="4"  y="6"  width="34" height="5" rx="2" fill={c} opacity="0.8"/>
      <rect x="4"  y="15" width="34" height="5" rx="2" fill={c} opacity="0.5"/>
      <rect x="4"  y="24" width="34" height="5" rx="2" fill={c} opacity="0.3"/>
      <rect x="42" y="4"  width="18" height="36" rx="3" fill="#4BACC6" opacity={selected ? 0.7 : 0.4}/>
      <text x="51" y="25" textAnchor="middle" fontSize="8" fill="#fff" fontWeight="600">img</text>
    </svg>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1100, padding: '16px',
  },
  modal: {
    background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '560px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column',
    maxHeight: '90vh', overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '14px 18px', background: '#2E5598', color: '#fff', flexShrink: 0,
  },
  headerTitle: { fontWeight: 700, fontSize: '14px', flex: 1 },
  headerSub:   { fontSize: '11px', opacity: 0.7 },
  closeBtn: {
    background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
    borderRadius: '6px', cursor: 'pointer', padding: '3px 8px', fontSize: '13px',
  },
  stepsBar: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '12px 18px', background: '#f5f7fc', borderBottom: '1px solid #e8edf5', flexShrink: 0,
  },
  stepDot: {
    width: '22px', height: '22px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '11px', fontWeight: 700, flexShrink: 0,
  },
  body: { padding: '20px', overflowY: 'auto', flex: 1 },
  bodyTitle: { margin: '0 0 16px', fontSize: '14px', color: '#333', fontWeight: 600 },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' },
  card: {
    border: '2px solid #dde3f0', borderRadius: '10px', padding: '14px 8px',
    textAlign: 'center', cursor: 'pointer', background: '#fafbff', transition: 'all 0.15s',
  },
  cardSelected: { borderColor: '#2E5598', background: '#eef2fc', boxShadow: '0 0 0 3px rgba(46,85,152,0.12)' },
  cardIcon:  { marginBottom: '8px', display: 'flex', justifyContent: 'center' },
  cardLabel: { fontWeight: 700, fontSize: '12px', color: '#2E5598', marginBottom: '4px' },
  cardDesc:  { fontSize: '11px', color: '#666', lineHeight: 1.4 },
  cardRatio: { fontSize: '10px', color: '#4BACC6', marginTop: '6px' },
  ratioHint: {
    background: '#f0f6ff', border: '1px solid #c5d5f0', borderRadius: '8px',
    padding: '10px 14px', fontSize: '13px', color: '#2E5598', marginBottom: '16px',
  },
  uploadArea: {
    border: '2px dashed #c5d5f0', borderRadius: '10px', padding: '32px 20px',
    textAlign: 'center', background: '#f8faff',
  },
  btnUpload: {
    display: 'inline-block', padding: '8px 18px', background: '#2E5598', color: '#fff',
    borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
  },
  btnRemove: {
    padding: '8px 14px', background: '#fff0f0', border: '1px solid #ffcccc',
    borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#cc0000',
  },
  btnSkip: {
    display: 'block', margin: '14px auto 0', background: 'none', border: 'none',
    color: '#999', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline',
  },
  previewBox: {
    border: '1px solid #dde3f0', borderRadius: '10px', padding: '14px',
    background: '#fafbff', minHeight: '100px',
  },
  previewTextBlock: {
    background: '#eef2fc', borderRadius: '7px', padding: '10px',
    fontSize: '12px', color: '#2E5598', fontWeight: 500,
  },
  placeholder: {
    background: '#e8edf5', border: '2px dashed #c5d5f0', borderRadius: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '10px', color: '#888', padding: '12px', textAlign: 'center',
  },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 18px', borderTop: '1px solid #e8edf5', background: '#f9faff', flexShrink: 0,
  },
  btnSecondary: {
    padding: '8px 16px', background: '#fff', border: '1px solid #c5d5f0',
    borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#555',
  },
  btnPrimary: {
    padding: '8px 20px', background: '#2E5598', color: '#fff',
    border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
  },
  btnConfirm: {
    padding: '8px 22px', background: '#9BBB59', color: '#fff',
    border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
  },
}
