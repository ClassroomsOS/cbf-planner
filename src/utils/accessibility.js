// ── accessibility.js ──────────────────────────────────────────────────────────
// Accessibility utilities and helpers

/**
 * Focus trap for modals - keeps focus within modal
 * @param {HTMLElement} element - Container element to trap focus
 * @returns {Function} Cleanup function
 */
export function trapFocus(element) {
  if (!element) return () => {}

  const focusableSelector =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

  const focusableElements = element.querySelectorAll(focusableSelector)
  const firstFocusable = focusableElements[0]
  const lastFocusable = focusableElements[focusableElements.length - 1]

  // Store previously focused element
  const previouslyFocused = document.activeElement

  // Focus first element
  if (firstFocusable) {
    setTimeout(() => firstFocusable.focus(), 0)
  }

  function handleKeyDown(e) {
    if (e.key !== 'Tab') return

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusable) {
        e.preventDefault()
        lastFocusable?.focus()
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        e.preventDefault()
        firstFocusable?.focus()
      }
    }
  }

  element.addEventListener('keydown', handleKeyDown)

  // Cleanup function
  return () => {
    element.removeEventListener('keydown', handleKeyDown)
    // Restore focus
    if (previouslyFocused && previouslyFocused.focus) {
      previouslyFocused.focus()
    }
  }
}

/**
 * Escape key handler for modals
 * @param {Function} onEscape - Function to call on Escape
 * @returns {Function} Cleanup function
 */
export function handleEscapeKey(onEscape) {
  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      onEscape()
    }
  }

  document.addEventListener('keydown', handleKeyDown)

  return () => {
    document.removeEventListener('keydown', handleKeyDown)
  }
}

/**
 * Prevent body scroll when modal is open
 * @returns {Function} Cleanup function
 */
export function preventBodyScroll() {
  const originalOverflow = document.body.style.overflow
  const originalPaddingRight = document.body.style.paddingRight

  // Calculate scrollbar width
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

  document.body.style.overflow = 'hidden'
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`
  }

  return () => {
    document.body.style.overflow = originalOverflow
    document.body.style.paddingRight = originalPaddingRight
  }
}

/**
 * Announce message to screen readers
 * @param {string} message - Message to announce
 * @param {string} priority - 'polite' or 'assertive'
 */
export function announceToScreenReader(message, priority = 'polite') {
  const announcement = document.createElement('div')
  announcement.setAttribute('role', 'status')
  announcement.setAttribute('aria-live', priority)
  announcement.setAttribute('aria-atomic', 'true')
  announcement.className = 'sr-only'
  announcement.textContent = message

  document.body.appendChild(announcement)

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement)
  }, 1000)
}

/**
 * Generate unique ID for accessibility
 * @param {string} prefix - Prefix for ID
 * @returns {string} Unique ID
 */
let idCounter = 0
export function generateA11yId(prefix = 'a11y') {
  idCounter++
  return `${prefix}-${idCounter}-${Date.now()}`
}

/**
 * Check if element is visible to screen readers
 * @param {HTMLElement} element
 * @returns {boolean}
 */
export function isVisibleToScreenReader(element) {
  if (!element) return false

  const style = window.getComputedStyle(element)
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    element.getAttribute('aria-hidden') !== 'true'
  )
}

/**
 * Get accessible name for element (for debugging)
 * @param {HTMLElement} element
 * @returns {string}
 */
export function getAccessibleName(element) {
  if (!element) return ''

  return (
    element.getAttribute('aria-label') ||
    element.getAttribute('aria-labelledby') ||
    element.textContent ||
    element.getAttribute('title') ||
    element.getAttribute('placeholder') ||
    ''
  ).trim()
}
