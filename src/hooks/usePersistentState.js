// ── usePersistentState.js ────────────────────────────────────────────────────
// Custom hook for state that persists to localStorage

import { useState, useEffect, useCallback } from 'react'

/**
 * useState with localStorage persistence
 * @param {string} key - localStorage key
 * @param {*} initialValue - Initial value if nothing in localStorage
 * @param {Object} options - Configuration options
 * @param {boolean} options.serialize - Use JSON serialization (default: true)
 * @param {number} options.debounce - Debounce save to localStorage (ms, default: 0)
 * @returns {Array} [value, setValue, clearValue]
 */
export function usePersistentState(key, initialValue, options = {}) {
  const { serialize = true, debounce = 0 } = options

  // Initialize state from localStorage or initial value
  const [state, setState] = useState(() => {
    try {
      const item = localStorage.getItem(key)
      if (item === null) return initialValue
      return serialize ? JSON.parse(item) : item
    } catch (error) {
      console.warn(`Error loading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  // Debounce ref for delayed saves
  const timeoutRef = useState(null)[0]

  // Save to localStorage
  const saveToStorage = useCallback(
    (value) => {
      try {
        const valueToStore = serialize ? JSON.stringify(value) : value
        localStorage.setItem(key, valueToStore)
      } catch (error) {
        console.warn(`Error saving localStorage key "${key}":`, error)
      }
    },
    [key, serialize]
  )

  // Update localStorage when state changes
  useEffect(() => {
    if (debounce > 0) {
      if (timeoutRef) clearTimeout(timeoutRef)
      const timeout = setTimeout(() => saveToStorage(state), debounce)
      return () => clearTimeout(timeout)
    } else {
      saveToStorage(state)
    }
  }, [state, saveToStorage, debounce, timeoutRef])

  // Clear function
  const clearValue = useCallback(() => {
    setState(initialValue)
    localStorage.removeItem(key)
  }, [initialValue, key])

  return [state, setState, clearValue]
}

/**
 * Hook for session storage (same as usePersistentState but uses sessionStorage)
 */
export function useSessionState(key, initialValue, options = {}) {
  const { serialize = true } = options

  const [state, setState] = useState(() => {
    try {
      const item = sessionStorage.getItem(key)
      if (item === null) return initialValue
      return serialize ? JSON.parse(item) : item
    } catch (error) {
      console.warn(`Error loading sessionStorage key "${key}":`, error)
      return initialValue
    }
  })

  useEffect(() => {
    try {
      const valueToStore = serialize ? JSON.stringify(state) : state
      sessionStorage.setItem(key, valueToStore)
    } catch (error) {
      console.warn(`Error saving sessionStorage key "${key}":`, error)
    }
  }, [key, state, serialize])

  const clearValue = useCallback(() => {
    setState(initialValue)
    sessionStorage.removeItem(key)
  }, [initialValue, key])

  return [state, setState, clearValue]
}
