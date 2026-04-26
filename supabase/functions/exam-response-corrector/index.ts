// exam-response-corrector — Edge Function
// Corrige respuestas abiertas de ExamPlayerV2 usando Claude.
// Input:  POST { instance_id: string }
// Output: { corrected, total_score, max_score, colombian_grade, requires_review, feedbacks[] }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY    = Deno.env.get('ANTHROPIC_API_KEY')
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const REVIEW_THRESHOLD     = 0.65

const ALLOWED_ORIGINS = [
  'https://classroomsos.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
]

function corsHeaders(req: Request) {
  const origin  = req.headers.get('Origin') || ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

// ── Prompt builder ─────────────────────────────────────────────

interface Criteria {
  model_answer?:          string | null
  key_concepts?:          string[] | null
  rubric?:                { levels?: { score: number; label: string; descriptor: string }[] } | null
  rigor_level?:           string | null
  bloom_level?:           string | null
  ai_correction_context?: string | null
}

function buildPrompt(stem: string, maxPoints: number, criteria: Criteria | null, studentAnswer: string): string {
  const rigorMap: Record<string, string> = {
    strict:     'Rigor alto — el estudiante debe mencionar términos y conceptos exactos.',
    flexible:   'Rigor medio — acepta paráfrasis que demuestren comprensión real.',
    conceptual: 'Rigor conceptual — evalúa si captó la idea central, por cualquier camino.',
  }
  const rigor       = rigorMap[(criteria?.rigor_level ?? 'flexible')] ?? rigorMap.flexible
  const modelAnswer = criteria?.model_answer    ? `\nRESPUESTA MODELO:\n${criteria.model_answer}\n`                                                          : ''
  const keyConcepts = criteria?.key_concepts?.length ? `\nCONCEPTOS CLAVE: ${criteria.key_concepts.join(', ')}\n`                                            : ''
  const rubricLines = criteria?.rubric?.levels?.map(l => `  ${l.score} pts (${l.label}): ${l.descriptor}`).join('\n')
  const rubricText  = rubricLines ? `\nRÚBRICA:\n${rubricLines}\n`                                                                                           : ''
  const context     = criteria?.ai_correction_context ? `\nCONTEXTO DOCENTE: ${criteria.ai_correction_context}\n`                                           : ''
  const bloom       = criteria?.bloom_level ? `\nNIVEL BLOOM ESPERADO: ${criteria.bloom_level}\n`                                                            : ''

  return `Eres un corrector académico experto. Evalúa esta respuesta de forma justa y pedagógica.

PREGUNTA: ${stem}
PUNTAJE MÁXIMO: ${maxPoints} puntos
${bloom}${modelAnswer}${keyConcepts}${rubricText}${context}
CRITERIO DE RIGOR: ${rigor}

RESPUESTA DEL ESTUDIANTE:
${studentAnswer || '(sin respuesta)'}

Responde ÚNICAMENTE con este JSON (sin texto adicional):
{
  "score_awarded": <número decimal 0–${maxPoints}>,
  "feedback": "<retroalimentación constructiva para el estudiante, máx 3 oraciones, en el idioma de la pregunta>",
  "confidence": <número 0.0–1.0>
}

REGLAS CRÍTICAS:
- score_awarded es número, nunca texto
- Si la respuesta está en blanco o es ininteligible: score_awarded=0, confidence=1.0
- feedback es para el estudiante: constructivo, específico, en el mismo idioma de la pregunta
- confidence < ${REVIEW_THRESHOLD} indica que el docente debe revisar
- NO incluyas nada fuera del JSON`
}

// ── Claude call ────────────────────────────────────────────────

async function callClaude(prompt: string, maxPoints: number): Promise<{
  score: number; feedback: string; confidence: number; requires_review: boolean
}> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')

  const controller = new AbortController()
  const timeout    = setTimeout(() => controller.abort(), 25000)

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body:    JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
      signal:  controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) throw new Error(`Claude API ${res.status}`)

    const data   = await res.json()
    const text   = (data.content ?? []).find((b: { type: string }) => b.type === 'text')?.text ?? ''
    const clean  = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    const score      = Math.min(maxPoints, Math.max(0, Number(parsed.score_awarded) || 0))
    const confidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5))

    return {
      score,
      feedback:       String(parsed.feedback || 'Evaluado por IA.'),
      confidence,
      requires_review: confidence < REVIEW_THRESHOLD,
    }
  } catch {
    clearTimeout(timeout)
    // Fallback graceful: puntaje 0, marcar para revisión humana
    return { score: 0, feedback: 'La corrección automática no pudo completarse. El docente revisará esta respuesta.', confidence: 0, requires_review: true }
  }
}

// ── Main handler ───────────────────────────────────────────────

