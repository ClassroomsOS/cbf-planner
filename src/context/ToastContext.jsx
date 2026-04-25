/**
 * ToastContext.jsx — Global toast notifications for CBF Planner
 * 
 * Usage:
 *   1. Wrap app with <ToastProvider> (in DashboardPage)
 *   2. In any component: const { showToast } = useToast()
 *   3. showToast('Guía guardada ✓')
 *   4. showToast('Error al guardar', 'error')
 *   5. showToast('NEWS creado', 'success')
 */

import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

// ── Toast types with colors ──
const TOAST_STYLES = {
  success: { bg: '#EFFBF2', border: '#6EBF82', barColor: '#1A6B3A', color: '#155C2D', icon: '✓' },
  error:   { bg: '#FFF3F3', border: '#F5A0A0', barColor: '#CC1F27', color: '#A81820', icon: '✕' },
  info:    { bg: '#EEF4FF', border: '#93B8F5', barColor: '#1D4ED8', color: '#1A3A8F', icon: 'i' },
  warning: { bg: '#FFFBEC', border: '#F0D070', barColor: '#D97706', color: '#7A5500', icon: '!' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counterRef = useRef(0)

  const showToast = useCallback((message, type = 'success', duration = 3500) => {
    const id = ++counterRef.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duration)
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container — portaled to document.body to escape all stacking contexts */}
      {toasts.length > 0 && createPortal(
        <div style={S.container} aria-label="Notificaciones">
          {toasts.map(toast => {
            const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info
            // Assertive for errors, polite for everything else
            const ariaLive = toast.type === 'error' ? 'assertive' : 'polite'
            return (
              <div
                key={toast.id}
                role="status"
                aria-live={ariaLive}
                aria-atomic="true"
                style={{
                  ...S.toast,
                  background: style.bg,
                  borderColor: style.border,
                  color: style.color,
                }}
              >
                {/* left accent bar */}
                <div style={{ ...S.bar, background: style.barColor }} aria-hidden="true" />
                {/* icon badge */}
                <div style={{ ...S.iconBadge, background: style.barColor }} aria-hidden="true">
                  <span style={S.iconChar}>{style.icon}</span>
                </div>
                <span style={S.message}>{toast.message}</span>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  style={{ ...S.closeBtn, color: style.color }}
                  aria-label="Cerrar notificación"
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

// ── Styles ──
const S = {
  container: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxWidth: 400,
    pointerEvents: 'none',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '11px 14px 11px 0',
    borderRadius: 10,
    border: '1px solid',
    borderLeft: 'none',
    boxShadow: '0 4px 20px rgba(0,0,0,.10), 0 1px 4px rgba(0,0,0,.06)',
    fontSize: 13.5,
    fontWeight: 600,
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    animation: 'toastSlideIn 0.28s cubic-bezier(.34,1.56,.64,1)',
    pointerEvents: 'auto',
    overflow: 'hidden',
    backdropFilter: 'blur(8px)',
  },
  bar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: '10px 0 0 10px',
    flexShrink: 0,
  },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconChar: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 900,
    lineHeight: 1,
  },
  message: {
    flex: 1,
    lineHeight: 1.5,
  },
  closeBtn: {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 900,
    padding: '2px 6px',
    opacity: 0.45,
    flexShrink: 0,
    borderRadius: 4,
    transition: 'opacity .12s',
    marginRight: 4,
  },
}

// ── Inject keyframes (runs once) ──
if (typeof document !== 'undefined') {
  const styleEl = document.getElementById('toast-keyframes') || (() => {
    const el = document.createElement('style')
    el.id = 'toast-keyframes'
    el.textContent = `
      @keyframes toastSlideIn {
        from { opacity: 0; transform: translateX(48px) scale(.96); }
        to   { opacity: 1; transform: translateX(0) scale(1); }
      }
    `
    document.head.appendChild(el)
    return el
  })()
}
