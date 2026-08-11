// eval-response-corrector — Edge Function for CBF Eval
// Corrects open-ended responses (short_answer, development) using Claude AI.
// Input:  POST { instance_id: string }
// Output: { corrected, total_score, max_score, colombian_grade, requires_review, feedbacks[] }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY    = Deno.env.get('ANTHROPIC_API_KEY')
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TELEGRAM_BOT_TOKEN   = Deno.env.get('TELEGRAM_BOT_TOKEN') || ''
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

// ── Telegram ───────────────────────────────────────────────────

async function sendTelegram(chatId: string, text: string) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
  } catch (e) {
    console.error('Telegram send failed:', e)
  }
}

// ── Prompt builder ─────────────────────────────────────────────

interface Criteria {
  model_answer?:  string | null
  key_concepts?:  string[] | null
  rigor_level?:   string | null
  bloom_level?:   string | null
}

interface ExamContext {
  subject?:    string | null
  grade?:      string | null
  difficulty?: string | null
}

const CEFR_MAP: Record<string, string> = {
  easy:   'A1+–A2 (beginner — basic vocabulary, simple structures)',
  medium: 'A2+–B1 (intermediate — contextual use, some complexity)',
  hard:   'B1+–B2 (upper-intermediate — analysis, inference, academic vocabulary)',
  mixed:  'A1+–B2 (mixed levels)',
}

