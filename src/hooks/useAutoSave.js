// ── useAutoSave.js ───────────────────────────────────────────────────────────
// Custom hook for auto-saving data with debounce

import { useEffect, useRef, useCallback } from 'react'

/**
 * Auto-save hook with debounce
 * @param {*} data - Data to save
 * @param {Function} onSave - Save function (should be async)
 * @param {Object} options - Configuration options
 * @param {number} options.delay - Debounce delay in ms (default: 2000)
 * @param {boolean} options.enabled - Enable/disable auto-save (default: true)
 * @param {Array} options.dependencies - Additional dependencies to trigger save
 * @returns {Object} Save status and manual save function
 */
export function useAutoSave(data, onSave, options = {}) {
  const {
    delay = 2000,
    enabled = true,
    dependencies = [],
  } = options

  const timeoutRef = useRef(null)
  const previousDataRef = useRef(data)
  const isSavingRef = useRef(false)

  const save = useCallback(async () => {
    if (!enabled || isSavingRef.current) return

    try {
      isSavingRef.current = true
      await onSave(data)
      previousDataRef.current = data
    } catch (error) {
      console.error('Auto-save error:', error)
      throw error
    } finally {
      isSavingRef.current = false
    }
  }, [data, onSave, enabled])

  useEffect(() => {
    if (!enabled) return

    // Check if data actually changed
    const dataChanged = JSON.stringify(data) !== JSON.stringify(previousDataRef.current)
    if (!dataChanged) return

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      save()
    }, delay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [data, delay, enabled, save, ...dependencies])

  // Manual save function
  const saveNow = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    await save()
  }, [save])

  return {
    saveNow,
    isSaving: isSavingRef.current,
  }
}

/**
 * Simplified auto-save hook for localStorage
 * @param {string} key - localStorage key
 * @param {*} data - Data to save
 * @param {number} delay - Debounce delay in ms
 */
export function useLocalStorageAutoSave(key, data, delay = 1000) {
  const save = useCallback(
    (dataToSave) => {
      try {
        localStorage.setItem(key, JSON.stringify(dataToSave))
      } catch (error) {
        console.error('localStorage save error:', error)
      }
    },
    [key]
  )

  useAutoSave(data, save, { delay })
}
