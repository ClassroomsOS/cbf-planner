import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const BATCH_SIZE = 5
const REVIEW_THRESHOLD = 0.65
const AI_TIMEOUT_MS = 30000

const ALLOWED_ORIGINS = [
  'https://classroomsos.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
]

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

async function log(payload: {
  severity: 'debug' | 'info' | 'warn' | 'error' | 'critical'
  message: string
  error_code?: string
  step?: string
  school_id?: string
  assessment_id?: string
  session_id?: string
  submission_id?: string
  payload_in?: Record<string, unknown>
  payload_out?: Record<string, unknown>
  stack_trace?: string
  duration_ms?: number
}) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/cbf-logger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: 'EXAM', function_name: 'exam-ai-corrector', ...payload }),
    })
  } catch {
    console.error('[exam-ai-corrector] Logger call failed')
  }
}

interface QueueItem {
  id: string
  submission_id: string
  school_id: string
  priority: number
  attempts: number
  max_attempts: number
}

interface QuestionCriteria {
  model_answer: string | null
  key_concepts: string[] | null
  rubric: Record<string, unknown>
  rigor_level: string
  bloom_level: string | null
  ai_correction_context: string | null
}

interface Question {
  id: string
  stem: string
  question_type: string
  points: number
  criteria: QuestionCriteria[] | null
}

interface Submission {
  id: string
  answer: Record<string, unknown>
  school_id: string
  question: Question
}

interface AIEvaluationResult {
  score_awarded: number
  max_score: number
  feedback: string
  reasoning: string
  confidence: number
  detected_concepts: string[]
  missing_concepts: string[]
  requires_review: boolean
}

function buildCorrectionPrompt(submission: Submission): string {
  const { question, answer } = submission
  const criteria = question.criteria?.[0] ?? null
  const studentAnswer = typeof answer.text === 'string' ? answer.text : JSON.stringify(answer)

  const rigorDescriptions: Record<string, string> = {
    strict: 'Evalúa con rigor alto. El estudiante debe mencionar los términos y conceptos exactos indicados en la rúbrica.',
    flexible: 'Evalúa la comprensión conceptual. Acepta paráfrasis y formulaciones alternativas que demuestren comprensión real.',
    conceptual: 'Evalúa si el estudiante comprendió la idea central. Acepta respuestas que lleguen al mismo entendimiento por caminos diferentes.'
  }

  const rigorInstructions = rigorDescriptions[criteria?.rigor_level || 'flexible']

  let rubricText = ''
  if (criteria?.rubric) {
    const rubric = criteria.rubric as Record<string, unknown>
    if (Array.isArray(rubric.levels)) {
      rubricText = '\nRÚBRICA DE EVALUACIÓN:\n'
      for (const level of rubric.levels as Array<{ score: number; label: string; descriptor: string }>) {
        rubricText += `  - ${level.score} pts (${level.label}): ${level.descriptor}\n`
      }
    }
  }

  const keyConceptsText = criteria?.key_concepts?.length
    ? `\nCONCEPTOS CLAVE ESPERADOS: ${criteria.key_concepts.join(', ')}\n` : ''
  const modelAnswerText = criteria?.model_answer
    ? `\nRESPUESTA MODELO DEL DOCENTE:\n${criteria.model_answer}\n` : ''
  const contextText = criteria?.ai_correction_context
    ? `\nCONTEXTO ADICIONAL DEL DOCENTE:\n${criteria.ai_correction_context}\n` : ''
  const bloomText = criteria?.bloom_level
    ? `\nNIVEL COGNITIVO ESPERADO (Bloom): ${criteria.bloom_level}\n` : ''

  return `Eres un corrector académico experto. Tu tarea es evaluar la respuesta de un estudiante de manera justa, precisa y pedagógicamente fundamentada.

PREGUNTA:\n${question.stem}\n
PUNTAJE MÁXIMO: ${question.points} puntos
${bloomText}${keyConceptsText}${modelAnswerText}${rubricText}${contextText}
CRITERIO DE RIGOR: ${rigorInstructions}

RESPUESTA DEL ESTUDIANTE:\n${studentAnswer}

Evalúa la respuesta y responde ÚNICAMENTE con un objeto JSON válido con esta estructura exacta:
{
  "score_awarded": <número decimal entre 0 y ${question.points}>,
  "feedback": "<retroalimentación constructiva para el estudiante, máximo 3 oraciones, en el mismo idioma de la pregunta>",
  "reasoning": "<explicación interna de por qué asignaste este puntaje, para el docente>",
  "confidence": <número decimal entre 0.0 y 1.0 indicando tu confianza en la evaluación>,
  "detected_concepts": ["<concepto que el estudiante mencionó correctamente>"],
  "missing_concepts": ["<concepto que faltó o estuvo incorrecto>"]
}

REGLAS CRÍTICAS:
- score_awarded debe ser un número, nunca texto
- confidence menor a ${REVIEW_THRESHOLD} indica que el docente debe revisar
- Si la respuesta está en blanco o es ininteligible, score_awarded = 0, confidence = 1.0
- Si la respuesta es parcialmente correcta, asigna puntaje proporcional
- feedback debe ser en el idioma de la pregunta y constructivo
- NO incluyas nada fuera del JSON`
}

