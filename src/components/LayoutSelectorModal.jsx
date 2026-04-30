// ── LayoutSelectorModal.jsx ───────────────────────────────────────────────────
// Elige cómo posicionar las imágenes respecto al texto en una sección.
// Soporta hasta 4 imágenes con grid automático.

import { useState, useCallback, memo } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'

export const LAYOUT_ELIGIBLE = ['motivation', 'activity', 'skill']

const LAYOUT_OPTIONS = [
  {
    id:    'below',
    label: 'Imágenes abajo',
    desc:  'Texto a ancho completo, imágenes en cuadrícula debajo.',
    Icon:  IconBelow,
  },
  {
    id:    'right',
    label: 'Texto | Imágenes',
    desc:  'Texto a la izquierda, imágenes apiladas a la derecha.',
    Icon:  IconRight,
  },
  {
    id:    'left',
    label: 'Imágenes | Texto',
    desc:  'Imágenes a la izquierda, texto a la derecha.',
    Icon:  IconLeft,
  },
]

// Normaliza layouts viejos (layout_mode) al nuevo formato
const normalize = l => l === 'stack' ? 'below' : l === 'side' ? 'right' : (l || 'below')

const LayoutSelectorModal = memo(function LayoutSelectorModal({
  isOpen,
  onClose,
  onConfirm,
  sectionLabel,
  currentLayout = 'below',
}) {
  // Hooks siempre primero — nunca después de un return condicional
  const [selected, setSelected] = useState(normalize(currentLayout))
  const modalRef = useFocusTrap(isOpen, onClose)

  const handleConfirm = useCallback(() => {
    onConfirm({ image_layout: selected })
    onClose()
  }, [selected, onConfirm, onClose])

  if (!isOpen) return null

  return (
    <div style={S.overlay}>
      <div ref={modalRef} style={S.modal}>

        {/* Header */}
        <div style={S.header}>
          <span style={S.headerTitle}>🖼 Distribución de imágenes</span>
          <span style={S.headerSub}>{sectionLabel}</span>
          <button style={S.closeBtn} onClick={onClose} aria-label="Cerrar selector de distribución">✕</button>
        </div>

        <div style={S.body}>
          <p style={S.hint}>
            El sistema adapta automáticamente el tamaño para 1, 2, 3 o 4 imágenes.
            Elige cómo quieres posicionarlas respecto al texto.
          </p>

          <div style={S.cards}>
            {LAYOUT_OPTIONS.map(opt => {
              const isSelected = selected === opt.id
              return (
                <div
                  key={opt.id}
                  style={{ ...S.card, ...(isSelected ? S.cardSelected : {}) }}
                  onClick={() => setSelected(opt.id)}
                >
                  <opt.Icon selected={isSelected} />
                  <div style={S.cardLabel}>{opt.label}</div>
                  <div style={S.cardDesc}>{opt.desc}</div>
                </div>
              )
            })}
          </div>

          {/* Grid size reference */}
          <div style={S.sizeRef}>
            <div style={S.sizeRefTitle}>Cuadrícula automática</div>
            <div style={S.sizeRefGrid}>
              {[
                { n: 1, cols: '1 col', label: 'Ancho completo' },
                { n: 2, cols: '2 col', label: '2 columnas' },
                { n: 3, cols: '3 col', label: '3 columnas' },
                { n: 4, cols: '2×2',  label: 'Cuadrícula 2×2' },
              ].map(item => (
                <div key={item.n} style={S.sizeItem}>
                  <span style={S.sizeN}>{item.n}</span>
                  <span style={S.sizeCols}>{item.cols}</span>
                  <span style={S.sizeLabel}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={S.footer}>
          <button style={S.btnSecondary} onClick={onClose}>Cancelar</button>
          <button style={S.btnConfirm} onClick={handleConfirm}>✓ Aplicar</button>
        </div>
      </div>
    </div>
  )
})

export default LayoutSelectorModal

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function IconBelow({ selected }) {
  const t = selected ? '#2E5598' : '#8099C0'
  const i = selected ? '#4BACC6' : '#b0c8e0'
  return (
    <svg width="80" height="56" viewBox="0 0 80 56" fill="none">
      {/* Text lines */}
      <rect x="6" y="6"  width="68" height="5" rx="2" fill={t} opacity=".8"/>
      <rect x="6" y="14" width="68" height="5" rx="2" fill={t} opacity=".55"/>
      <rect x="6" y="22" width="44" height="5" rx="2" fill={t} opacity=".35"/>
      {/* Image grid 2×2 */}
      <rect x="6"  y="32" width="32" height="18" rx="3" fill={i}/>
      <rect x="42" y="32" width="32" height="18" rx="3" fill={i}/>
    </svg>
  )
}

function IconRight({ selected }) {
  const t = selected ? '#2E5598' : '#8099C0'
  const i = selected ? '#4BACC6' : '#b0c8e0'
  return (
    <svg width="80" height="56" viewBox="0 0 80 56" fill="none">
      {/* Text lines left */}
      <rect x="6"  y="8"  width="38" height="5" rx="2" fill={t} opacity=".8"/>
      <rect x="6"  y="17" width="38" height="5" rx="2" fill={t} opacity=".55"/>
      <rect x="6"  y="26" width="38" height="5" rx="2" fill={t} opacity=".35"/>
      <rect x="6"  y="35" width="26" height="5" rx="2" fill={t} opacity=".2"/>
      {/* Images right */}
      <rect x="50" y="6"  width="24" height="20" rx="3" fill={i}/>
      <rect x="50" y="30" width="24" height="20" rx="3" fill={i} opacity=".7"/>
    </svg>
  )
}

function IconLeft({ selected }) {
  const t = selected ? '#2E5598' : '#8099C0'
  const i = selected ? '#4BACC6' : '#b0c8e0'
  return (
    <svg width="80" height="56" viewBox="0 0 80 56" fill="none">
      {/* Images left */}
      <rect x="6"  y="6"  width="24" height="20" rx="3" fill={i}/>
      <rect x="6"  y="30" width="24" height="20" rx="3" fill={i} opacity=".7"/>
      {/* Text lines right */}
      <rect x="36" y="8"  width="38" height="5" rx="2" fill={t} opacity=".8"/>
      <rect x="36" y="17" width="38" height="5" rx="2" fill={t} opacity=".55"/>
      <rect x="36" y="26" width="38" height="5" rx="2" fill={t} opacity=".35"/>
      <rect x="36" y="35" width="26" height="5" rx="2" fill={t} opacity=".2"/>
    </svg>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1100, padding: '16px',
  },
  modal: {
    background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '540px',
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
  body: { padding: '20px', overflowY: 'auto', flex: 1 },
  hint: {
    margin: '0 0 16px', fontSize: '12px', color: '#666', lineHeight: 1.5,
    background: '#f0f4ff', border: '1px solid #c5d5f0', borderRadius: '8px',
    padding: '10px 12px',
  },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '20px' },
  card: {
    border: '2px solid #dde3f0', borderRadius: '10px', padding: '14px 10px',
    textAlign: 'center', cursor: 'pointer', background: '#fafbff',
    transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
  },
  cardSelected: {
    borderColor: '#2E5598', background: '#eef2fc',
    boxShadow: '0 0 0 3px rgba(46,85,152,0.12)',
  },
  cardLabel: { fontWeight: 700, fontSize: '12px', color: '#2E5598' },
  cardDesc:  { fontSize: '11px', color: '#666', lineHeight: 1.4 },
  sizeRef: {
    background: '#f8faff', border: '1px solid #e0e8f4',
    borderRadius: '8px', padding: '12px 14px',
  },
  sizeRefTitle: { fontSize: '11px', fontWeight: 700, color: '#888', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  sizeRefGrid:  { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px' },
  sizeItem: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
    background: '#fff', border: '1px solid #e0e8f4', borderRadius: '6px', padding: '8px 4px',
  },
  sizeN:     { fontSize: '18px', fontWeight: 800, color: '#2E5598' },
  sizeCols:  { fontSize: '11px', fontWeight: 700, color: '#4BACC6' },
  sizeLabel: { fontSize: '10px', color: '#888' },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 18px', borderTop: '1px solid #e8edf5', background: '#f9faff', flexShrink: 0,
  },
  btnSecondary: {
    padding: '8px 16px', background: '#fff', border: '1px solid #c5d5f0',
    borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#555',
  },
  btnConfirm: {
    padding: '8px 22px', background: '#9BBB59', color: '#fff',
    border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
  },
}
