// ============================================================
// CBF PLANNER — dictation-corrector
// Supabase Edge Function (Deno)
//
// Corrección server-side de un dictation. Verifica las respuestas
// del estudiante contra las correctas (que el cliente no tiene).
// Calcula nota colombiana y envía Telegram al docente.
//
// Input:  { instance_id }
// Output: { ok, total_score, max_score, colombian_grade, grade_level }
//
// Deploy: supabase functions deploy dictation-corrector --no-verify-jwt
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

// ── Levenshtein distance ──────────────────────────────────────────────────
function levenshtein(a: string, b: string): number {
  const an = a.length, bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix: number[][] = [];
  for (let i = 0; i <= an; i++) {
    matrix[i] = [i];
    for (let j = 1; j <= bn; j++) {
      matrix[i][j] = i === 0 ? j : 0;
    }
  }
  for (let i = 1; i <= an; i++) {
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[an][bn];
}

// ── Score a typed word ────────────────────────────────────────────────────
function scoreTypedWord(answer: string, correct: string, maxScore: number): { score: number; isCorrect: boolean; isPartial: boolean } {
  if (!answer || !answer.trim()) return { score: 0, isCorrect: false, isPartial: false };
  const a = answer.trim().toLowerCase();
  const c = correct.trim().toLowerCase();
  if (a === c) return { score: maxScore, isCorrect: true, isPartial: false };
  const dist = levenshtein(a, c);
  if (dist <= 1) return { score: maxScore * 0.5, isCorrect: false, isPartial: true };
  return { score: 0, isCorrect: false, isPartial: false };
}

// ── Colombian grade scale ─────────────────────────────────────────────────
function colombianGrade(score: number, max: number): number | null {
  if (!max || max === 0) return null;
  const grade = (score / max) * 4 + 1;
  return Math.round(Math.min(5, Math.max(1, grade)) * 10) / 10;
}

function gradeLevel(g: number | null): string {
  if (g == null) return "N/A";
  if (g >= 4.50) return "Superior";
  if (g >= 4.00) return "Alto";
  if (g >= 3.50) return "Básico";
  return "Bajo";
}

function gradeEmoji(level: string): string {
  return level === "Superior" ? "⭐" : level === "Alto" ? "✅" : level === "Básico" ? "📘" : "❗";
}

// ── Telegram ──────────────────────────────────────────────────────────────
async function sendTelegram(chatId: string, text: string) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });
  } catch (e) {
    console.error("Telegram send failed:", e);
  }
}

// ── Main handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const corsOrigin = getCorsOrigin(req);
  const corsHeaders = {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { instance_id } = await req.json();
    if (!instance_id) {
      return new Response(
        JSON.stringify({ error: "instance_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Load instance with generated_questions (has correct_answer)
    const { data: instance, error: instErr } = await supabase
      .from("dictation_instances")
      .select("*, dictation_sessions(teacher_id, title)")
      .eq("id", instance_id)
      .single();

    if (instErr || !instance) {
      return new Response(
        JSON.stringify({ error: "Instance not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Load student responses
    const { data: responses } = await supabase
      .from("dictation_responses")
      .select("*")
      .eq("instance_id", instance_id)
      .order("question_index");

    if (!responses || responses.length === 0) {
      return new Response(
        JSON.stringify({ error: "No responses found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const questions = instance.generated_questions || [];

    // 3. Score each response
    let totalScore = 0;
    let maxScore = 0;
    const sectionScores: Record<string, { score: number; max: number; correct: number; total: number }> = {};

    for (const resp of responses) {
      const q = questions[resp.question_index];
      if (!q) continue;

      const type = resp.question_type;
      if (!sectionScores[type]) sectionScores[type] = { score: 0, max: 0, correct: 0, total: 0 };

      const maxPts = q.max_score || 1;
      sectionScores[type].max += maxPts;
      sectionScores[type].total += 1;
      maxScore += maxPts;

      let score = 0;
      let isCorrect = false;
      let isPartial = false;

      if (type === "listen_type") {
        const result = scoreTypedWord(resp.answer || "", q.correct_answer, maxPts);
        score = result.score;
        isCorrect = result.isCorrect;
        isPartial = result.isPartial;
      } else {
        // MC: exact match (case-insensitive)
        isCorrect = (resp.answer || "").trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
        score = isCorrect ? maxPts : 0;
      }

      sectionScores[type].score += score;
      if (isCorrect) sectionScores[type].correct += 1;
      totalScore += score;

      // Update response with server-verified score
      await supabase
        .from("dictation_responses")
        .update({ score, is_correct: isCorrect || isPartial })
        .eq("id", resp.id);
    }

    // 4. Calculate Colombian grade
    const grade = colombianGrade(totalScore, maxScore);
    const level = gradeLevel(grade);

    // 5. Upsert result
    await supabase
      .from("dictation_results")
      .upsert({
        instance_id,
        total_score: totalScore,
        max_score: maxScore,
        colombian_grade: grade,
        grade_level: level,
        section_scores: sectionScores,
      }, { onConflict: "instance_id" });

    // 6. Send Telegram to teacher
    const teacherId = instance.dictation_sessions?.teacher_id;
    if (teacherId) {
      const { data: teacher } = await supabase
        .from("teachers")
        .select("telegram_chat_id")
        .eq("id", teacherId)
        .single();

      if (teacher?.telegram_chat_id) {
        const emoji = gradeEmoji(level);
        const code = instance.id.slice(-6).toUpperCase();
        const title = instance.dictation_sessions?.title || "Dictation";
        const msg = [
          `${emoji} *DICTATION RESULT*`,
          `📝 ${title}`,
          `👤 ${instance.student_name || "Anónimo"} (${instance.student_section || "?"})`,
          `🔑 Código: \`${code}\``,
          `📊 ${totalScore}/${maxScore} — *${grade}/5.0* (${level})`,
          `⏱ ${instance.time_spent_seconds ? Math.round(instance.time_spent_seconds / 60) + " min" : "N/A"}`,
          instance.tab_switches > 0 ? `⚠️ Violaciones: ${instance.tab_switches}` : "",
        ].filter(Boolean).join("\n");

        await sendTelegram(teacher.telegram_chat_id, msg);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        total_score: totalScore,
        max_score: maxScore,
        colombian_grade: grade,
        grade_level: level,
        section_scores: sectionScores,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("dictation-corrector error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