async function callClaude(prompt: string, submissionId: string, schoolId: string): Promise<AIEvaluationResult | null> {
  if (!ANTHROPIC_API_KEY) {
    await log({ severity: 'critical', error_code: 'CBF-AI-INT-001', message: 'ANTHROPIC_API_KEY no configurada', step: 'call_claude', school_id: schoolId, submission_id: submissionId })
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  const startTime = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
      signal: controller.signal,
    })

    clearTimeout(timeout)
    const durationMs = Date.now() - startTime

    if (response.status === 429) {
      await log({ severity: 'error', error_code: 'CBF-AI-INT-002', message: 'Rate limit de Anthropic alcanzado', step: 'call_claude', school_id: schoolId, submission_id: submissionId, duration_ms: durationMs })
      throw new Error('Rate limit reached')
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}))
      await log({ severity: 'error', error_code: 'CBF-AI-INT-001', message: `Claude API error ${response.status}`, step: 'call_claude', school_id: schoolId, submission_id: submissionId, payload_out: errData as Record<string, unknown>, duration_ms: durationMs })
      throw new Error(`Claude API error ${response.status}`)
    }

    if (durationMs > AI_TIMEOUT_MS * 0.8) {
      await log({ severity: 'warn', error_code: 'CBF-AI-PERF-001', message: `Corrección AI tardó ${durationMs}ms`, step: 'call_claude', school_id: schoolId, submission_id: submissionId, duration_ms: durationMs })
    }

    const data = await response.json()
    const text = data.content?.filter((b: { type: string }) => b.type === 'text')?.map((b: { text: string }) => b.text)?.join('') || ''
    const clean = text.replace(/```json|```/g, '').trim()

    let parsed
    try {
      parsed = JSON.parse(clean)
    } catch {
      await log({ severity: 'warn', error_code: 'CBF-AI-VAL-001', message: 'Claude devolvió JSON inválido', step: 'parse_response', school_id: schoolId, submission_id: submissionId, payload_out: { raw_response: text.substring(0, 500) }, duration_ms: durationMs })
      throw new Error('Invalid JSON from Claude')
    }

    const result: AIEvaluationResult = {
      score_awarded: Math.max(0, Number(parsed.score_awarded) || 0),
      max_score: 0,
      feedback: String(parsed.feedback || ''),
      reasoning: String(parsed.reasoning || ''),
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
      detected_concepts: Array.isArray(parsed.detected_concepts) ? parsed.detected_concepts : [],
      missing_concepts: Array.isArray(parsed.missing_concepts) ? parsed.missing_concepts : [],
      requires_review: Number(parsed.confidence) < REVIEW_THRESHOLD,
    }

    if (result.requires_review) {
      await log({ severity: 'info', error_code: 'CBF-AI-VAL-002', message: `Corrección con baja confianza (${result.confidence})`, step: 'evaluate_confidence', school_id: schoolId, submission_id: submissionId, payload_out: { confidence: result.confidence, score: result.score_awarded }, duration_ms: durationMs })
    }

    return result

  } catch (error) {
    clearTimeout(timeout)
    const durationMs = Date.now() - startTime
    if ((error as Error).name === 'AbortError') {
      await log({ severity: 'warn', error_code: 'CBF-AI-PERF-001', message: `Timeout: Claude no respondió en ${AI_TIMEOUT_MS}ms`, step: 'call_claude', school_id: schoolId, submission_id: submissionId, duration_ms: durationMs })
      throw new Error('Claude timeout')
    }
    throw error
  }
}

