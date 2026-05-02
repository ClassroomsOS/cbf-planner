// ── useLiveGrades.js ─────────────────────────────────────────────────────────
// Realtime subscription to student_activity_grades for a grading session.
// Also provides the gradeStudent upsert function.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'

export default function useLiveGrades(sessionId, teacher) {
  const [grades, setGrades] = useState([])
  const [loading, setLoading] = useState(true)

  // Initial fetch + realtime subscription
  useEffect(() => {
    if (!sessionId) { setGrades([]); setLoading(false); return }
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('student_activity_grades')
        .select('*')
        .eq('session_id', sessionId)
      if (!cancelled) {
        setGrades(data || [])
        setLoading(false)
      }
    }
    load()

    // Realtime — listen for all changes on student_activity_grades for this session
    const channel = supabase
      .channel(`grades-${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'student_activity_grades',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setGrades(prev => {
            // Avoid duplicates (race between fetch and realtime)
            if (prev.some(g => g.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
        } else if (payload.eventType === 'UPDATE') {
          setGrades(prev => prev.map(g => g.id === payload.new.id ? payload.new : g))
        } else if (payload.eventType === 'DELETE') {
          setGrades(prev => prev.filter(g => g.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  // Grade a single student (upsert)
  const gradeStudent = useCallback(async ({ studentId, newsProjectId, activityId, score, maxScore, notes }) => {
    if (!teacher?.id) return null
    const { data, error } = await supabase
      .from('student_activity_grades')
      .upsert({
        school_id:       teacher.school_id,
        teacher_id:      teacher.id,
        student_id:      studentId,
        news_project_id: newsProjectId,
        activity_id:     activityId,
        session_id:      sessionId,
        score,
        max_score:       maxScore,
        notes:           notes || null,
      }, { onConflict: 'student_id,news_project_id,activity_id' })
      .select()
      .single()
    return { data, error }
  }, [sessionId, teacher?.id, teacher?.school_id])

  // Grade multiple students at once (group grading)
  const gradeGroup = useCallback(async ({ studentIds, newsProjectId, activityId, score, maxScore }) => {
    if (!teacher?.id || !studentIds?.length) return []
    const rows = studentIds.map(sid => ({
      school_id:       teacher.school_id,
      teacher_id:      teacher.id,
      student_id:      sid,
      news_project_id: newsProjectId,
      activity_id:     activityId,
      session_id:      sessionId,
      score,
      max_score:       maxScore,
    }))
    const { data, error } = await supabase
      .from('student_activity_grades')
      .upsert(rows, { onConflict: 'student_id,news_project_id,activity_id' })
      .select()
    return { data, error }
  }, [sessionId, teacher?.id, teacher?.school_id])

  return { grades, loading, gradeStudent, gradeGroup }
}
