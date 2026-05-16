import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { logError } from '../utils/logger'

/**
 * useSyllabusPlan
 * CRUD para syllabus_plan — el plan curricular maestro de un docente
 * para una combinación subject/grade/period/year.
 *
 * Si no existe un plan para esa combinación, devuelve plan=null.
 * El docente puede crearlo llamando a savePlan().
 */
export default function useSyllabusPlan(teacher, { subject, grade, period, year }) {
  const [plan,    setPlan]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const currentYear = year || new Date().getFullYear()

  const fetch = useCallback(async () => {
    if (!teacher?.id || !subject || !grade || !period) {
      setPlan(null); setLoading(false); return
    }
    setLoading(true); setError(null)
    const { data, error: err } = await supabase
      .from('syllabus_plan')
      .select('*')
      .eq('teacher_id', teacher.id)
      .eq('subject',    subject)
      .eq('grade',      grade)
      .eq('period',     period)
      .eq('year',       currentYear)
      .maybeSingle()
    if (err) { logError(err, { hook: 'useSyllabusPlan' }); setError(err.message) }
    setPlan(data || null)
    setLoading(false)
  }, [teacher?.id, subject, grade, period, currentYear])

  useEffect(() => { fetch() }, [fetch])

  /** Crea o actualiza el plan. Devuelve { data, error }. */
  const savePlan = useCallback(async (fields) => {
    if (!teacher?.id) return { data: null, error: 'No teacher' }

    const payload = {
      teacher_id: teacher.id,
      school_id:  teacher.school_id,
      subject, grade,
      period:     parseInt(period),
      year:       currentYear,
      ...fields,
    }

    let result
    if (plan?.id) {
      result = await supabase
        .from('syllabus_plan')
        .update(payload)
        .eq('id', plan.id)
        .select()
        .single()
    } else {
      result = await supabase
        .from('syllabus_plan')
        .insert(payload)
        .select()
        .single()
    }

    if (result.error) {
      logError(result.error, { hook: 'useSyllabusPlan', action: 'savePlan' })
      return { data: null, error: result.error.message }
    }
    setPlan(result.data)
    return { data: result.data, error: null }
  }, [teacher?.id, teacher?.school_id, subject, grade, period, currentYear, plan?.id])

  /** Guarda solo la distribución generada por IA */
  const saveDistribution = useCallback(async (distribution) => {
    return savePlan({ distribution, ai_generated_at: new Date().toISOString() })
  }, [savePlan])

  /**
   * Publica la distribución: materializa filas en syllabus_topics (una por día con tema).
   * Borra las filas ai_generated anteriores del mismo plan antes de insertar.
   */
  const publishDistribution = useCallback(async (distribution) => {
    if (!plan?.id || !distribution?.length) return { error: 'Sin distribución' }

    // Borrar topics AI previos de este plan
    const { error: delErr } = await supabase
      .from('syllabus_topics')
      .delete()
      .eq('plan_id', plan.id)
      .eq('ai_generated', true)

    if (delErr) return { error: delErr.message }

    // Construir filas nuevas
    const DAY_TO_NUM = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4 }
    const rows = []
    distribution.forEach(weekEntry => {
      const { week, days } = weekEntry
      Object.entries(days || {}).forEach(([day, cell]) => {
        if (!cell?.topic) return
        rows.push({
          school_id:    teacher.school_id,
          teacher_id:   teacher.id,
          subject,
          grade,
          period:       parseInt(period),
          academic_year: currentYear,
          week_number:  week,
          unit_number:  cell.unit || null,
          topic:        cell.topic,
          content_type: cell.content_type || cell.type || null,
          description:  cell.description || null,
          slot_type:    cell.type !== cell.content_type ? cell.type : null,
          plan_id:      plan.id,
          ai_generated: true,
        })
      })
    })

    if (!rows.length) return { error: 'La distribución no tiene temas' }

    const { error: insErr } = await supabase
      .from('syllabus_topics')
      .insert(rows)

    if (insErr) return { error: insErr.message }
    return { error: null, count: rows.length }
  }, [plan?.id, teacher?.id, teacher?.school_id, subject, grade, period, currentYear])

  return { plan, loading, error, refetch: fetch, savePlan, saveDistribution, publishDistribution }
}
