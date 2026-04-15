import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'

// ── useSyllabus ───────────────────────────────────────────────────────────────
// CRUD para syllabus_topics.
// Carga los contenidos del plan de estudios del docente.
//
// Parámetros:
//   teacher  — objeto teacher (id, school_id)
//   filters  — { subject, grade, period, academic_year, week_number }
//
// Retorna:
//   topics           — array de syllabus_topics ordenados por week_number
//   byWeek           — Map<weekNumber, topic[]> — acceso rápido por semana
//   loading
//   error
//   createTopic(data)        → { data, error }
//   updateTopic(id, updates) → { data, error }
//   deleteTopic(id)          → { error }
//   getTopicsForWeek(week)   → topic[]
// ─────────────────────────────────────────────────────────────────────────────

export default function useSyllabus(teacher, filters = {}) {
  const [topics, setTopics]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const { subject, grade, period, academic_year, week_number } = filters

  const fetch = useCallback(async () => {
    if (!teacher?.id) return
    setLoading(true)
    setError(null)

    try {
      let q = supabase
        .from('syllabus_topics')
        .select('*, indicator:achievement_indicators(id, dimension, text, goal_id)')
        .eq('school_id', teacher.school_id)
        .eq('teacher_id', teacher.id)
        .order('period',      { ascending: true })
        .order('week_number', { ascending: true })
        .order('created_at',  { ascending: true })

      if (subject)       q = q.eq('subject', subject)
      if (grade)         q = q.eq('grade', grade)
      if (period)        q = q.eq('period', period)
      if (academic_year) q = q.eq('academic_year', academic_year)
      if (week_number)   q = q.eq('week_number', week_number)

      const { data, error: err } = await q
      if (err) throw err
      setTopics(data || [])
    } catch (err) {
      console.error('[useSyllabus] fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [teacher?.id, teacher?.school_id, subject, grade, period, academic_year, week_number])

  useEffect(() => { fetch() }, [fetch])

  // ── Derived: topics indexed by week ────────────────────────────────────────
  const byWeek = topics.reduce((acc, t) => {
    const wk = t.week_number ?? 0
    if (!acc[wk]) acc[wk] = []
    acc[wk].push(t)
    return acc
  }, {})

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const createTopic = async (data) => {
    try {
      const { data: created, error: err } = await supabase
        .from('syllabus_topics')
        .insert({
          school_id:    teacher.school_id,
          teacher_id:   teacher.id,
          academic_year: data.academic_year || new Date().getFullYear(),
          ...data,
        })
        .select('*, indicator:achievement_indicators(id, dimension, text, goal_id)')
        .single()

      if (err) throw err

      setTopics(prev => {
        const next = [...prev, created]
        return next.sort((a, b) => {
          if (a.period !== b.period) return a.period - b.period
          return (a.week_number ?? 99) - (b.week_number ?? 99)
        })
      })
      return { data: created, error: null }
    } catch (err) {
      console.error('[useSyllabus] createTopic error:', err)
      return { data: null, error: err.message }
    }
  }

  const updateTopic = async (id, updates) => {
    try {
      const { data: updated, error: err } = await supabase
        .from('syllabus_topics')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*, indicator:achievement_indicators(id, dimension, text, goal_id)')
        .single()

      if (err) throw err
      setTopics(prev => prev.map(t => t.id === id ? updated : t))
      return { data: updated, error: null }
    } catch (err) {
      console.error('[useSyllabus] updateTopic error:', err)
      return { data: null, error: err.message }
    }
  }

  const deleteTopic = async (id) => {
    try {
      const { error: err } = await supabase
        .from('syllabus_topics')
        .delete()
        .eq('id', id)

      if (err) throw err
      setTopics(prev => prev.filter(t => t.id !== id))
      return { error: null }
    } catch (err) {
      console.error('[useSyllabus] deleteTopic error:', err)
      return { error: err.message }
    }
  }

  const getTopicsForWeek = useCallback((week) => {
    return topics.filter(t => t.week_number === week)
  }, [topics])

  return {
    topics,
    byWeek,
    loading,
    error,
    refetch: fetch,
    createTopic,
    updateTopic,
    deleteTopic,
    getTopicsForWeek,
  }
}

// ── validateUnitWeekRule ───────────────────────────────────────────────────────
// Returns violations where a unit_number spans more than 2 weeks.
// Only applies to Language Arts and Science.
//
// @param  {Array}  topics  — syllabus_topics array
// @param  {string} subject — subject name
// @returns {Array<{ unit_number, weeks, subject }>}
export function validateUnitWeekRule(topics, subject) {
  if (!['Language Arts', 'Science'].includes(subject)) return []
  const byUnit = {}
  topics.forEach(t => {
    if (!t.unit_number) return
    if (!byUnit[t.unit_number]) byUnit[t.unit_number] = new Set()
    byUnit[t.unit_number].add(t.week_number)
  })
  return Object.entries(byUnit)
    .filter(([, weeks]) => weeks.size > 2)
    .map(([unit_number, weeks]) => ({
      unit_number: parseInt(unit_number),
      weeks: [...weeks].sort((a, b) => a - b),
      subject,
    }))
}
