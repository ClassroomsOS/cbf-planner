// ── useToggle.js ─────────────────────────────────────────────────────────────
// Custom hook for boolean toggle state

import { useState, useCallback } from 'react'

/**
 * Hook for managing boolean toggle state
 * @param {boolean} initialValue - Initial state (default: false)
 * @returns {Array} [value, toggle, setTrue, setFalse, setValue]
 */
export function useToggle(initialValue = false) {
  const [value, setValue] = useState(initialValue)

  const toggle = useCallback(() => {
    setValue((prev) => !prev)
  }, [])

  const setTrue = useCallback(() => {
    setValue(true)
  }, [])

  const setFalse = useCallback(() => {
    setValue(false)
  }, [])

  return [value, toggle, setTrue, setFalse, setValue]
}

/**
 * Hook for managing multiple toggle states as an object
 * @param {Object} initialValues - Object with boolean values
 * @returns {Array} [values, toggle, set, reset]
 */
export function useToggles(initialValues = {}) {
  const [values, setValues] = useState(initialValues)

  const toggle = useCallback((key) => {
    setValues((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }, [])

  const set = useCallback((key, value) => {
    setValues((prev) => ({
      ...prev,
      [key]: value,
    }))
  }, [])

  const reset = useCallback(() => {
    setValues(initialValues)
  }, [initialValues])

  return [values, toggle, set, reset]
}