async function processQueueItem(supabase: ReturnType<typeof createClient>, item: QueueItem): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now()

  await supabase.from('ai_evaluation_queue').update({ status: 'processing', processing_started_at: new Date().toISOString(), attempts: item.attempts + 1 }).eq('id', item.id)

  try {
    // ✅ FIX v3: criteria cargada nested desde question (submissions → questions → question_criteria)
    const { data: submissionData, error: subError } = await supabase
      .from('submissions')
      .select(`
        id, answer, school_id,
        question:questions!question_id (
          id, stem, question_type, points,
          criteria:question_criteria (
            model_answer, key_concepts, rubric,
            rigor_level, bloom_level, ai_correction_context
          )
        )
      `)
      .eq('id', item.submission_id)
      .maybeSingle()

    if (subError || !submissionData) {
      const msg = subError?.message || 'Submission not found'
      await log({ severity: 'error', error_code: 'CBF-EXAM-DB-002', message: msg, step: 'load_submission', school_id: item.school_id, submission_id: item.submission_id })
      throw new Error(msg)
    }

    const submission = submissionData as unknown as Submission

    if (!submission.question.criteria || submission.question.criteria.length === 0) {
      await log({ severity: 'error', error_code: 'CBF-EXAM-DB-001', message: 'Pregunta sin criterios de evaluación definidos', step: 'check_criteria', school_id: item.school_id, submission_id: item.submission_id })
      await supabase.from('ai_evaluation_queue').update({ status: 'skipped', last_error: 'No criteria defined for this question' }).eq('id', item.id)
      return { success: false, error: 'No criteria defined' }
    }

    const prompt = buildCorrectionPrompt(submission)
    const result = await callClaude(prompt, item.submission_id, item.school_id)
    if (!result) throw new Error('Claude returned no result')

    const maxScore = submission.question.points
    if (result.score_awarded > maxScore) {
      await log({ severity: 'warn', error_code: 'CBF-EXAM-VAL-001', message: `Score AI (${result.score_awarded}) superó el máximo (${maxScore}). Truncado.`, step: 'validate_score', school_id: item.school_id, submission_id: item.submission_id })
    }
    result.max_score = maxScore
    result.score_awarded = Math.min(result.score_awarded, maxScore)

    const { error: evalError } = await supabase.from('ai_evaluations').insert({
      submission_id: item.submission_id, question_id: submission.question.id, school_id: item.school_id,
      score_awarded: result.score_awarded, max_score: result.max_score, feedback: result.feedback,
      reasoning: result.reasoning, confidence: result.confidence, requires_review: result.requires_review,
      detected_concepts: result.detected_concepts, missing_concepts: result.missing_concepts,
      ai_model: 'claude-sonnet-4-20250514', ai_version: '1.0', is_active: true,
    })

    if (evalError) throw new Error(`Save eval failed: ${evalError.message}`)

    await supabase.from('ai_evaluation_queue').update({ status: 'done', processed_at: new Date().toISOString() }).eq('id', item.id)
    await recalculateSessionResult(supabase, item.submission_id, item.school_id)
    await log({ severity: 'info', message: `Corrección completada. Score: ${result.score_awarded}/${maxScore}. Confianza: ${result.confidence}`, step: 'complete', school_id: item.school_id, submission_id: item.submission_id, duration_ms: Date.now() - startTime })

    return { success: true }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const newStatus = item.attempts + 1 >= item.max_attempts ? 'failed' : 'pending'
    await supabase.from('ai_evaluation_queue').update({ status: newStatus, last_error: errorMessage, processing_started_at: null }).eq('id', item.id)
    await log({ severity: newStatus === 'failed' ? 'error' : 'warn', error_code: 'CBF-AI-INT-001', message: `Intento ${item.attempts + 1}/${item.max_attempts} fallido: ${errorMessage}`, step: 'process_item', school_id: item.school_id, submission_id: item.submission_id, duration_ms: Date.now() - startTime, stack_trace: error instanceof Error ? error.stack : undefined })
    return { success: false, error: errorMessage }
  }
}

