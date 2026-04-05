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
  success: { bg: '#EEFBF0', border: '#9BBB59', color: '#1A6B3A', icon: '✅' },
  error:   { bg: '#FFF5F5', border: '#CC1F27', color: '#CC1F27', icon: '⚠️' },
  info:    { bg: '#EEF2FB', border: '#1A3A8F', color: '#1A3A8F', icon: 'ℹ️' },
  warning: { bg: '#FFFDF0', border: '#F5C300', color: '#8a4f00', icon: '⚡' },
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
                <span style={S.icon} aria-hidden="true">{style.icon}</span>
                <span style={S.message}>{toast.message}</span>
                <button
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
    bottom: 20,
    right: 20,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxWidth: 380,
    pointerEvents: 'none',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    borderRadius: 10,
    border: '1.5px solid',
    boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    animation: 'toastSlideIn 0.25s ease-out',
    pointerEvents: 'auto',
  },
  icon: {
    fontSize: 16,
    flexShrink: 0,
  },
  message: {
    flex: 1,
    lineHeight: 1.4,
  },
  closeBtn: {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 800,
    padding: '0 2px',
    opacity: 0.6,
    flexShrink: 0,
  },
}

// ── Inject keyframes (runs once) ──
if (typeof document !== 'undefined') {
  const styleEl = document.getElementById('toast-keyframes') || (() => {
    const el = document.createElement('style')
    el.id = 'toast-keyframes'
    el.textContent = `
      @keyframes toastSlideIn {
        from { opacity: 0; transform: translateX(40px); }
        to   { opacity: 1; transform: translateX(0); }
      }
    `
    document.head.appendChild(el)
    return el
  })()
}
