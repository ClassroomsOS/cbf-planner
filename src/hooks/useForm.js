// ── useForm.js ───────────────────────────────────────────────────────────────
// Custom hook for form state management with validation

import { useState, useCallback } from 'react'
import { logError } from '../utils/logger'

/**
 * Custom hook for managing form state
 * @param {Object} initialValues - Initial form values
 * @param {Function} onSubmit - Submit handler function
 * @param {Object} validationSchema - Optional Zod schema for validation
 * @returns {Object} Form state and handlers
 */
export function useForm(initialValues = {}, onSubmit = null, validationSchema = null) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const setValue = useCallback((name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }, [errors])

  const setFieldTouched = useCallback((name) => {
    setTouched((prev) => ({ ...prev, [name]: true }))
  }, [])

  const handleChange = useCallback(
    (e) => {
      const { name, value, type, checked } = e.target
      setValue(name, type === 'checkbox' ? checked : value)
    },
    [setValue]
  )

  const handleBlur = useCallback(
    (e) => {
      const { name } = e.target
      setFieldTouched(name)
    },
    [setFieldTouched]
  )

  const validate = useCallback(() => {
    if (!validationSchema) return true

    try {
      validationSchema.parse(values)
      setErrors({})
      return true
    } catch (error) {
      if (error.errors) {
        const fieldErrors = {}
        error.errors.forEach((err) => {
          const field = err.path[0]
          if (!fieldErrors[field]) {
            fieldErrors[field] = err.message
          }
        })
        setErrors(fieldErrors)
      }
      return false
    }
  }, [values, validationSchema])

  const handleSubmit = useCallback(
    async (e) => {
      if (e) e.preventDefault()

      // Mark all fields as touched
      const allTouched = Object.keys(values).reduce((acc, key) => {
        acc[key] = true
        return acc
      }, {})
      setTouched(allTouched)

      // Validate
      const isValid = validate()
      if (!isValid || !onSubmit) return

      setIsSubmitting(true)
      try {
        await onSubmit(values)
      } catch (error) {
        logError(error, { page: 'useForm', action: 'submit' })
      } finally {
        setIsSubmitting(false)
      }
    },
    [values, validate, onSubmit]
  )

  const reset = useCallback(() => {
    setValues(initialValues)
    setErrors({})
    setTouched({})
    setIsSubmitting(false)
  }, [initialValues])

  const setFormValues = useCallback((newValues) => {
    setValues(newValues)
  }, [])

  return {
    values,
    errors,
    touched,
    isSubmitting,
    setValue,
    setFormValues,
    handleChange,
    handleBlur,
    handleSubmit,
    validate,
    reset,
    // Computed
    isValid: Object.keys(errors).length === 0,
    isDirty: JSON.stringify(values) !== JSON.stringify(initialValues),
  }
}
