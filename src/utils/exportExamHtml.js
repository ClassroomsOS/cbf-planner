// ── exportExamHtml.js ─────────────────────────────────────────────────────────
// Generates a printable HTML exam document with the CBF institutional header
// repeating on every printed page (position: fixed in @media print).
//
// The institutional header is IDENTICAL to the one in exportHtml.js — no
// modifications. Same HTML structure, same CSS, same field mapping.
//
// Usage:
//   await printExamHtml({ assessment, questions, school, teacherName })
// ─────────────────────────────────────────────────────────────────────────────

// ── helpers (same as exportHtml.js) ──────────────────────────────────────────
function esc(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function fetchBase64(url) {
  if (!url || url.startsWith('data:')) return url
  try {
    const res = await fetch(url)
    if (!res.ok) return url
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror  = () => resolve(url)
      reader.readAsDataURL(blob)
    })
  } catch {
    return url
  }
}

// ── Question renderers (print layout) ────────────────────────────────────────
const BIBLICAL_KEYS = ['biblical_reflection', 'verse_analysis', 'principle_application']

const TYPE_LABEL = {
  multiple_choice:     'Opción múltiple',
  true_false:          'Verdadero/Falso',
  fill_blank:          'Completar espacio',
  matching:            'Relacionar columnas',
  short_answer:        'Respuesta corta',
  error_correction:    'Corregir el error',
  sequencing:          'Ordenar los pasos',
  open_development:    'Desarrollo',
  biblical_reflection:    'Reflexión bíblica',
  verse_analysis:         'Análisis de versículo',
  principle_application:  'Aplicar el principio',
}

function blankLines(n) {
  return Array.from({ length: n }, () =>
    '<div style="border-bottom:1px solid #999;height:24px;margin-bottom:4px"></div>'
  ).join('')
}

function renderAnswerArea(q) {
  switch (q.question_type) {
    case 'multiple_choice':
      return `<div style="margin-top:10px">
        ${(q.options || []).map(opt => `
          <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:7px">
            <span style="width:16px;height:16px;border:1.5px solid #555;border-radius:50%;
                         display:inline-flex;flex-shrink:0;margin-top:1px"></span>
            <span style="font-size:12px">${esc(opt)}</span>
          </div>`).join('')}
      </div>`

    case 'true_false':
      return `<div style="margin-top:12px;display:flex;gap:32px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="width:16px;height:16px;border:1.5px solid #555;border-radius:50%;
                       display:inline-flex;flex-shrink:0"></span>
          <span style="font-size:13px;font-weight:600">Verdadero</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="width:16px;height:16px;border:1.5px solid #555;border-radius:50%;
                       display:inline-flex;flex-shrink:0"></span>
          <span style="font-size:13px;font-weight:600">Falso</span>
        </div>
      </div>`

    case 'matching': {
      const cols = q.options?.col_a && q.options?.col_b ? q.options : null
      if (!cols) return blankLines(4)
      const rows = Math.max(cols.col_a?.length || 0, cols.col_b?.length || 0)
      return `<table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:12px">
        <tr>
          <th style="width:48%;padding:5px 8px;background:#D6E4F0;border:1px solid #ccc;text-align:left">Columna A</th>
          <th style="width:4%;padding:5px;background:#D6E4F0;border:1px solid #ccc;text-align:center">→</th>
          <th style="width:48%;padding:5px 8px;background:#D6E4F0;border:1px solid #ccc;text-align:left">Columna B</th>
        </tr>
        ${Array.from({ length: rows }, (_, i) => `
        <tr>
          <td style="padding:5px 8px;border:1px solid #ddd">${i + 1}. ${esc(cols.col_a?.[i] || '')}</td>
          <td style="padding:5px;border:1px solid #ddd;text-align:center;color:#aaa">___</td>
          <td style="padding:5px 8px;border:1px solid #ddd">${String.fromCharCode(65 + i)}. ${esc(cols.col_b?.[i] || '')}</td>
        </tr>`).join('')}
      </table>`
    }

    case 'sequencing':
      return `<div style="margin-top:10px">
        <div style="font-size:11px;color:#666;margin-bottom:8px">
          Escribe el número del orden correcto en el recuadro (□):
        </div>
        ${(q.options || []).map((step, i) => `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
            <span style="width:24px;height:24px;border:1.5px solid #555;border-radius:4px;
                         display:inline-flex;align-items:center;justify-content:center;
                         font-size:12px;flex-shrink:0">&nbsp;</span>
            <span style="font-size:12px">${String.fromCharCode(65 + i)}. ${esc(step)}</span>
          </div>`).join('')}
      </div>`

    case 'fill_blank':
      return `<div style="margin-top:10px;font-size:12px;color:#555">
        Respuesta: <span style="display:inline-block;width:260px;border-bottom:1px solid #999">&nbsp;</span>
      </div>`

    case 'error_correction':
      return `<div style="margin-top:10px">
        <div style="font-size:11px;color:#555;margin-bottom:6px;font-style:italic">
          Encierra o tacha los errores y escribe la versión corregida:
        </div>
        ${blankLines(4)}
      </div>`

    case 'short_answer':
      return `<div style="margin-top:10px">${blankLines(4)}</div>`

    case 'open_development':
      return `<div style="margin-top:10px">${blankLines(8)}</div>`

    case 'biblical_reflection':
    case 'verse_analysis':
    case 'principle_application':
      return `<div style="margin-top:10px">${blankLines(6)}</div>`

    default:
      return `<div style="margin-top:10px">${blankLines(4)}</div>`
  }
}

