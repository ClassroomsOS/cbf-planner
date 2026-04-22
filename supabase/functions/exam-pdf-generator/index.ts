// ============================================================
// CBF PLANNER — exam-pdf-generator
// Supabase Edge Function (Deno)
// Versión: 1.0.0 — 2026-04-22
//
// Genera un HTML imprimible con encabezado CBF-G AC-01 para cada
// instancia de examen. Lo sube a Storage y actualiza pdf_url.
// Contingencia papel: el docente descarga y manda a imprimir.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL        = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STORAGE_BUCKET      = "exam-pdfs";

// ─── Handler ─────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return res(null, 204);
  }
  if (req.method !== "POST") return res({ error: "Method not allowed" }, 405);

  const { instance_id, school_id } = await req.json().catch(() => ({}));
  if (!instance_id || !school_id) {
    return res({ error: "instance_id y school_id son requeridos" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // 1. Cargar instancia + sesión + escuela
    const { data: instance, error: iErr } = await supabase
      .from("exam_instances")
      .select("*, exam_sessions(title, subject, grade, period, duration_minutes, blueprint_id, teacher_id)")
      .eq("id", instance_id)
      .eq("school_id", school_id)
      .single();

    if (iErr || !instance) throw new Error(`Instancia no encontrada: ${iErr?.message}`);

    const session = instance.exam_sessions as Record<string, unknown>;

    const { data: school } = await supabase
      .from("schools")
      .select("name, dane, resolution, logo_url")
      .eq("id", school_id)
      .single();

    // 2. Generar HTML
    const html = buildExamHtml(instance, session, school ?? {});

    // 3. Subir a Storage
    const path = `${school_id}/${instance.session_id}/${instance_id}.html`;
    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, new TextEncoder().encode(html), {
        contentType: "text/html; charset=utf-8",
        upsert: true,
      });

    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

    // 4. URL pública firmada (24h — suficiente para el día del examen)
    const { data: signed } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, 86400);

    const pdf_url = signed?.signedUrl ?? "";

    // 5. Actualizar instancia
    await supabase
      .from("exam_instances")
      .update({ pdf_url, pdf_generated_at: new Date().toISOString() })
      .eq("id", instance_id);

    await log(supabase, school_id, "info",
      `PDF generado: ${instance.student_name} (Versión ${instance.version_label})`);

    return res({ ok: true, pdf_url, instance_id });

  } catch (err) {
    await log(supabase, school_id, "error",
      `PDF generation failed: ${err.message}`, "CBF-EXAM-PDF-001");
    return res({ error: err.message }, 500);
  }
});

// ─── Builder HTML ─────────────────────────────────────────────

function buildExamHtml(
  instance: Record<string, unknown>,
  session: Record<string, unknown>,
  school: Record<string, unknown>
): string {
  const questions = (instance.generated_questions as Record<string, unknown>[]) ?? [];
  const studentName = (instance.student_name as string) ?? "Estudiante";
  const versionLabel = (instance.version_label as string) ?? "A";

  const questionsHtml = questions.map((q, i) => buildQuestion(q, i + 1)).join("\n");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(session.title as string)} — ${esc(studentName)}</title>
