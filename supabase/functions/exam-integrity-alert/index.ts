// ============================================================
// CBF PLANNER — exam-integrity-alert
// Supabase Edge Function (Deno) — Sesión L
//
// Recibe un evento de integridad desde ExamPlayerV2Page y:
//   1. Actualiza integrity_flags en exam_instances (DB)
//   2. Envía alerta Telegram al docente (si tiene telegram_chat_id)
//
// Throttle: el frontend controla la frecuencia (1/60s por sesión).
// Esta función siempre procesa lo que recibe.
// ============================================================

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

const EVENT_LABELS: Record<string, string> = {
  tab_switch:      "cambió de pestaña",
  window_blur:     "perdió el foco de ventana",
  fullscreen_exit: "salió de pantalla completa",
  devtools_open:   "abrió DevTools",
  blocked_key:     "intentó tecla bloqueada (F12/Ctrl+U/etc.)",
  beforeunload:    "intentó cerrar la página",
  context_menu:    "click derecho",
  copy_attempt:    "intentó copiar/cortar",
  pagehide:        "ocultó la página (iOS background)",
};

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
      student_name,
      exam_title,
      event_type,
      count,
    } = await req.json();

    if (!instance_id) return json({ error: "instance_id requerido" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 1. Actualizar integrity_flags en DB ──────────────────
    await supabase.from("exam_instances").update({
      tab_switches: count,
      integrity_flags: {
        high_risk: count >= 3,
        last_event: event_type,
        violation_count: count,
        updated_at: new Date().toISOString(),
      },
    }).eq("id", instance_id);

    // ── 2. Obtener teacher_id desde exam_sessions ────────────
    if (!session_id) return json({ ok: true, telegram: false });

    const { data: sess } = await supabase
      .from("exam_sessions")
      .select("teacher_id, title")
      .eq("id", session_id)
      .maybeSingle();

    const teacherId = sess?.teacher_id;
    if (!teacherId) return json({ ok: true, telegram: false });

    // ── 3. Obtener telegram_chat_id del docente ──────────────
    const { data: teacher } = await supabase
      .from("teachers")
      .select("telegram_chat_id, full_name")
      .eq("id", teacherId)
      .maybeSingle();

    if (!teacher?.telegram_chat_id || !TELEGRAM_BOT_TOKEN) {
      return json({ ok: true, telegram: false });
    }

    // ── 4. Enviar alerta Telegram ────────────────────────────
    const riskEmoji = count >= 5 ? "🚨" : count >= 3 ? "⚠️" : "📢";
    const label = EVENT_LABELS[event_type] || event_type;
    const title = exam_title || sess?.title || "Examen";

    const lines = [
      `${riskEmoji} *ALERTA DE INTEGRIDAD — CBF*`,
      `👤 *${student_name || "Estudiante desconocido"}*`,
      `📝 ${title}`,
      `🔍 Evento: ${label}`,
      `📊 Total alertas: *${count}*`,
    ];
    if (count >= 3) lines.push("🔴 *RIESGO ALTO — Revisar manualmente*");

    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: teacher.telegram_chat_id,
          text: lines.join("\n"),
          parse_mode: "Markdown",
        }),
      },
    );

    const telegramOk = res.ok;
    return json({ ok: true, telegram: telegramOk });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