function buildPrompt(stem: string, maxPoints: number, criteria: Criteria | null, studentAnswer: string, examCtx: ExamContext): string {
  const rigorMap: Record<string, string> = {
    strict:     'Rigor alto — el estudiante debe mencionar términos y conceptos exactos.',
    flexible:   'Rigor medio — acepta paráfrasis que demuestren comprensión real.',
    conceptual: 'Rigor conceptual — evalúa si captó la idea central, por cualquier camino.',
  }
  const rigor       = rigorMap[(criteria?.rigor_level ?? 'flexible')] ?? rigorMap.flexible
  const modelAnswer = criteria?.model_answer    ? `\nRESPUESTA MODELO:\n${criteria.model_answer}\n`                    : ''
  const keyConcepts = criteria?.key_concepts?.length ? `\nCONCEPTOS CLAVE: ${criteria.key_concepts.join(', ')}\n`      : ''
  const bloom       = criteria?.bloom_level ? `\nNIVEL BLOOM ESPERADO: ${criteria.bloom_level}\n`                      : ''

  const hasReference = modelAnswer || keyConcepts
  const evalStrategy = hasReference
    ? 'Evalúa comparando con la respuesta modelo y los conceptos clave proporcionados.'
    : 'No hay respuesta modelo. Evalúa si la respuesta demuestra comprensión correcta del tema basándote en tu conocimiento. Sé justo pero exigente.'

  // Build exam context section
  const ctxLines: string[] = []
  if (examCtx.subject) ctxLines.push(`MATERIA: ${examCtx.subject}`)
  if (examCtx.grade)   ctxLines.push(`GRADO: ${examCtx.grade}`)
  if (examCtx.difficulty && CEFR_MAP[examCtx.difficulty]) {
    ctxLines.push(`NIVEL ESPERADO (CEFR): ${CEFR_MAP[examCtx.difficulty]}`)
  }
  const ctxBlock = ctxLines.length > 0 ? ctxLines.join('\n') + '\n' : ''

  // Language-specific grading instructions
  const isLanguageExam = /english|ingl[eé]s|language|lengua/i.test(examCtx.subject || '')
  const langInstructions = isLanguageExam
    ? `\nINSTRUCCIONES PARA EXAMEN DE IDIOMAS:
- Evalúa gramática, ortografía y estructura además del contenido.
- Errores gramaticales que cambien el significado: penalizar significativamente.
- Errores menores (artículos, preposiciones) que no afecten comprensión: penalización leve.
- La respuesta DEBE estar en el idioma solicitado por la pregunta. Si la pregunta es en inglés, la respuesta debe ser en inglés.
- Si el estudiante responde en español a una pregunta en inglés: máximo 30% del puntaje (demuestra comprensión pero no competencia lingüística).
- Evalúa según el nivel CEFR indicado: no exijas perfección de un A2, pero sí precisión razonable para el nivel.\n`
    : ''

  return `Eres un corrector académico experto. Evalúa esta respuesta de forma justa y pedagógica.

${ctxBlock}PREGUNTA: ${stem}
PUNTAJE MÁXIMO: ${maxPoints} puntos
${bloom}${modelAnswer}${keyConcepts}
ESTRATEGIA DE EVALUACIÓN: ${evalStrategy}
CRITERIO DE RIGOR: ${rigor}
${langInstructions}
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
- confidence < ${REVIEW_THRESHOLD} indica que el docente debe revisar${!hasReference ? '\n- Sin respuesta modelo: usa confidence más baja (0.5-0.7) para que el docente revise' : ''}
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
      feedback:        String(parsed.feedback || 'Evaluado por IA.'),
      confidence,
      requires_review: confidence < REVIEW_THRESHOLD,
    }
  } catch {
    clearTimeout(timeout)
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

    // ── 1. Load instance ────────────────────────────────────────
    const { data: instance, error: instErr } = await supabase
      .from('eval_instances')
      .select('id, session_id, school_id, generated_questions, student_name')
      .eq('id', instance_id)
      .single()

    if (instErr || !instance) {
      return new Response(JSON.stringify({ error: 'Instancia no encontrada' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // ── 1b. Load exam context (subject, grade, difficulty) ─────
    let examCtx: ExamContext = {}
    try {
      const { data: session } = await supabase
        .from('eval_sessions')
        .select('blueprint_id, grade')
        .eq('id', instance.session_id)
        .single()
      if (session?.blueprint_id) {
        const { data: bp } = await supabase
          .from('eval_blueprints')
          .select('subject, difficulty')
          .eq('id', session.blueprint_id)
          .single()
        examCtx = {
          subject:    bp?.subject || null,
          grade:      session?.grade || null,
          difficulty: bp?.difficulty || null,
        }
      }
    } catch (e) {
      console.error('[eval-response-corrector] Could not load exam context (non-fatal):', e)
    }

    // ── 2. Pending open responses ───────────────────────────────
    const { data: responses, error: respErr } = await supabase
      .from('eval_responses')
      .select('id, question_id, question_type, answer, points_possible')
      .eq('instance_id', instance_id)
      .eq('ai_correction_status', 'pending')

    if (respErr) throw new Error(respErr.message)

    if (!responses || responses.length === 0) {
      return new Response(JSON.stringify({ corrected: 0, message: 'Sin respuestas pendientes' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // ── 3. Question map from generated_questions JSONB ──────────
    const genQuestions: { id: string; stem: string; points: number; criteria?: Criteria | null }[] = instance.generated_questions || []
    const questionMap: Record<string, { stem: string; points: number; criteria: Criteria | null }> = {}
    for (const q of genQuestions) {
      questionMap[String(q.id)] = { stem: q.stem, points: q.points || 0, criteria: q.criteria || null }
    }

    // ── 4. Correct each response ────────────────────────────────
    const feedbacks: { response_id: string; question_id: string; feedback: string; score: number; max: number; confidence: number; requires_review: boolean }[] = []

    for (let i = 0; i < responses.length; i++) {
      const resp = responses[i]
      const qData = questionMap[resp.question_id]
      if (!qData) {
        // Question not found in blueprint — mark as done with 0 score to prevent permanent pending
        console.error(`[eval-response-corrector] question_id ${resp.question_id} not found in blueprint for response ${resp.id}`)
        await supabase.from('eval_responses').update({
          ai_score: 0,
          ai_feedback: 'Pregunta no encontrada en el examen. El docente revisará esta respuesta.',
          ai_confidence: 0.1,
          requires_human_review: true,
          ai_correction_status: 'done',
        }).eq('id', resp.id)
        feedbacks.push({ response_id: resp.id, question_id: resp.question_id, feedback: 'Pregunta no encontrada', score: 0, max: 0, confidence: 0.1, requires_review: true })
        continue
      }

      const studentAnswer = typeof resp.answer?.text === 'string' ? resp.answer.text.trim() : JSON.stringify(resp.answer)
      const maxPts        = resp.points_possible || qData.points || 0
      const criteria      = qData.criteria || null

      const prompt   = buildPrompt(qData.stem, maxPts, criteria, studentAnswer, examCtx)

      try {
        const aiResult = await callClaude(prompt, maxPts)

        // Only mark as 'done' if callClaude succeeded (non-zero confidence)
        if (aiResult.confidence > 0) {
          await supabase.from('eval_responses').update({
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
        } else {
          // AI call failed — mark as done with 0 score to prevent permanent pending
          console.error(`[eval-response-corrector] AI failed for response ${resp.id}, marking as done for human review`)
          await supabase.from('eval_responses').update({
            ai_score: 0,
            ai_feedback: 'La corrección automática no pudo completarse. El docente revisará esta respuesta.',
            ai_confidence: 0,
            requires_human_review: true,
            ai_correction_status: 'done',
          }).eq('id', resp.id)
          feedbacks.push({ response_id: resp.id, question_id: resp.question_id, feedback: 'AI failed', score: 0, max: maxPts, confidence: 0, requires_review: true })
        }
      } catch (err) {
        console.error(`[eval-response-corrector] Error correcting ${resp.id}:`, err)
        await supabase.from('eval_responses').update({
          ai_score: 0,
          ai_feedback: 'Error durante la corrección. El docente revisará esta respuesta.',
          ai_confidence: 0,
          requires_human_review: true,
          ai_correction_status: 'done',
        }).eq('id', resp.id)
        feedbacks.push({ response_id: resp.id, question_id: resp.question_id, feedback: 'Error', score: 0, max: resp.points_possible || 0, confidence: 0, requires_review: true })
      }

      // Rate-limit delay between Claude calls (skip after last)
      if (i < responses.length - 1) {
        await new Promise(r => setTimeout(r, 500))
      }
    }

    // ── 5. Recalculate total grade ──────────────────────────────
    const { data: allResponses } = await supabase
      .from('eval_responses')
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

    // ── 6. Upsert eval_results ──────────────────────────────────
    if (colombianGrade !== null) {
      await supabase.from('eval_results').upsert({
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

    // ── 7. Telegram notification to teacher ────────────────────────
    if (colombianGrade !== null && TELEGRAM_BOT_TOKEN) {
      try {
        const { data: session } = await supabase
          .from('eval_sessions')
          .select('teacher_id, title')
          .eq('id', instance.session_id)
          .single()

        if (session?.teacher_id) {
          const { data: teacher } = await supabase
            .from('teachers')
            .select('telegram_chat_id')
            .eq('id', session.teacher_id)
            .single()

          if (teacher?.telegram_chat_id) {
            // Fetch school name for multi-school context
            const { data: schoolRow } = await supabase
              .from('schools').select('short_name, name')
              .eq('id', instance.school_id).single()
            const schoolLabel = schoolRow?.short_name || schoolRow?.name || ''
            const schoolLine  = schoolLabel ? `\n🏫 *${schoolLabel}*` : ''

            const grade      = colombianGrade
            const levelLabel = grade >= 4.5 ? 'Superior' : grade >= 4.0 ? 'Alto' : grade >= 3.5 ? 'Básico' : 'Bajo'
            const levelEmoji = grade >= 4.5 ? '⭐' : grade >= 4.0 ? '✅' : grade >= 3.5 ? '📘' : '❗'
            const reviewNote = requiresReview ? '\n⚠️ _Requiere revisión humana_' : ''
            const msg = `✅ *${instance.student_name || 'Estudiante'}* entregó el examen${schoolLine}\n📋 *${session.title || 'Examen'}*\n\n📊 Nota: *${grade.toFixed(1)} — ${levelLabel}* ${levelEmoji}\n📝 Puntaje: ${Math.round(totalScore * 10) / 10}/${Math.round(maxScore * 10) / 10} pts${reviewNote}`
            await sendTelegram(teacher.telegram_chat_id, msg)
          }
        }
      } catch (e) {
        console.error('[eval-response-corrector] Telegram error (non-fatal):', e)
      }
    }

    console.log(`[eval-response-corrector] instance=${instance_id} corrected=${feedbacks.length} grade=${colombianGrade} review=${requiresReview}`)

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
    console.error('[eval-response-corrector] fatal:', message)
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
  }
})
