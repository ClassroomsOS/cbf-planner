// ── aiClient.js ───────────────────────────────────────────────────────────────
// Core AI infrastructure: context, token limits, callClaude, shared helpers.
// All AI modules import from here — never import AIAssistant.js internally.

import { supabase } from '../supabase'

// ── AI context (set once at login) ───────────────────────────────────────────
let _aiSchoolId   = null
let _aiTeacherId  = null
let _aiMonthLimit = 0   // 0 = unlimited

export function setAIContext({ schoolId, teacherId, monthlyLimit = 0 }) {
  _aiSchoolId   = schoolId
  _aiTeacherId  = teacherId
  _aiMonthLimit = monthlyLimit || 0
}

// Pricing: claude-sonnet-4 (approximate, $/token)
const COST_INPUT  = 3  / 1_000_000   // $3 per million input tokens
const COST_OUTPUT = 15 / 1_000_000   // $15 per million output tokens

// ── Core caller ───────────────────────────────────────────────────────────────
export async function callClaude({ type, system, message, planId, maxTokens }) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No hay sesión activa.')

  // ── Check monthly token limit ─────────────────────────────
  if (_aiMonthLimit > 0 && _aiTeacherId) {
    const now   = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
    const { data: rows } = await supabase
      .from('ai_usage')
      .select('input_tokens, output_tokens')
      .eq('teacher_id', _aiTeacherId)
      .gte('created_at', start)
      .lt('created_at', end)
    const used = (rows || []).reduce((s, r) => s + (r.input_tokens || 0) + (r.output_tokens || 0), 0)
    if (used >= _aiMonthLimit) {
      throw new Error(`Límite mensual de IA alcanzado (${_aiMonthLimit.toLocaleString()} tokens). Habla con el coordinador.`)
    }
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude-proxy`,
    {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        type,
        system,
        message,
        plan_id:    planId    || null,
        max_tokens: maxTokens || 2000,
      }),
    }
  )

  const text = await response.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`Error del servidor de IA: ${text.slice(0, 120)}`)
  }
  if (data.error) throw new Error(data.error)

  // ── Log usage to ai_usage (fire & forget) ────────────────
  if (data.usage && _aiSchoolId && _aiTeacherId) {
    const inp = data.usage.input_tokens  || 0
    const out = data.usage.output_tokens || 0
    supabase.from('ai_usage').insert({
      school_id:     _aiSchoolId,
      teacher_id:    _aiTeacherId,
      type:          type || 'unknown',
      input_tokens:  inp,
      output_tokens: out,
      cost_usd:      parseFloat((inp * COST_INPUT + out * COST_OUTPUT).toFixed(6)),
    }).then(() => {})
  }

  return data.text || ''
}

// ── JSON array extractor — handles markdown fences and surrounding text ────────
export function extractJSONArray(text) {
  if (!text) return null
  // Try direct parse first
  try { const p = JSON.parse(text); if (Array.isArray(p)) return p } catch { /* not valid JSON, try regex */ }
  // Extract first [...] block from the response
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return null
  try { const p = JSON.parse(match[0]); if (Array.isArray(p)) return p } catch { /* not valid JSON */ }
  return null
}

// ── Verse formatter ───────────────────────────────────────────────────────────
export function fmtVerse(verse) {
  if (!verse?.text) return null
  const text = verse.text.replace(/<[^>]+>/g, '').trim()
  if (!text) return null
  return verse.ref ? `"${text}" — ${verse.ref}` : `"${text}"`
}

// ── Biblical principles block ─────────────────────────────────────────────────
// principles = { yearVerse: {text, ref}, monthVerse: {text, ref}, indicatorPrinciple: string }
// Injected into every AI prompt. All three are non-negotiable.
export function biblicalBlock(principles, specificInstruction) {
  const year  = fmtVerse(principles?.yearVerse)
  const month = fmtVerse(principles?.monthVerse)
  const indic = principles?.indicatorPrinciple?.trim()
  if (!year && !month && !indic) return ''
  const lines = []
  if (year)  lines.push(`📖 Versículo del Año:        ${year}`)
  if (month) lines.push(`🗓 Versículo del Mes:        ${month}`)
  if (indic) lines.push(`✝️  Principio del Indicador: "${indic}"`)
  return `
⛪ PRINCIPIO RECTOR — ESCUELA CRISTIANA CONFESIONAL:
Este colegio es una institución cristiana confesional. TODO el aprendizaje, toda actividad,
todo logro y toda evaluación giran en torno a estos principios. No son opcionales ni decorativos
— son la razón de ser de la institución y el norte de toda planificación.
${lines.join('\n')}
${specificInstruction}`
}

// ── Normalize SmartBlock data returned by AI ─────────────────────────────────
// Fixes common structural variations so stored blocks always use canonical keys.
export function normalizeSmartBlock(block) {
  if (!block?.data) return block
  const { type, data } = block

  if (type === 'VOCAB') {
    // Try every key the AI might use for the words array
    const raw = data.words || data.vocabulary || data.word_list || data.items
      || data.terms || data.vocab || data.vocabulary_list || []
    block.data.words = (Array.isArray(raw) ? raw : []).map(wd => {
      if (typeof wd === 'string') return { w: wd, d: '', e: '' }
      return {
        w: wd.w || wd.term        || wd.word    || wd.en          || wd.english || '',
        d: wd.d || wd.definition  || wd.meaning || wd.desc        || wd.spanish || '',
        e: wd.e || wd.example     || wd.context || wd.in_context  || wd.sentence || '',
      }
    })
  }

  if (type === 'QUIZ') {
    if (Array.isArray(data.topics)) {
      // Convert topic objects to plain strings
      block.data.topics = data.topics
        .filter(Boolean)
        .map(t => typeof t === 'string' ? t : (t.topic || t.name || t.text || t.item || t.title || ''))
        .filter(Boolean)
    } else if (typeof data.topics !== 'string') {
      block.data.topics = ''
    }
  }

  return block
}