function renderQuestion(q, idx) {
  const isBiblical = BIBLICAL_KEYS.includes(q.question_type)
  const label = TYPE_LABEL[q.question_type] || q.question_type
  const accentColor = isBiblical ? '#7B3F00' : '#2E5598'
  const bgColor     = isBiblical ? '#FDF8F0' : '#ffffff'
  const borderColor = isBiblical ? '#D4B896' : '#ddd'

  return `
<div style="break-inside:avoid;page-break-inside:avoid;margin-bottom:16px;
            padding:12px 14px;border:1px solid ${borderColor};border-radius:6px;
            border-left:4px solid ${accentColor};background:${bgColor}">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
    <div style="display:flex;align-items:flex-start;gap:10px;flex:1">
      <span style="background:${accentColor};color:#fff;border-radius:50%;
                   width:22px;height:22px;min-width:22px;
                   display:flex;align-items:center;justify-content:center;
                   font-size:11px;font-weight:700;flex-shrink:0;margin-top:1px">${idx + 1}</span>
      <p style="margin:0;font-size:13px;color:#1F3864;line-height:1.5;font-weight:600">${esc(q.stem)}</p>
    </div>
    <span style="font-size:10px;color:#888;white-space:nowrap;margin-left:12px;flex-shrink:0;margin-top:3px">
      ${isBiblical ? '✝️ ' : ''}${esc(label)} &nbsp;·&nbsp; ${q.points} pts
    </span>
  </div>
  ${renderAnswerArea(q)}
</div>`
}