serve(async (req: Request) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { instance_id } = await req.json()
    if (!instance_id) return new Response(JSON.stringify({ error: 'instance_id requerido' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // ── 1. Cargar instancia ──────────────────────────────────────
    const { data: instance, error: instErr } = await supabase
      .from('exam_instances')
      .select('id, session_id, school_id, generated_questions, student_name, version_label')
      .eq('id', instance_id)
      .single()

    if (instErr || !instance) {
      return new Response(JSON.stringify({ error: 'Instancia no encontrada' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // ── 2. Respuestas abiertas pendientes ────────────────────────
    const { data: responses, error: respErr } = await supabase
      .from('exam_responses')
      .select('id, question_id, question_type, answer, points_possible')
      .eq('instance_id', instance_id)
      .eq('ai_correction_status', 'pending')

    if (respErr) throw new Error(respErr.message)

    if (!responses || responses.length === 0) {
      return new Response(JSON.stringify({ corrected: 0, message: 'Sin respuestas abiertas pendientes' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // ── 3. Mapa de preguntas desde JSONB ─────────────────────────
    const genQuestions: { id: string | number; stem: string; points: number; question_type: string }[] = instance.generated_questions || []
    const questionMap: Record<string, { stem: string; points: number }> = {}
    for (const q of genQuestions) {
      questionMap[String(q.id)] = { stem: q.stem, points: q.points || 0 }
    }

    // ── 4. Criterios del docente (opcionales) ────────────────────
    const qIds = responses.map(r => r.question_id)
    const { data: criteriaRows } = await supabase
      .from('question_criteria')
      .select('question_id, model_answer, key_concepts, rubric, rigor_level, bloom_level, ai_correction_context')
      .in('question_id', qIds)

    const criteriaMap: Record<string, Criteria> = {}
    for (const c of (criteriaRows || [])) {
      criteriaMap[c.question_id] = c as Criteria
    }

    // ── 5. Corregir cada respuesta ───────────────────────────────
    const feedbacks: { response_id: string; question_id: string; feedback: string; score: number; max: number; confidence: number; requires_review: boolean }[] = []

    for (const resp of responses) {
      const qData = questionMap[resp.question_id]
      if (!qData) continue

      const studentAnswer = typeof resp.answer?.text === 'string' ? resp.answer.text.trim() : JSON.stringify(resp.answer)
      const maxPts        = resp.points_possible || qData.points || 0
      const criteria      = criteriaMap[resp.question_id] || null

      const prompt   = buildPrompt(qData.stem, maxPts, criteria, studentAnswer)
      const aiResult = await callClaude(prompt, maxPts)

      await supabase.from('exam_responses').update({
        ai_score:              aiResult.score,
        ai_feedback:           aiResult.feedback,
        ai_confidence:         aiResult.confidence,
        requires_human_review: aiResult.requires_review,
        ai_correction_status:  'done',
      }).eq('id', resp.id)

      feedbacks.push({
        response_id:     resp.id,
        question_id:     resp.question_id,
        feedback:        aiResult.feedback,
        score:           aiResult.score,
        max:             maxPts,
        confidence:      aiResult.confidence,
        requires_review: aiResult.requires_review,
      })
    }

    // ── 6. Recalcular nota total ─────────────────────────────────
    const { data: allResponses } = await supabase
      .from('exam_responses')
      .select('ai_correction_status, auto_score, ai_score, points_possible')
      .eq('instance_id', instance_id)

    let totalScore = 0, maxScore = 0, stillPending = 0
    for (const r of (allResponses || [])) {
      maxScore += r.points_possible || 0
      if (r.ai_correction_status === 'not_needed') {
        totalScore += r.auto_score || 0
      } else if (r.ai_correction_status === 'done') {
        totalScore += r.ai_score || 0
      } else {
        stillPending++
      }
    }

    const colombianGrade = (maxScore > 0 && stillPending === 0)
      ? Math.round((Math.min(5.0, Math.max(1.0, (totalScore / maxScore) * 4 + 1))) * 10) / 10
      : null

    // ── 7. Guardar en exam_results ───────────────────────────────
    if (colombianGrade !== null) {
      await supabase.from('exam_results').upsert({
        instance_id,
        session_id:        instance.session_id,
        school_id:         instance.school_id,
        total_score:       Math.round(totalScore * 100) / 100,
        max_score:         Math.round(maxScore  * 100) / 100,
        colombian_grade:   colombianGrade,
        correction_status: 'complete',
      }, { onConflict: 'instance_id' })
    }

    const requiresReview = feedbacks.some(f => f.requires_review)

    console.log(`[exam-response-corrector] instance=${instance_id} corrected=${feedbacks.length} grade=${colombianGrade} review=${requiresReview}`)

    return new Response(JSON.stringify({
      corrected:       feedbacks.length,
      total_score:     Math.round(totalScore * 100) / 100,
      max_score:       Math.round(maxScore   * 100) / 100,
      colombian_grade: colombianGrade,
      requires_review: requiresReview,
      feedbacks,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } })

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[exam-response-corrector] fatal:', message)
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
  }
})
