import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
const DEFAULT_ADMIN_CHAT_ID = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID') || '2041749428'

const ALLOWED_ORIGINS = [
  'https://classroomsos.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
]
function getCorsOrigin(req: Request): string {
  const origin = req.headers.get('Origin') || ''
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
}

interface LogEventPayload {
  module: string
  function_name: string
  message: string
  severity?: 'debug' | 'info' | 'warn' | 'error' | 'critical'
  error_code?: string
  step?: string
  school_id?: string
  user_id?: string
  assessment_id?: string
  session_id?: string
  submission_id?: string
  payload_in?: Record<string, unknown>
  payload_out?: Record<string, unknown>
  stack_trace?: string
  duration_ms?: number
  environment?: string
}

async function sendTelegramAlert(chatId: string, event: LogEventPayload, errorCode: string) {
  if (!TELEGRAM_BOT_TOKEN) return

  const emoji = { debug: '🔍', info: 'ℹ️', warn: '⚠️', error: '🔴', critical: '🚨' }[event.severity || 'error'] || '🔴'

  const message = [
    `${emoji} *CBF SYSTEM ALERT*`,
    `*Código:* \`${errorCode}\``,
    `*Módulo:* ${event.module}`,
    `*Función:* ${event.function_name}`,
    event.step ? `*Paso:* ${event.step}` : null,
    `*Mensaje:* ${event.message}`,
    event.school_id ? `*School ID:* \`${event.school_id}\`` : null,
    `*Hora:* ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`,
  ].filter(Boolean).join('\n')

  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
  }).catch(() => {})
}

async function evaluateAlertRules(supabase: ReturnType<typeof createClient>, eventId: string, event: LogEventPayload) {
  const { data: rules } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('active', true)
    .or(`error_code.eq.${event.error_code},error_code.is.null`)
    .or(`module.eq.${event.module},module.is.null`)

  if (!rules || rules.length === 0) return

  for (const rule of rules) {
    const windowStart = new Date(Date.now() - rule.threshold_minutes * 60 * 1000).toISOString()

    const { count } = await supabase
      .from('system_events')
      .select('*', { count: 'exact', head: true })
      .eq('error_code', event.error_code || '')
      .gte('created_at', windowStart)

    if ((count || 0) >= rule.threshold_count) {
      const { data: existingAlert } = await supabase
        .from('system_alerts')
        .select('id')
        .eq('rule_id', rule.id)
        .eq('status', 'open')
        .gte('created_at', windowStart)
        .maybeSingle()

      if (!existingAlert) {
        await supabase.from('system_alerts').insert({
          rule_id: rule.id, school_id: event.school_id || null, trigger_event_id: eventId,
          error_code: event.error_code, module: event.module, severity: event.severity || 'error',
          title: rule.name, summary: event.message, event_count: count || 1, status: 'open',
        })

        if (rule.notify_telegram && event.error_code) {
          const chatId = rule.telegram_chat_id || DEFAULT_ADMIN_CHAT_ID
          await sendTelegramAlert(chatId, event, event.error_code)
          await supabase.from('system_alerts').update({ telegram_sent: true, telegram_sent_at: new Date().toISOString() }).eq('rule_id', rule.id).eq('status', 'open')
        }
      }
    }
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': getCorsOrigin(req), 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Vary': 'Origin' } })
  }

  try {
    const payload: LogEventPayload = await req.json()

    if (!payload.module || !payload.function_name || !payload.message) {
      return new Response(JSON.stringify({ error: 'module, function_name y message son requeridos' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { data: insertedEvent, error: insertError } = await supabase
      .from('system_events')
      .insert({
        school_id: payload.school_id || null, error_code: payload.error_code || null,
        severity: payload.severity || 'info', module: payload.module,
        function_name: payload.function_name, step: payload.step || null,
        message: payload.message, payload_in: payload.payload_in || null,
        payload_out: payload.payload_out || null, stack_trace: payload.stack_trace || null,
        duration_ms: payload.duration_ms || null, user_id: payload.user_id || null,
        assessment_id: payload.assessment_id || null, session_id: payload.session_id || null,
        submission_id: payload.submission_id || null, environment: payload.environment || 'production',
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[cbf-logger] Failed to insert event:', insertError.message)
      return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    if (insertedEvent && ['warn', 'error', 'critical'].includes(payload.severity || 'info') && payload.error_code) {
      await evaluateAlertRules(supabase, insertedEvent.id, payload)
    }

    return new Response(JSON.stringify({ success: true, event_id: insertedEvent?.id }), { headers: { 'Content-Type': 'application/json' } })

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[cbf-logger] Fatal error:', message)
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