// ── Main HTML builder ─────────────────────────────────────────────────────────
// school fields: name, dane, logo_url, process_name, document_code|plan_code, doc_version|plan_version
export function buildExamHtml({ assessment, questions, logoBase64, school, teacherName }) {
  const s  = school || {}
  const logoSrc = logoBase64 || s.logo_url || ''
  const codigo  = s.document_code || s.plan_code || ''
  const version = s.doc_version   || s.plan_version || ''
  const proceso = s.process_name  || ''

  const totalPts = (questions || []).reduce((sum, q) => sum + (q.points || 0), 0)
  const biblical = (questions || []).filter(q => BIBLICAL_KEYS.includes(q.question_type))
  const academic = (questions || []).filter(q => !BIBLICAL_KEYS.includes(q.question_type))

  // Split questions into sections for rendering
  const allQ = [...academic, ...biblical] // academic first, then biblical

  // Institutional header — IDENTICAL to exportHtml.js (lines 350–368)
  const institutionalHeader = `
<table style="width:100%;border:2px solid #2E5598;border-collapse:collapse;margin-bottom:0">
  <tr>
    <td style="width:120px;border:1px solid #2E5598;padding:8px;text-align:center">
      ${logoSrc
        ? `<img src="${logoSrc}" style="max-height:80px;max-width:100px;width:auto;height:auto;object-fit:contain">`
        : '<div style="color:#aaa;font-size:11px">LOGO</div>'
      }
    </td>
    <td style="border:1px solid #2E5598;padding:8px;text-align:center">
      <div style="font-weight:700;font-size:16px">${esc(s.name)}</div>
      <div style="font-size:11px;color:#555;margin-top:2px">${esc(s.dane)}</div>
      <div style="font-size:12px;font-weight:600;color:#2E5598;margin-top:4px">${esc(proceso)}</div>
    </td>
    <td style="width:150px;border:1px solid #2E5598;padding:8px;text-align:center">
      <div style="font-weight:700;font-size:12px">${esc(codigo)}</div>
      <div style="font-size:11px;color:#888">${esc(version)}</div>
    </td>
  </tr>
</table>`

  // Info row — same pattern as exportHtml.js (lines 371–382)
  const infoRow = `
<table style="width:100%;border:1px solid #ddd;border-collapse:collapse;margin-bottom:0;background:#D6E4F0">
  <tr>
    <td style="padding:5px 12px;font-size:12px"><strong>Grado:</strong> ${esc(assessment.grade)}</td>
    <td style="padding:5px 12px;font-size:12px"><strong>Período:</strong> ${assessment.period ? `Período ${esc(String(assessment.period))}` : '—'}</td>
    <td style="padding:5px 12px;font-size:12px"><strong>Asignatura:</strong> ${esc(assessment.subject)}</td>
    <td style="padding:5px 12px;font-size:12px"><strong>Docente:</strong> ${esc(teacherName)}</td>
    ${assessment.time_limit_minutes ? `<td style="padding:5px 12px;font-size:12px"><strong>Tiempo:</strong> ${esc(String(assessment.time_limit_minutes))} min</td>` : '<td></td>'}
  </tr>
  <tr>
    <td colspan="5" style="padding:5px 12px;font-size:12px">
      <strong>Nombre del estudiante:</strong> ________________________________________________
      &nbsp;&nbsp;&nbsp;&nbsp;
      <strong>Fecha:</strong> _______________
    </td>
  </tr>
</table>`

  // Questions body (academic then biblical)
  const questionsHtml = allQ.map((q, i) => renderQuestion(q, i)).join('\n')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${esc(assessment.title)} — ${esc(s.name || 'CBF')}</title>
<style>
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
  body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
    color: #222;
    max-width: 960px;
    margin-left: auto;
    margin-right: auto;
  }

  /* ── Page header: fixed on every printed page ─────────────────────────── */
  .cbf-page-header {
    margin-bottom: 16px;
  }

  @media print {
    body {
      padding: 0 16px;
      max-width: 100%;
      /* Push content below the fixed header on every page */
      margin-top: 172px;
    }
    .cbf-page-header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: white;
      padding: 8px 16px 0;
      z-index: 9999;
      margin-bottom: 0;
    }
    .pdf-fab    { display: none !important; }
    .exam-title { break-after: avoid; page-break-after: avoid; }
    tr          { break-inside: avoid; page-break-inside: avoid; }
  }

  /* ── Floating print button (screen only) ─────────────────────────────── */
  .pdf-fab {
    position: fixed;
    bottom: 24px; right: 24px; z-index: 9999;
    padding: 12px 22px;
    background: linear-gradient(135deg, #C0504D 0%, #8B1A1A 100%);
    color: #fff; border: none; border-radius: 50px;
    font-size: 14px; font-weight: 700; font-family: Arial, sans-serif;
    cursor: pointer; box-shadow: 0 4px 18px rgba(192,80,77,0.5);
    letter-spacing: .3px;
  }
  .pdf-fab:hover { transform: translateY(-2px); }
</style>
</head>
<body>

<!-- Encabezado institucional — se repite en cada página al imprimir -->
<div class="cbf-page-header">
  ${institutionalHeader}
  ${infoRow}
</div>

<!-- Título del examen -->
<div class="exam-title" style="margin-bottom:16px">
  <h2 style="margin:0 0 6px;font-size:16px;color:#1F3864;font-weight:700">${esc(assessment.title)}</h2>
  <div style="display:flex;gap:20px;font-size:12px;color:#555;flex-wrap:wrap">
    <span>📋 ${allQ.length} preguntas &nbsp;·&nbsp; ${totalPts} puntos en total</span>
    ${biblical.length > 0 ? `<span style="color:#7B3F00">✝️ ${biblical.length} preguntas de principio bíblico</span>` : ''}
    ${assessment.time_limit_minutes ? `<span>⏱ ${esc(String(assessment.time_limit_minutes))} minutos</span>` : ''}
  </div>
  ${assessment.instructions ? `
  <div style="margin-top:10px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:5px;padding:8px 12px;font-size:12px;color:#374151">
    <strong>Instrucciones:</strong> ${esc(assessment.instructions)}
  </div>` : ''}
</div>

<!-- Preguntas -->
${questionsHtml}

<!-- Botón flotante -->
<button class="pdf-fab" onclick="window.print()" title="Imprimir / Guardar como PDF">
  🖨️ Imprimir / PDF
</button>

</body>
</html>`
}

// ── Public export ─────────────────────────────────────────────────────────────
// Opens a new window with the printable exam and triggers print dialog.
// Caller must pass questions already loaded from DB.
export async function printExamHtml({ assessment, questions, school, teacherName }) {
  // Inline logo as base64 so print works without network (no CORS)
  const logoBase64 = school?.logo_url ? await fetchBase64(school.logo_url) : ''

  const html = buildExamHtml({ assessment, questions, logoBase64, school, teacherName })

  const win = window.open('', '_blank')
  if (!win) return // popup blocked
  win.document.write(html)
  win.document.close()
  // Let images load before triggering print
  win.onload = () => setTimeout(() => win.print(), 400)
}
