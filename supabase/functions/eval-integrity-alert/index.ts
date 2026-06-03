// eval-integrity-alert — Edge Function
// Receives anti-cheat events from CBF Eval PlayerPage.
// Updates eval_instances.integrity_flags (violations only).
// Sends Telegram to teacher with anonymous code (last-6 of instance_id).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";

const ALLOWED_ORIGINS = [
  "https://classroomsos.github.io",
  "http://localhost:5173",
  "http://localhost:4173",
];

function getCorsOrigin(req: Request): string {
  const origin = req.headers.get("Origin") || "";
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

const INTEGRITY_LABELS: Record<string, string> = {
  tab_switch:          "cambio de pestana / bloqueo de pantalla",
  window_blur:         "perdio el foco de ventana",
  fullscreen_exit:     "salio de pantalla completa",
  fullscreen_declined: "rechazo el fullscreen al iniciar",
  devtools_open:       "abrio DevTools",
  blocked_key:         "intento tecla bloqueada (F12/Ctrl+U/etc.)",
  beforeunload:        "intento cerrar la pagina",
  context_menu:        "click derecho",
  copy_attempt:        "intento copiar/cortar",
  pagehide:            "oculto la pagina (iOS Home / app switcher)",
};

const CYCLE_EVENTS = new Set(["eval_started", "eval_resumed", "eval_submitted"]);

const CYCLE_META: Record<string, { emoji: string; verb: string }> = {
  eval_started:   { emoji: "🟢", verb: "INICIO el examen" },
  eval_resumed:   { emoji: "🔄", verb: "REANUDO el examen" },
  eval_submitted: { emoji: "✅", verb: "ENVIO el examen" },
};

function bogotaTime(): string {
  return new Date().toLocaleTimeString("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) return false;
  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    },
  );
  return res.ok;
}

Deno.serve(async (req: Request) => {
  const origin = getCorsOrigin(req);
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const {
      session_id,
      instance_id,
      student_section,
      exam_title,
      event_type,
      count,
      start_time,
      submit_time,
      score_info,
    } = await req.json();

    if (!instance_id) return json({ error: "instance_id requerido" }, 400);

    // Validate event_type
    const ALLOWED_EVENTS = new Set([
      ...Object.keys(INTEGRITY_LABELS),
      ...CYCLE_EVENTS,
    ]);
    if (!event_type || !ALLOWED_EVENTS.has(event_type)) {
      return json({ error: "event_type invalido" }, 400);
    }

    if (typeof count !== "number" || count < 0 || count > 9999) {
      return json({ error: "count invalido" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const isCycleEvent = CYCLE_EVENTS.has(event_type);

    // 1. Update integrity_flags (violations only)
    if (!isCycleEvent) {
      await supabase.from("eval_instances").update({
        tab_switches: count,
        integrity_flags: {
          high_risk: count >= 3,
          last_event: event_type,
          violation_count: count,
          updated_at: new Date().toISOString(),
          events: [], // placeholder — PlayerPage sends full events array
        },
      }).eq("id", instance_id);
    }

    // 2. Get teacher_id from eval_sessions
    if (!session_id) return json({ ok: true, telegram: false });

    const { data: sess } = await supabase
      .from("eval_sessions")
      .select("teacher_id, title")
      .eq("id", session_id)
      .maybeSingle();

    const teacherId = sess?.teacher_id;
    if (!teacherId) return json({ ok: true, telegram: false });

    // 3. Get teacher's telegram_chat_id
    const { data: teacher } = await supabase
      .from("teachers")
      .select("telegram_chat_id, full_name")
      .eq("id", teacherId)
      .maybeSingle();

    if (!teacher?.telegram_chat_id || !TELEGRAM_BOT_TOKEN) {
      return json({ ok: true, telegram: false });
    }

    // 4. Build message
    const title    = exam_title || sess?.title || "Examen";
    const anonCode = instance_id ? instance_id.slice(-6).toUpperCase() : "??????";
    const section  = student_section || "—";
    const timeStr  = start_time || submit_time || bogotaTime();

    let msgLines: string[];

    if (isCycleEvent) {
      const meta = CYCLE_META[event_type];
      msgLines = [
        `${meta.emoji} *Codigo ${anonCode} ${meta.verb}*`,
        `📝 ${title}`,
        `🏷 Seccion: ${section}`,
        `🕐 ${timeStr}`,
      ];
      if (score_info) {
        msgLines.push(`📊 Puntaje: ${score_info}`);
      }
      if (event_type === "eval_submitted") {
        msgLines.push("─");
        msgLines.push("_Ver resultados en CBF Eval → Resultados_");
      }
    } else {
      const riskEmoji = count >= 5 ? "🚨" : count >= 3 ? "⚠️" : "📢";
      const label     = INTEGRITY_LABELS[event_type] || event_type;
      msgLines = [
        `${riskEmoji} *ALERTA DE INTEGRIDAD — CBF Eval*`,
        `🔑 Codigo: *${anonCode}* — Seccion: ${section}`,
        `📝 ${title}`,
        `🔍 Evento: ${label}`,
        `📊 Total alertas: *${count}*`,
        `🕐 ${bogotaTime()}`,
      ];
      if (count >= 3) msgLines.push("🔴 *RIESGO ALTO — Revisa el Monitor*");
    }

    const telegramOk = await sendTelegram(
      teacher.telegram_chat_id,
      msgLines.join("\n"),
    );

    return json({ ok: true, telegram: telegramOk });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
