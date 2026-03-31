import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured. Set it with: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...')
    }

    const body = await req.json()

    // Build messages array for Claude API
    const messages = []
    if (body.messages) {
      messages.push(...body.messages)
    } else {
      messages.push({ role: 'user', content: body.message || '' })
    }

    // Claude API request
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: body.max_tokens || 4000,
        system: body.system || undefined,
        messages,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || `Claude API error ${response.status}`)
    }

    // Extract text from Claude's response format
    const text = data.content
      ?.filter((block) => block.type === 'text')
      ?.map((block) => block.text)
      ?.join('\n') || ''

    const finish_reason = data.stop_reason || ''

    return new Response(JSON.stringify({
      text,
      finish_reason,
      usage: data.usage,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