async function recalculateSessionResult(supabase: ReturnType<typeof createClient>, submissionId: string, schoolId: string) {
  const { data: sub } = await supabase.from('submissions').select('session_id, assessment_id').eq('id', submissionId).single()
  if (!sub) return

  const { data: submissions } = await supabase.from('submissions').select(`id, auto_score, question:questions!question_id ( points, question_type ), ai_eval:ai_evaluations ( score_awarded, is_active )`).eq('session_id', sub.session_id)
  if (!submissions) return

  let totalScore = 0, maxScore = 0, autoScore = 0, aiScore = 0, allResolved = true

  for (const s of submissions as unknown[]) {
    const item = s as { auto_score: number | null; question: { points: number; question_type: string }; ai_eval: Array<{ score_awarded: number; is_active: boolean }> }
    const points = item.question?.points || 0
    maxScore += points
    const isAutoType = !['open_development', 'short_answer'].includes(item.question?.question_type)
    if (isAutoType) { const score = item.auto_score || 0; totalScore += score; autoScore += score }
    else {
      const activeEval = item.ai_eval?.find((e) => e.is_active)
      if (activeEval) { totalScore += activeEval.score_awarded; aiScore += activeEval.score_awarded }
      else { allResolved = false }
    }
  }

  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100 * 100) / 100 : 0
  const finalGrade = maxScore > 0 ? Math.round((1 + (percentage / 100) * 4) * 10) / 10 : 1.0

  await supabase.from('assessment_results').upsert({
    session_id: sub.session_id, assessment_id: sub.assessment_id, school_id: schoolId,
    total_score: Math.round(totalScore * 100) / 100, max_score: Math.round(maxScore * 100) / 100,
    percentage, final_grade: finalGrade,
    auto_corrected_score: Math.round(autoScore * 100) / 100, ai_corrected_score: Math.round(aiScore * 100) / 100,
    status: allResolved ? 'complete' : 'partial', updated_at: new Date().toISOString(),
  }, { onConflict: 'session_id' })
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const runStart = Date.now()

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { data: queueItems, error: queueError } = await supabase
      .from('ai_evaluation_queue')
      .select('id, submission_id, school_id, priority, attempts, max_attempts')
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .order('queued_at', { ascending: true })
      .limit(BATCH_SIZE)

    if (queueError) throw new Error(`Queue fetch error: ${queueError.message}`)

    if (!queueItems || queueItems.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: 'Queue empty' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const results = await Promise.allSettled(queueItems.map((item) => processQueueItem(supabase, item as QueueItem)))

    const summary = results.map((r, i) => ({
      submission_id: queueItems[i].submission_id,
      success: r.status === 'fulfilled' && (r.value as { success: boolean }).success,
      error: r.status === 'rejected' ? String(r.reason) : r.status === 'fulfilled' && !(r.value as { success: boolean }).success ? (r.value as { error?: string }).error : undefined,
    }))

    const successCount = summary.filter((s) => s.success).length
    const failCount = summary.filter((s) => !s.success).length

    const { count: pendingCount } = await supabase.from('ai_evaluation_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending')

    if ((pendingCount || 0) > 20) {
      await log({ severity: 'warn', error_code: 'CBF-OBS-PERF-001', message: `Cola AI saturada: ${pendingCount} items pendientes`, step: 'queue_check', payload_out: { pending: pendingCount }, duration_ms: Date.now() - runStart })
    }

    console.log(`[exam-ai-corrector] v3 — ${successCount} ok, ${failCount} failed, ${pendingCount} remaining`)

    return new Response(JSON.stringify({ processed: queueItems.length, success: successCount, failed: failCount, results: summary }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await log({ severity: 'critical', error_code: 'CBF-CORE-DB-001', message: `Error fatal en exam-ai-corrector: ${message}`, stack_trace: error instanceof Error ? error.stack : undefined, duration_ms: Date.now() - runStart })
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  }
})
