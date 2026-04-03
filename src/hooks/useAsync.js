// ── useAsync.js ──────────────────────────────────────────────────────────────
// Custom hook for async operations with loading/error states

import { useState, useCallback, useRef, useEffect } from 'react'

/**
 * Hook for managing async operations
 * @param {Function} asyncFunction - Async function to execute
 * @param {boolean} immediate - Execute immediately on mount (default: false)
 * @returns {Object} { execute, loading, data, error, reset }
 */
export function useAsync(asyncFunction, immediate = false) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const execute = useCallback(
    async (...params) => {
      setLoading(true)
      setError(null)

      try {
        const result = await asyncFunction(...params)
        if (mountedRef.current) {
          setData(result)
          setLoading(false)
        }
        return result
      } catch (err) {
        if (mountedRef.current) {
          setError(err)
          setLoading(false)
        }
        throw err
      }
    },
    [asyncFunction]
  )

  const reset = useCallback(() => {
    setLoading(false)
    setData(null)
    setError(null)
  }, [])

  // Execute immediately if requested
  useEffect(() => {
    if (immediate) {
      execute()
    }
  }, [immediate, execute])

  return {
    execute,
    loading,
    data,
    error,
    reset,
    // Computed
    isSuccess: data !== null && error === null,
    isError: error !== null,
    isIdle: !loading && data === null && error === null,
  }
}

/**
 * Hook for data fetching with automatic retry
 * @param {Function} fetchFunction - Async fetch function
 * @param {Object} options - Configuration
 * @param {number} options.retries - Number of retries (default: 0)
 * @param {number} options.retryDelay - Delay between retries in ms (default: 1000)
 * @param {boolean} options.immediate - Fetch immediately (default: true)
 * @returns {Object} { data, loading, error, refetch, reset }
 */
export function useFetch(fetchFunction, options = {}) {
  const { retries = 0, retryDelay = 1000, immediate = true } = options
  const [loading, setLoading] = useState(immediate)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const fetch = useCallback(
    async (...params) => {
      setLoading(true)
      setError(null)

      let attempt = 0
      while (attempt <= retries) {
        try {
          const result = await fetchFunction(...params)
          if (mountedRef.current) {
            setData(result)
            setLoading(false)
          }
          return result
        } catch (err) {
          attempt++
          if (attempt > retries) {
            if (mountedRef.current) {
              setError(err)
              setLoading(false)
            }
            throw err
          }
          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, retryDelay))
        }
      }
    },
    [fetchFunction, retries, retryDelay]
  )

  const reset = useCallback(() => {
    setLoading(false)
    setData(null)
    setError(null)
  }, [])

  useEffect(() => {
    if (immediate) {
      fetch()
    }
  }, [immediate, fetch])

  return {
    data,
    loading,
    error,
    refetch: fetch,
    reset,
  }
}