<style>
  @media print { @page { margin: 1.5cm; size: letter; } }
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #000;
         max-width: 720px; margin: 0 auto; padding: 20px; }
  /* Marca de agua */
  body::before {
    content: "${esc(studentName)} · Versión ${versionLabel}";
    position: fixed; top: 45%; left: -10%;
    width: 130%; text-align: center;
    font-size: 36pt; color: rgba(0,0,0,0.06);
    transform: rotate(-30deg); pointer-events: none;
    z-index: 0; white-space: nowrap;
  }
  /* Encabezado CBF-G AC-01 */
  .cbf-header { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 16px; }
  .cbf-header td { border: 1px solid #000; padding: 4px 6px; vertical-align: middle; font-size: 9pt; }
  .cbf-header .logo-cell { width: 15.3%; text-align: center; }
  .cbf-header .logo-cell img { max-height: 56px; }
  .cbf-header .title-cell { width: 61%; text-align: center; font-weight: bold; font-size: 10pt; }
  .cbf-header .code-cell { width: 23.7%; font-size: 8pt; }
  .cbf-header .proceso-cell { text-align: center; font-size: 8pt; }
  /* Info del examen */
  .exam-info { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10pt; }
  .exam-info td { border: 1px solid #ccc; padding: 4px 8px; }
  .exam-info .label { font-weight: bold; background: #f5f5f5; width: 30%; }
  /* Preguntas */
  .question { margin-bottom: 20px; page-break-inside: avoid; position: relative; z-index: 1; }
  .question-stem { font-weight: bold; margin-bottom: 6px; }
  .question-num { color: #1F3864; margin-right: 4px; }
  .options { list-style: none; padding: 0; margin: 6px 0 0 16px; }
  .options li { margin-bottom: 4px; }
  .blank-line { border-bottom: 1px solid #000; height: 20px; margin: 6px 0; }
  .section-header { background: #1F3864; color: #fff; padding: 6px 10px;
                    font-weight: bold; margin: 20px 0 10px; font-size: 10pt; }
  .biblical-badge { font-size: 8pt; color: #1A6B3A; margin-left: 8px; }
  .footer { text-align: center; font-size: 8pt; color: #888; margin-top: 32px;
            border-top: 1px solid #ccc; padding-top: 8px; }
</style>
</head>
<body>

<!-- Encabezado CBF-G AC-01 -->
<table class="cbf-header">
  <colgroup>
    <col style="width:15.3%">
    <col style="width:61%">
    <col style="width:23.7%">
  </colgroup>
  <tbody>
    <tr>
      <td rowspan="3" class="logo-cell">
        ${school.logo_url
          ? `<img src="${esc(school.logo_url as string)}" alt="Logo">`
          : `<div style="font-size:8pt;font-weight:bold">${esc((school.name as string) ?? "CBF")}</div>`
        }
      </td>
      <td class="title-cell">
        ${esc((school.name as string) ?? "COLEGIO BOSTON FLEXIBLE")}<br>
        <span style="font-weight:normal;font-size:8pt">
          DANE: ${esc((school.dane as string) ?? "308001800455")} &nbsp;·&nbsp;
          Res. ${esc((school.resolution as string) ?? "09685/2019")}
        </span>
      </td>
      <td class="code-cell">CÓD: CBF - G AC - 01</td>
    </tr>
    <tr>
      <td rowspan="2" class="proceso-cell">
        PROCESO: GESTIÓN ACADÉMICA Y CURRICULAR<br>
        <span style="font-style:italic">Evaluación</span>
      </td>
      <td class="code-cell">Versión: 1.0</td>
    </tr>
    <tr>
      <td class="code-cell">Página: 1 de 1</td>
    </tr>
  </tbody>
</table>

<!-- Info del examen -->
<table class="exam-info">
  <tr>
    <td class="label">Nombre</td>
    <td>${esc(studentName)}</td>
    <td class="label">Versión</td>
    <td>${esc(versionLabel)}</td>
  </tr>
  <tr>
    <td class="label">Asignatura</td>
    <td>${esc(session.subject as string)}</td>
    <td class="label">Grado</td>
    <td>${esc(session.grade as string)}</td>
  </tr>
  <tr>
    <td class="label">Período</td>
    <td>${session.period}</td>
    <td class="label">Tiempo</td>
    <td>${session.duration_minutes} minutos</td>
  </tr>
  <tr>
    <td class="label">Fecha</td>
    <td colspan="3">${new Date().toLocaleDateString("es-CO", { day:"2-digit", month:"long", year:"numeric" })}</td>
  </tr>
</table>

<!-- Preguntas -->
${questionsHtml}

<div class="footer">
  Colegio Boston Flexible · "AÑO DE LA PUREZA" · Génesis 1:27-28a (TLA)<br>
  ${esc(studentName)} · Versión ${esc(versionLabel)} · Generado el ${new Date().toLocaleString("es-CO")}
</div>
</body>
</html>`;
}

function buildQuestion(q: Record<string, unknown>, num: number): string {
  const isFirstInSection = (q.order_position as number) === 1;
  const sectionHeader = isFirstInSection
    ? `<div class="section-header">${esc(q.section_name as string)}</div>` : "";

  const biblical = q.biblical
    ? `<span class="biblical-badge">✝</span>` : "";

  const stem = `<div class="question-stem">
    <span class="question-num">${num}.</span>${esc(q.stem as string)}${biblical}
    <span style="font-size:9pt;color:#555"> (${q.points} pt${(q.points as number) !== 1 ? "s" : ""})</span>
  </div>`;

  let answer = "";
  const qtype = q.question_type as string;

  if (qtype === "multiple_choice" && Array.isArray(q.options)) {
    answer = `<ul class="options">
      ${(q.options as string[]).map(o => `<li>○ ${esc(o)}</li>`).join("\n")}
    </ul>`;
  } else if (qtype === "true_false") {
    answer = `<ul class="options">
      <li>○ Verdadero &nbsp;&nbsp;&nbsp; ○ Falso</li>
    </ul>`;
  } else if (qtype === "fill_blank") {
    answer = `<div class="blank-line"></div>`;
  } else {
    // short_answer, matching, etc — líneas en blanco
    const lines = qtype === "matching" ? 4 : 3;
    answer = Array(lines).fill(`<div class="blank-line"></div>`).join("\n");
  }

  return `${sectionHeader}<div class="question">${stem}${answer}</div>`;
}

// ─── Utilidades ───────────────────────────────────────────────

function esc(s: string = ""): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function log(
  supabase: ReturnType<typeof createClient>,
  school_id: string,
  severity: string,
  message: string,
  error_code?: string
) {
  try {
    await supabase.from("system_events").insert({
      module: "EXAM", event_type: "exam-pdf-generator",
      severity, message, school_id,
      metadata: error_code ? { error_code } : {},
    });
  } catch { /* never block on log errors */ }
}

function res(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
