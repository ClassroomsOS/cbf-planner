import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'

export default function useNewsProjects(teacher, filters = {}) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const { period, grade, section, subject, status } = filters

  const fetchProjects = useCallback(async () => {
    if (!teacher?.id) return
    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('news_projects')
        .select('*, rubric_templates(id, skill, name)')
        .eq('school_id', teacher.school_id)
        .eq('teacher_id', teacher.id)
        .order('due_date', { ascending: true })

      if (period) query = query.eq('period', period)
      if (grade) query = query.eq('grade', grade)
      if (section) query = query.eq('section', section)
      if (subject) query = query.eq('subject', subject)
      if (status) query = query.eq('status', status)

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError
      setProjects(data || [])
    } catch (err) {
      console.error('Error fetching NEWS projects:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [teacher?.id, teacher?.school_id, period, grade, section, subject, status])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const createProject = async (projectData) => {
    try {
      const { data, error } = await supabase
        .from('news_projects')
        .insert({
          school_id: teacher.school_id,
          teacher_id: teacher.id,
          ...projectData
        })
        .select()
        .single()

      if (error) throw error
      setProjects(prev => [...prev, data].sort((a, b) => 
        new Date(a.due_date) - new Date(b.due_date)
      ))
      return { data, error: null }
    } catch (err) {
      console.error('Error creating NEWS project:', err)
      return { data: null, error: err.message }
    }
  }

  const updateProject = async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('news_projects')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      setProjects(prev => prev.map(p => p.id === id ? data : p))
      return { data, error: null }
    } catch (err) {
      console.error('Error updating NEWS project:', err)
      return { data: null, error: err.message }
    }
  }

  const deleteProject = async (id) => {
    try {
      const { error } = await supabase
        .from('news_projects')
        .delete()
        .eq('id', id)

      if (error) throw error
      setProjects(prev => prev.filter(p => p.id !== id))
      return { error: null }
    } catch (err) {
      console.error('Error deleting NEWS project:', err)
      return { error: err.message }
    }
  }

  const updateStatus = async (id, newStatus) => {
    return updateProject(id, { status: newStatus })
  }

  // Get linked lesson plans for a specific project
  const getLinkedPlans = async (projectId) => {
    try {
      const { data, error } = await supabase
        .from('lesson_plans')
        .select('id, title, week_number, date_start, date_end, status, news_week_number, news_criteria_focus')
        .eq('news_project_id', projectId)
        .order('news_week_number', { ascending: true })

      if (error) throw error
      return { data: data || [], error: null }
    } catch (err) {
      return { data: [], error: err.message }
    }
  }

  return {
    projects,
    loading,
    error,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    updateStatus,
    getLinkedPlans
  }
}
