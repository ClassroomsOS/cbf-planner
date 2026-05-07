import { createContext, useContext, useState, useCallback } from 'react'

const QAContext = createContext(null)

export function QAProvider({ children }) {
  const [isRunning,   setIsRunning]   = useState(false)
  const [suite,       setSuite]       = useState(null)
  const [stepIndex,   setStepIndex]   = useState(0)
  const [results,     setResults]     = useState([])
  const [showSummary, setShowSummary] = useState(false)
  const [stepNote,    setStepNote]    = useState('')

  const startSuite = useCallback((s) => {
    setSuite(s)
    setStepIndex(0)
    setResults([])
    setShowSummary(false)
    setStepNote('')
    setIsRunning(true)
  }, [])

  const markStep = useCallback((status, note) => {
    setSuite(currentSuite => {
      setStepIndex(currentIndex => {
        setResults(prev => {
          const step = currentSuite?.steps[currentIndex]
          if (!step) return prev
          const result = { stepId: step.id, title: step.title, status, note: note ?? '' }
          const next = [...prev, result]

          const nextIndex = currentIndex + 1
          const done = nextIndex >= (currentSuite?.steps?.length ?? 0)
          if (done) {
            setIsRunning(false)
            setShowSummary(true)
          }
          return next
        })

        const nextIndex = currentIndex + 1
        const done = nextIndex >= (currentSuite?.steps?.length ?? 0)
        return done ? currentIndex : nextIndex
      })
      return currentSuite
    })
    setStepNote('')
  }, [])

  const abort = useCallback(() => {
    setIsRunning(false)
    setResults(prev => { if (prev.length > 0) setShowSummary(true); return prev })
  }, [])

  const reset = useCallback(() => {
    setIsRunning(false)
    setSuite(null)
    setStepIndex(0)
    setResults([])
    setShowSummary(false)
    setStepNote('')
  }, [])

  const currentStep = suite?.steps[stepIndex] ?? null

  return (
    <QAContext.Provider value={{
      isRunning, suite, stepIndex, results, showSummary,
      stepNote, currentStep,
      startSuite, markStep, abort, reset, setStepNote,
    }}>
      {children}
    </QAContext.Provider>
  )
}

export function useQA() {
  return useContext(QAContext)
}
