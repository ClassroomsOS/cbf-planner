import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

async function logEvent(opts: {
  severity: 'info' | 'warn' | 'error'
  message: string
  error_code?: string
  school_id?: string
  step?: string
  duration_ms?: number
  payload_in?: Record<string, unknown>
  payload_out?: Record<string, unknown>
  stack_trace?: string
}) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    await supabase.from('system_events').insert({
      module: 'AI',
      function_name: 'claude-proxy',
      severity: opts.severity,
      message: opts.message,
      error_code: opts.error_code ?? null,
      step: opts.step ?? null,
      school_id: opts.school_id ?? null,
      duration_ms: opts.duration_ms ?? null,
      payload_in: opts.payload_in ?? null,
      payload_out: opts.payload_out ?? null,
      stack_trace: opts.stack_trace ?? null,
      environment: 'production',
    })
  } catch {
    // Non-blocking — never let logging break the proxy
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startMs = Date.now()
  let body: Record<string, unknown> = {}
  let schoolId: string | undefined

  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured')
    }

    body = await req.json()
    schoolId = body.school_id as string | undefined

    // Build messages array
    const messages = []
    if (body.messages) {
      messages.push(...(body.messages as unknown[]))
    } else {
      messages.push({ role: 'user', content: body.message || '' })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: (body.max_tokens as number) || 4000,
        system: body.system as string | undefined,
        messages,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      const errMsg = (data.error?.message as string) || `Claude API error ${response.status}`
      await logEvent({
        severity: 'error',
        message: errMsg,
        error_code: 'CBF-AI-ERR-001',
        school_id: schoolId,
        step: 'anthropic_call',
        duration_ms: Date.now() - startMs,
        payload_in: { max_tokens: body.max_tokens, has_system: !!body.system },
        payload_out: { status: response.status, error: data.error },
      })
      throw new Error(errMsg)
    }

    const text = data.content
      ?.filter((block: { type: string }) => block.type === 'text')
      ?.map((block: { text: string }) => block.text)
      ?.join('\n') || ''

    const finish_reason = data.stop_reason || ''
    const usage = data.usage as { input_tokens?: number; output_tokens?: number } | undefined
    const durationMs = Date.now() - startMs

    // Log successful call — info level, non-blocking
    logEvent({
      severity: 'info',
      message: `AI call OK — ${usage?.input_tokens ?? 0} in / ${usage?.output_tokens ?? 0} out tokens`,
      school_id: schoolId,
      step: 'success',
      duration_ms: durationMs,
      payload_in: {
        max_tokens: body.max_tokens,
        input_tokens: usage?.input_tokens,
        finish_reason,
      },
      payload_out: { output_tokens: usage?.output_tokens, truncated: finish_reason === 'max_tokens' },
    })

    // Warn if response was truncated
    if (finish_reason === 'max_tokens') {
      logEvent({
        severity: 'warn',
        message: `Response truncated at max_tokens=${body.max_tokens}`,
        error_code: 'CBF-AI-WARN-001',
        school_id: schoolId,
        step: 'truncation_check',
        duration_ms: durationMs,
      })
    }

    return new Response(JSON.stringify({ text, finish_reason, usage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined

    await logEvent({
      severity: 'error',
      message,
      error_code: 'CBF-AI-ERR-001',
      school_id: schoolId,
      step: 'fatal',
      duration_ms: Date.now() - startMs,
      stack_trace: stack,
    })

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
