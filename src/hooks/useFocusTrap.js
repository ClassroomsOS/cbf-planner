// ── useFocusTrap.js ──────────────────────────────────────────────────────────
// Custom hook for focus trap in modals

import { useEffect, useRef } from 'react'
import { trapFocus, handleEscapeKey, preventBodyScroll } from '../utils/accessibility'

/**
 * Hook for focus trap in modals with escape key handling
 * @param {boolean} isOpen - Whether modal is open
 * @param {Function} onClose - Function to call on close (Escape key)
 * @param {Object} options - Configuration options
 * @param {boolean} options.closeOnEscape - Close on Escape key (default: true)
 * @param {boolean} options.preventScroll - Prevent body scroll (default: true)
 * @returns {Object} Ref to attach to modal container
 */
export function useFocusTrap(isOpen, onClose, options = {}) {
  const { closeOnEscape = true, preventScroll = true } = options
  const elementRef = useRef(null)

  useEffect(() => {
    if (!isOpen || !elementRef.current) return

    const cleanupFns = []

    // Setup focus trap
    const cleanupFocus = trapFocus(elementRef.current)
    cleanupFns.push(cleanupFocus)

    // Setup escape key handler
    if (closeOnEscape && onClose) {
      const cleanupEscape = handleEscapeKey(onClose)
      cleanupFns.push(cleanupEscape)
    }

    // Prevent body scroll
    if (preventScroll) {
      const cleanupScroll = preventBodyScroll()
      cleanupFns.push(cleanupScroll)
    }

    // Cleanup all
    return () => {
      cleanupFns.forEach((fn) => fn())
    }
  }, [isOpen, onClose, closeOnEscape, preventScroll])

  return elementRef
}
