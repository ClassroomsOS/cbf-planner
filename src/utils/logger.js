/**
 * logger.js — Global error & activity logging for CBF Planner
 * 
 * Writes to `error_log` and `activity_log` tables in Supabase.
 * Import { logError, logActivity } anywhere in the app.
 * 
 * Usage:
 *   import { logError, logActivity } from '../utils/logger'
 *   
 *   try { ... } catch (err) { logError(err, { page: 'GuideEditor', action: 'save' }) }
 *   logActivity('create', 'news_project', projectId, 'Created NEWS: Vision Board')
 */

import { supabase } from '../supabase'

// ── Error Logging ───────────────────────────────────────────────

/**
 * Log an error to Supabase `error_log` table.
 * Never throws — silently fails if logging itself fails.
 * 
 * @param {Error|string} error     - The error object or message
 * @param {Object}       context   - Additional context
 * @param {string}       context.page    - Page/component name
 * @param {string}       context.action  - What was being attempted
 * @param {string}       context.entityId - Related entity ID (optional)
 */
export async function logError(error, context = {}) {
  try {
    const session = await supabase.auth.getSession()
    const userId = session?.data?.session?.user?.id || null

    const payload = {
      teacher_id: userId,
      error_message: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : null,
      context: {
        page: context.page || null,
        action: context.action || null,
        entity_id: context.entityId || null,
        url: typeof window !== 'undefined' ? window.location.href : null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        timestamp: new Date().toISOString(),
        ...context,
      },
    }

    await supabase.from('error_log').insert(payload)

    // Also log to console in development
    if (import.meta.env.DEV) {
      console.error('[CBF Error]', payload.error_message, payload.context)
    }
  } catch {
    // Never throw from the logger itself
    if (import.meta.env.DEV) {
      console.warn('[Logger] Failed to write error log:', error)
    }
  }
}


// ── Activity Logging ────────────────────────────────────────────

/**
 * Log a user activity to Supabase `activity_log` table.
 * Fire-and-forget — never blocks the UI.
 * 
 * @param {string} action      - Verb: 'create', 'update', 'delete', 'export', 'login', 'ai_generate'
 * @param {string} entityType  - Table/concept: 'lesson_plan', 'news_project', 'learning_target'
 * @param {string} entityId    - UUID of the affected record (optional)
 * @param {string} description - Human-readable summary (optional)
 */
export async function logActivity(action, entityType, entityId = null, description = '') {
  try {
    const session = await supabase.auth.getSession()
    const userId = session?.data?.session?.user?.id || null

    await supabase.from('activity_log').insert({
      teacher_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      description,
    })
  } catch {
    // Silent — activity logs are non-critical
    if (import.meta.env.DEV) {
      console.warn('[Logger] Failed to write activity log:', action, entityType)
    }
  }
}


// ── Safe wrapper for async operations ───────────────────────────

/**
 * Wraps an async function with error logging.
 * Returns { data, error } — never throws.
 * 
 * Usage:
 *   const { data, error } = await safeAsync(
 *     () => supabase.from('lesson_plans').update({ content }).eq('id', id),
 *     { page: 'GuideEditor', action: 'save' }
 *   )
 *   if (error) showToast('Error guardando guía')
 */
export async function safeAsync(fn, context = {}) {
  try {
    const result = await fn()
    // Handle Supabase-style { data, error } responses
    if (result?.error) {
      await logError(result.error, context)
      return { data: null, error: result.error.message || 'Unknown error' }
    }
    return { data: result?.data ?? result, error: null }
  } catch (err) {
    await logError(err, context)
    return { data: null, error: err.message || 'Unknown error' }
  }
}
