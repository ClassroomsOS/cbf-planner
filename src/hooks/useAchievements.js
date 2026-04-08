import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'

// ── useAchievements ───────────────────────────────────────────────────────────
// CRUD para achievement_goals + achievement_indicators.
// Carga los logros del docente con sus indicadores anidados.
//
// Parámetros:
//   teacher      — objeto teacher (id, school_id)
//   filters      — { subject, grade, period, academic_year, status }
//
// Retorna:
//   goals        — array de achievement_goals, cada uno con .indicators []
//   loading
//   error
//   createGoal(data)          → { data, error }
//   updateGoal(id, updates)   → { data, error }
//   deleteGoal(id)            → { error }
//   publishGoal(id)           → { data, error }
//   createIndicator(goalId, data)        → { data, error }
//   updateIndicator(id, updates)         → { data, error }
//   deleteIndicator(id)                  → { error }
//   reorderIndicators(goalId, orderedIds) → { error }
//   getPeriodProgress(subject, grade, period) → { evaluated, total, percentage }
// ─────────────────────────────────────────────────────────────────────────────

export default function useAchievements(teacher, filters = {}) {
  const [goals, setGoals]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const { subject, grade, period, academic_year, status } = filters

  const fetch = useCallback(async () => {
    if (!teacher?.id) return
    setLoading(true)
    setError(null)

    try {
      // Query 1: goals
      let q = supabase
        .from('achievement_goals')
        .select('*')
        .eq('school_id', teacher.school_id)
        .eq('teacher_id', teacher.id)
        .order('period', { ascending: true })
        .order('subject', { ascending: true })
        .order('created_at', { ascending: true })

      if (subject)       q = q.eq('subject', subject)
      if (grade)         q = q.eq('grade', grade)
      if (period)        q = q.eq('period', period)
      if (academic_year) q = q.eq('academic_year', academic_year)
      if (status)        q = q.eq('status', status)

      const { data: goalsData, error: goalsErr } = await q
      if (goalsErr) throw goalsErr

      // Query 2: all indicators for this teacher (flat, then group by goal_id)
      const { data: indsData, error: indsErr } = await supabase
        .from('achievement_indicators')
        .select('*')
        .eq('teacher_id', teacher.id)
        .order('order_index', { ascending: true })

      if (indsErr) throw indsErr

      // Group indicators by goal_id
      const indsByGoal = (indsData || []).reduce((acc, ind) => {
        if (!acc[ind.goal_id]) acc[ind.goal_id] = []
        acc[ind.goal_id].push(ind)
        return acc
      }, {})

      const normalized = (goalsData || []).map(g => ({
        ...g,
        indicators: indsByGoal[g.id] || [],
      }))

      setGoals(normalized)
    } catch (err) {
      console.error('[useAchievements] fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [teacher?.id, teacher?.school_id, subject, grade, period, academic_year, status])

  useEffect(() => { fetch() }, [fetch])

  // ── Goals CRUD ──────────────────────────────────────────────────────────────

  const createGoal = async (data) => {
    try {
      const year = data.academic_year || new Date().getFullYear()
      const { data: created, error: err } = await supabase
        .from('achievement_goals')
        .insert({
          school_id:     teacher.school_id,
          teacher_id:    teacher.id,
          academic_year: year,
          ...data,
        })
        .select('*')
        .single()

      if (err) throw err
      const normalized = { ...created, indicators: [] }
      setGoals(prev => [...prev, normalized])
      return { data: normalized, error: null }
    } catch (err) {
      console.error('[useAchievements] createGoal error:', err)
      return { data: null, error: err.message }
    }
  }

  const updateGoal = async (id, updates) => {
    try {
      const { data: updated, error: err } = await supabase
        .from('achievement_goals')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single()

      if (err) throw err
      setGoals(prev => prev.map(g =>
        g.id === id ? { ...g, ...updated } : g
      ))
      return { data: updated, error: null }
    } catch (err) {
      console.error('[useAchievements] updateGoal error:', err)
      return { data: null, error: err.message }
    }
  }

  const deleteGoal = async (id) => {
    try {
      const { error: err } = await supabase
        .from('achievement_goals')
        .delete()
        .eq('id', id)

      if (err) throw err
      setGoals(prev => prev.filter(g => g.id !== id))
      return { error: null }
    } catch (err) {
      console.error('[useAchievements] deleteGoal error:', err)
      return { error: err.message }
    }
  }

  const publishGoal = async (id) => {
    return updateGoal(id, { status: 'published' })
  }

  // ── Indicators CRUD ─────────────────────────────────────────────────────────

  const createIndicator = async (goalId, data) => {
    try {
      // Determine next order_index
      const goal = goals.find(g => g.id === goalId)
      const maxOrder = (goal?.indicators || []).reduce((m, i) => Math.max(m, i.order_index), 0)

      const { data: created, error: err } = await supabase
        .from('achievement_indicators')
        .insert({
          goal_id:     goalId,
          teacher_id:  teacher.id,
          order_index: maxOrder + 1,
          ...data,
        })
        .select('*')
        .single()

      if (err) throw err

      setGoals(prev => prev.map(g =>
        g.id === goalId
          ? { ...g, indicators: [...(g.indicators || []), created] }
          : g
      ))
      return { data: created, error: null }
    } catch (err) {
      console.error('[useAchievements] createIndicator error:', err)
      return { data: null, error: err.message }
    }
  }

  const updateIndicator = async (id, updates) => {
    try {
      const { data: updated, error: err } = await supabase
        .from('achievement_indicators')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single()

      if (err) throw err

      setGoals(prev => prev.map(g => ({
        ...g,
        indicators: (g.indicators || []).map(i =>
          i.id === id ? { ...i, ...updated } : i
        ),
      })))
      return { data: updated, error: null }
    } catch (err) {
      console.error('[useAchievements] updateIndicator error:', err)
      return { data: null, error: err.message }
    }
  }

  const deleteIndicator = async (id) => {
    try {
      const { error: err } = await supabase
        .from('achievement_indicators')
        .delete()
        .eq('id', id)

      if (err) throw err

      setGoals(prev => prev.map(g => ({
        ...g,
        indicators: (g.indicators || []).filter(i => i.id !== id),
      })))
      return { error: null }
    } catch (err) {
      console.error('[useAchievements] deleteIndicator error:', err)
      return { error: err.message }
    }
  }

  // Reorder indicators after drag & drop — updates order_index in DB
  const reorderIndicators = async (goalId, orderedIds) => {
    try {
      const updates = orderedIds.map((id, idx) => ({ id, order_index: idx + 1 }))

      // Batch update via upsert
      const { error: err } = await supabase
        .from('achievement_indicators')
        .upsert(updates)

      if (err) throw err

      setGoals(prev => prev.map(g => {
        if (g.id !== goalId) return g
        const sorted = orderedIds
          .map((id, idx) => {
            const ind = (g.indicators || []).find(i => i.id === id)
            return ind ? { ...ind, order_index: idx + 1 } : null
          })
          .filter(Boolean)
        return { ...g, indicators: sorted }
      }))
      return { error: null }
    } catch (err) {
      console.error('[useAchievements] reorderIndicators error:', err)
      return { error: err.message }
    }
  }

  // ── Progress helpers ────────────────────────────────────────────────────────
  // Returns how many indicators of a goal have been evaluated (via checkpoints)
  const getPeriodProgress = useCallback(async (subj, grd, per) => {
    try {
      // Count indicators linked to checkpoints with achievement recorded
      const { data: checkpoints, error: err } = await supabase
        .from('checkpoints')
        .select('indicator_id, achievement')
        .eq('teacher_id', teacher.id)
        .eq('school_id', teacher.school_id)
        .eq('subject', subj)
        .eq('grade', grd)
        .not('indicator_id', 'is', null)

      if (err) throw err

      const goal = goals.find(g =>
        g.subject === subj && g.grade === grd && g.period === per
      )
      const total = goal?.indicators?.length || 0
      const evaluated = new Set(
        (checkpoints || []).map(c => c.indicator_id)
      ).size

      return {
        evaluated,
        total,
        percentage: total > 0 ? Math.round((evaluated / total) * 100) : 0,
      }
    } catch (err) {
      console.error('[useAchievements] getPeriodProgress error:', err)
      return { evaluated: 0, total: 0, percentage: 0 }
    }
  }, [teacher?.id, teacher?.school_id, goals])

  return {
    goals,
    loading,
    error,
    refetch: fetch,
    createGoal,
    updateGoal,
    deleteGoal,
    publishGoal,
    createIndicator,
    updateIndicator,
    deleteIndicator,
    reorderIndicators,
    getPeriodProgress,
  }
}
