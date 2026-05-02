// ── useGradingSession.js ─────────────────────────────────────────────────────
// Creates and manages a live grading session. Auto-closes previous active
// sessions for the same teacher before opening a new one.

import { useState, useCallback } from 'react'
import { supabase } from '../supabase'

export default function useGradingSession(teacher) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Start a new grading session for an activity
  const startSession = useCallback(async ({ newsProjectId, activityId, activityName, grade, section, subject, maxScore = 5 }) => {
    if (!teacher?.id) return null
    setLoading(true)
    setError(null)

    // Auto-close any active sessions for this teacher
    await supabase
      .from('grading_sessions')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('teacher_id', teacher.id)
      .eq('status', 'active')

    // Create new session
    const { data, error: err } = await supabase
      .from('grading_sessions')
      .insert({
        school_id:       teacher.school_id,
        teacher_id:      teacher.id,
        news_project_id: newsProjectId,
        activity_id:     activityId,
        activity_name:   activityName,
        grade,
        section,
        subject,
        max_score:       maxScore,
        status:          'active',
      })
      .select()
      .single()

    setLoading(false)
    if (err) { setError(err.message); return null }
    setSession(data)
    return data
  }, [teacher?.id, teacher?.school_id])

  // Close the current session
  const closeSession = useCallback(async () => {
    if (!session?.id) return
    await supabase
      .from('grading_sessions')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', session.id)
    setSession(null)
  }, [session?.id])

  // Load an existing session by ID (for projector view)
  const loadSession = useCallback(async (sessionId) => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('grading_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()
    setLoading(false)
    if (err) { setError(err.message); return null }
    setSession(data)
    return data
  }, [])

  return { session, loading, error, startSession, closeSession, loadSession }
}
