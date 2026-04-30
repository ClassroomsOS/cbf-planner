import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { logError } from '../utils/logger'

export default function useRubricTemplates(teacher) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchTemplates = useCallback(async () => {
    if (!teacher?.school_id) return
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('rubric_templates')
        .select('*')
        .eq('school_id', teacher.school_id)
        .eq('is_active', true)
        .order('skill', { ascending: true })

      if (error) throw error
      setTemplates(data || [])
    } catch (err) {
      logError(err, { page: 'useRubricTemplates', action: 'fetch' })
    } finally {
      setLoading(false)
    }
  }, [teacher?.school_id])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  // Get templates filtered by skill
  const getBySkill = (skill) => {
    return templates.filter(t => t.skill === skill)
  }

  // Get a single template by id
  const getById = (id) => {
    return templates.find(t => t.id === id) || null
  }

  // Clone template criteria into a project rubric format
  // Adds empty 5-level descriptors to each criterion
  const cloneForProject = (templateId) => {
    const template = getById(templateId)
    if (!template) return []

    return template.criteria.map(c => ({
      name: c.name,
      desc: c.desc,
      levels: ['', '', '', '', ''] // 5=Excellent, 4=Good, 3=Satisfactory, 2=Developing, 1=Beginning
    }))
  }

  return {
    templates,
    loading,
    fetchTemplates,
    getBySkill,
    getById,
    cloneForProject
  }
}
