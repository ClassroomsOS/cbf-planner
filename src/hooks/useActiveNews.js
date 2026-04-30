import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { sanitizeAIInput } from '../utils/validationSchemas'
import { logError } from '../utils/logger'

// ── useActiveNews ─────────────────────────────────────────────────────────────
// Resuelve el NEWS Project activo para una combinación subject/grade/period.
// Lee SIEMPRE desde news_projects (tabla canónica).
//
// Exporta: { news, loading, weekContext, buildNewsPromptContext }
//
// weekContext: información de la semana en curso del proyecto:
//   { weekNumber, totalWeeks, daysRemaining, isLastWeek }
//
// buildNewsPromptContext(news, weekContext):
//   Construye el bloque de texto que se inyecta en los prompts de IA.
// ─────────────────────────────────────────────────────────────────────────────

export function buildNewsPromptContext(news, weekContext) {
  if (!news) return ''

  const lines = []

  if (news.title)       lines.push(`- Proyecto NEWS activo: "${sanitizeAIInput(news.title)}"`)
  if (news.description) lines.push(`- Descripción: ${sanitizeAIInput(news.description)}`)
  if (news.conditions)  lines.push(`- Condiciones de entrega: ${sanitizeAIInput(news.conditions)}`)
  if (news.due_date)    lines.push(`- Fecha de entrega: ${news.due_date}`)
  if (news.status)      lines.push(`- Estado: ${news.status}`)

  // Textbook reference
  const tb = news.textbook_reference
  if (tb) {
    if (tb.book)              lines.push(`- Libro de texto: ${sanitizeAIInput(tb.book)}`)
    if (tb.units?.length)     lines.push(`- Unidades: ${tb.units.map(u => sanitizeAIInput(u)).join(', ')}`)
    if (tb.grammar?.length)   lines.push(`- Gramática: ${tb.grammar.map(g => sanitizeAIInput(g)).join(', ')}`)
    if (tb.vocabulary?.length) lines.push(`- Vocabulario: ${tb.vocabulary.map(v => sanitizeAIInput(v)).join(', ')}`)
  }

  // Modelo B fields
  if (news.competencias?.length) {
    lines.push(`- Competencias: ${news.competencias.map(c =>
      sanitizeAIInput(typeof c === 'string' ? c : c.nombre || '')
    ).join(', ')}`)
  }
  if (news.operadores_intelectuales?.length) {
    lines.push(`- Operadores intelectuales: ${news.operadores_intelectuales.map(o =>
      sanitizeAIInput(typeof o === 'string' ? o : o.nombre || '')
    ).join(', ')}`)
  }
  if (news.habilidades?.length) {
    lines.push(`- Habilidades: ${news.habilidades.map(h =>
      sanitizeAIInput(typeof h === 'string' ? h : h.nombre || '')
    ).join(', ')}`)
  }

  // Week context
  if (weekContext) {
    if (weekContext.weekNumber && weekContext.totalWeeks) {
      lines.push(`- Semana ${weekContext.weekNumber} de ${weekContext.totalWeeks} del proyecto`)
    }
    if (weekContext.isLastWeek) {
      lines.push(`- ⚠ Esta es la ÚLTIMA semana del proyecto — enfocarse en el producto final`)
    }
    if (weekContext.daysRemaining != null) {
      lines.push(`- Días restantes para la entrega: ${weekContext.daysRemaining}`)
    }
  }

  // Biblical context
  if (news.biblical_principle) {
    lines.push(`- Principio bíblico del proyecto: ${sanitizeAIInput(news.biblical_principle)}`)
  }
  if (news.biblical_reflection) {
    lines.push(`- Reflexión bíblica: ${sanitizeAIInput(news.biblical_reflection)}`)
  }

  if (!lines.length) return ''
  return `\nCONTEXTO NEWS PROJECT:\n${lines.join('\n')}\n`
}

// ─────────────────────────────────────────────────────────────────────────────

export default function useActiveNews({ teacher, subject, grade, period, referenceDate }) {
  const [news, setNews]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [weekContext, setWeekContext] = useState(null)

  const resolve = useCallback(async () => {
    if (!teacher?.id || !subject || !grade || !period) {
      setNews(null)
      setWeekContext(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // Fetch all projects matching this teacher/subject/grade/period
      const { data: projects, error } = await supabase
        .from('news_projects')
        .select([
          'id', 'title', 'description', 'status',
          'start_date', 'end_date', 'due_date',
          'subject', 'grade', 'section', 'period',
          'deliverable_type', 'weight',
          'textbook_reference', 'conditions',
          'target_indicador', 'skill', 'news_model',
          'competencias', 'operadores_intelectuales', 'habilidades',
          'biblical_principle', 'biblical_reflection',
          'actividades_evaluativas',
        ].join(', '))
        .eq('school_id', teacher.school_id)
        .eq('teacher_id', teacher.id)
        .eq('subject', subject)
        .eq('period', period)
        .order('due_date', { ascending: true })

      if (error) throw error

      const all = projects || []
      const ref = referenceDate || new Date().toISOString().slice(0, 10)

      // Priority 1: status = 'active' and date within range
      let active = all.find(np =>
        np.status === 'active' &&
        (!np.start_date || np.start_date <= ref) &&
        (!np.end_date   || np.end_date   >= ref)
      )

      // Priority 2: any project with status = 'active'
      if (!active) active = all.find(np => np.status === 'active')

      // Priority 3: nearest due_date on or after referenceDate
      if (!active) {
        const future = all
          .filter(np => np.due_date && np.due_date >= ref)
          .sort((a, b) => a.due_date.localeCompare(b.due_date))
        if (future.length) active = future[0]
      }

      // Priority 4: most recent project (regardless of date)
      if (!active && all.length) active = all[all.length - 1]

      setNews(active || null)

      // Build week context if we have a start/end range
      if (active?.start_date && active?.end_date) {
        const start = new Date(active.start_date + 'T12:00:00')
        const end   = new Date(active.end_date   + 'T12:00:00')
        const now   = new Date(ref                + 'T12:00:00')

        const totalDays   = Math.max(1, Math.round((end - start) / 86400000))
        const elapsedDays = Math.max(0, Math.round((now - start) / 86400000))
        const daysRemaining = Math.max(0, Math.round((end - now)  / 86400000))

        const totalWeeks   = Math.ceil(totalDays / 7)
        const weekNumber   = Math.min(totalWeeks, Math.floor(elapsedDays / 7) + 1)
        const isLastWeek   = weekNumber === totalWeeks

        setWeekContext({ weekNumber, totalWeeks, daysRemaining, isLastWeek })
      } else {
        setWeekContext(null)
      }
    } catch (err) {
      logError(err, { page: 'useActiveNews', action: 'fetch' })
      setNews(null)
      setWeekContext(null)
    } finally {
      setLoading(false)
    }
  }, [teacher?.id, teacher?.school_id, subject, grade, period, referenceDate])

  useEffect(() => {
    resolve()
  }, [resolve])

  return { news, loading, weekContext, buildNewsPromptContext }
}
