// ── exportDictationHtml.js ────────────────────────────────────────────────────
// Generates a printable HTML dictation document with the CBF institutional header.
// Pattern: identical to exportExamHtml.js — same header, same print flow.
//
// Usage:
//   await printDictationHtml({ blueprint, school, teacherName })
// ─────────────────────────────────────────────────────────────────────────────

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

// ── Section renderers ────────────────────────────────────────────────────────

const SECTION_COLORS = {
  listen_type:     '#4BACC6',
  listen_identify: '#8064A2',
  matching:        '#9BBB59',
  fill_blank:      '#F79646',
  writing:         '#8064A2',
}

function renderListenTypeSection(sec, startNum) {
  let html = ''
  sec.items.forEach((item, i) => {
    html += `
    <div style="break-inside:avoid;margin-bottom:14px;padding:8px 12px;border:1px solid #e5e7eb;border-radius:6px;border-left:3px solid ${SECTION_COLORS.listen_type}">
      <div style="font-weight:600;font-size:12px;color:#374151;margin-bottom:6px">${startNum + i}.</div>
      <div style="border-bottom:1px solid #bbb;height:22px;margin-bottom:4px"></div>
    </div>`
  })
  return html
}

function renderListenIdentifySection(sec, startNum) {
  let html = ''
  sec.items.forEach((item, i) => {
    html += `
    <div style="break-inside:avoid;margin-bottom:14px;padding:8px 12px;border:1px solid #e5e7eb;border-radius:6px;border-left:3px solid ${SECTION_COLORS.listen_identify}">
      <div style="font-weight:600;font-size:12px;color:#374151;margin-bottom:8px">${startNum + i}.</div>
      <div style="display:flex;gap:24px;flex-wrap:wrap">
        ${(item.options || []).map(opt => `
          <div style="display:flex;align-items:center;gap:6px">
            <span style="width:14px;height:14px;border:1.5px solid #555;border-radius:50%;display:inline-flex;flex-shrink:0"></span>
            <span style="font-size:12px">${esc(opt)}</span>
          </div>`).join('')}
      </div>
    </div>`
  })
  return html
}

function renderFillBlankSection(sec, startNum) {
  let html = ''
  sec.items.forEach((item, i) => {
    html += `
    <div style="break-inside:avoid;margin-bottom:14px;padding:8px 12px;border:1px solid #e5e7eb;border-radius:6px;border-left:3px solid ${SECTION_COLORS.fill_blank}">
      <div style="font-size:13px;color:#374151;margin-bottom:8px">
        <strong>${startNum + i}.</strong> ${esc(item.sentence || '')}
      </div>
      <div style="display:flex;gap:24px;flex-wrap:wrap">
        ${(item.options || []).map(opt => `
          <div style="display:flex;align-items:center;gap:6px">
            <span style="width:14px;height:14px;border:1.5px solid #555;border-radius:50%;display:inline-flex;flex-shrink:0"></span>
            <span style="font-size:12px">${esc(opt)}</span>
          </div>`).join('')}
      </div>
    </div>`
  })
  return html
}

function renderMatchingSection(sec, startNum) {
  let html = ''
  sec.items.forEach((item, i) => {
    html += `
    <div style="break-inside:avoid;margin-bottom:14px;padding:8px 12px;border:1px solid #e5e7eb;border-radius:6px;border-left:3px solid ${SECTION_COLORS.matching}">
      <div style="font-weight:600;font-size:13px;color:#1F3864;margin-bottom:8px">
        ${startNum + i}. <strong>${esc(item.word || '')}</strong>
      </div>
      <div style="display:flex;gap:18px;flex-wrap:wrap">
        ${(item.options || []).map((opt, oi) => `
          <div style="display:flex;align-items:flex-start;gap:6px">
            <span style="width:14px;height:14px;border:1.5px solid #555;border-radius:50%;display:inline-flex;flex-shrink:0;margin-top:2px"></span>
            <span style="font-size:11px">${String.fromCharCode(65 + oi)}. ${esc(opt)}</span>
          </div>`).join('')}
      </div>
    </div>`
  })
  return html
}

function renderWritingSection(sec, startNum) {
  let html = ''
  sec.items.forEach((item, i) => {
    html += `
    <div style="break-inside:avoid;margin-bottom:14px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:6px;border-left:3px solid ${SECTION_COLORS.writing}">
      <div style="font-weight:600;font-size:12px;color:#374151;margin-bottom:6px">${startNum + i}.</div>
      <div style="font-size:13px;color:#1F3864;margin-bottom:8px">${esc(item.prompt || '')}</div>
      ${(item.required_words && item.required_words.length > 0) ? `
        <div style="margin-bottom:8px;font-size:11px;color:#666">
          <strong>Required words:</strong> ${item.required_words.map(w => `<span style="background:#e5e7eb;padding:2px 6px;border-radius:3px;margin:0 2px">${esc(w)}</span>`).join(' ')}
        </div>` : ''}
      <div style="border:1px solid #ccc;min-height:80px;border-radius:4px;padding:4px"></div>
    </div>`
  })
  return html
}

// ── Answer key renderers ─────────────────────────────────────────────────────

function renderAnswerKey(sections) {
  let html = ''
  let num = 1
  sections.forEach(sec => {
    const color = SECTION_COLORS[sec.type] || '#666'
    html += `<h3 style="color:${color};font-size:14px;margin:16px 0 8px;border-bottom:2px solid ${color};padding-bottom:4px">${esc(sec.title)}</h3>`
    sec.items.forEach(item => {
      const parts = []
      if (sec.type === 'matching') {
        parts.push(`<strong>${num}.</strong> ${esc(item.word)} → ${esc(item.correct_answer)}`)
      } else if (sec.type === 'writing') {
        parts.push(`<strong>${num}.</strong> <span style="color:#888;font-style:italic">${esc(item.prompt)}</span>`)
        if (item.required_words?.length) {
          parts.push(`<br><span style="font-size:10px;color:#888">Required: ${item.required_words.map(w => esc(w)).join(', ')}</span>`)
        }
      } else {
        parts.push(`<strong>${num}.</strong> ${esc(item.correct_answer)}`)
        if (item.audio_text) parts.push(`<span style="color:#888;font-size:11px;margin-left:8px">🔊 "${esc(item.audio_text)}"</span>`)
        if (item.sentence) parts.push(`<span style="color:#888;font-size:11px;margin-left:8px">${esc(item.sentence)}</span>`)
      }
      html += `<div style="margin-bottom:4px;font-size:12px">${parts.join('')}</div>`
      num++
    })
  })
  return html
}

// ── Main builder ─────────────────────────────────────────────────────────────

export function buildDictationHtml({ blueprint, logoBase64, school, teacherName }) {
  const s = school || {}
  const bp = blueprint || {}
  const logoSrc = logoBase64 || s.logo_url || ''
  const version = s.doc_version || s.plan_version || '02 — 2022'
  const dane = s.dane || '308001800455'
  const resol = s.resolution || '09685 DE 2019'
  const sections = bp.sections || []

  const totalItems = sections.reduce((sum, sec) => sum + (sec.items?.length || 0), 0)

  // ── Institutional header (CBF-G AC-01) ──
  const institutionalHeader = `
<table style="width:100%;border-collapse:collapse;border:1px solid #000;font-family:Arial,sans-serif">
  <colgroup>
    <col style="width:15.3%">
    <col style="width:61%">
    <col style="width:23.7%">
  </colgroup>
  <tbody>
    <tr>
      <td rowspan="3" style="border:1px solid #000;padding:6px;text-align:center;vertical-align:middle">
        ${logoSrc
          ? `<img src="${logoSrc}" style="max-height:70px;max-width:90px;width:auto;height:auto;object-fit:contain">`
          : '<div style="color:#aaa;font-size:10px">LOGO</div>'}
      </td>
      <td style="border:1px solid #000;padding:6px 10px;text-align:center;vertical-align:middle;background:#DBE5F1">
        <div style="font-weight:700;font-size:15px">${esc(s.name || 'COLEGIO BOSTON FLEXIBLE')}</div>
        <div style="font-size:10px;margin-top:3px">DANE: ${esc(dane)} - RESOLUCIÓN ${esc(resol)}</div>
      </td>
      <td style="border:1px solid #000;padding:6px;text-align:center;vertical-align:middle">
        <div style="font-weight:700;font-size:10px">CÓD: CBF - G AC - 01</div>
      </td>
    </tr>
    <tr>
      <td rowspan="2" style="border:1px solid #000;padding:6px 10px;text-align:center;vertical-align:middle">
        <div style="font-weight:700;font-size:10px"><u>PROCESO</u>: GESTIÓN ACADÉMICA Y CURRICULAR</div>
        <div style="font-weight:700;font-size:10px;margin-top:3px">${bp.assessment_mode === 'vocab_quiz' ? 'VOCABULARY ASSESSMENT' : bp.assessment_mode === 'combined' ? 'VOCABULARY & LISTENING ASSESSMENT' : 'LISTENING ASSESSMENT'}</div>
      </td>
      <td style="border:1px solid #000;padding:5px 6px;text-align:center;vertical-align:middle">
        <div style="font-size:10px"><strong>Versión</strong> ${esc(version)}</div>
      </td>
    </tr>
    <tr>
      <td style="border:1px solid #000;padding:5px 6px;text-align:center;vertical-align:middle">
        <div style="font-size:10px">Página <span class="cbf-page-num"></span></div>
      </td>
    </tr>
  </tbody>
</table>`

  // ── Info row ──
  const infoRow = `
<table style="width:100%;border:1px solid #000;border-top:none;border-collapse:collapse;font-family:Arial,sans-serif;background:#DBE5F1">
  <tr>
    <td style="padding:4px 10px;font-size:11px;border:1px solid #000"><strong>Grado:</strong> ${esc(bp.grade)}</td>
    <td style="padding:4px 10px;font-size:11px;border:1px solid #000"><strong>Asignatura:</strong> ${esc(bp.subject)}</td>
    <td style="padding:4px 10px;font-size:11px;border:1px solid #000"><strong>Dificultad:</strong> ${esc(bp.difficulty)}</td>
    <td style="padding:4px 10px;font-size:11px;border:1px solid #000"><strong>Docente:</strong> ${esc(teacherName)}</td>
  </tr>
  <tr>
    <td colspan="4" style="padding:4px 10px;font-size:11px;border:1px solid #000">
      <strong>Nombre:</strong> _______________________________________________
      &nbsp;&nbsp;&nbsp;
      <strong>Fecha:</strong> ________________
    </td>
  </tr>
  ${bp.unit_reference ? `<tr>
    <td colspan="4" style="padding:4px 10px;font-size:11px;border:1px solid #000">
      <strong>Unidad:</strong> ${esc(bp.unit_reference)} &nbsp;&nbsp;&nbsp;
      <strong>Total preguntas:</strong> ${totalItems}
    </td>
  </tr>` : ''}
</table>`

  // ── Sections ──
  let questionsHtml = ''
  let num = 1
  sections.forEach(sec => {
    const color = SECTION_COLORS[sec.type] || '#666'
    questionsHtml += `
    <div style="margin-top:20px">
      <div style="background:${color};color:white;padding:8px 14px;border-radius:6px 6px 0 0;font-weight:700;font-size:13px">
        ${esc(sec.title)}
      </div>
      <div style="padding:4px 0;font-size:11px;color:#666;margin-bottom:8px;font-style:italic">
        ${esc(sec.instructions || '')}
      </div>`

    if (sec.type === 'listen_type') {
      questionsHtml += renderListenTypeSection(sec, num)
    } else if (sec.type === 'listen_identify') {
      questionsHtml += renderListenIdentifySection(sec, num)
    } else if (sec.type === 'matching') {
      questionsHtml += renderMatchingSection(sec, num)
    } else if (sec.type === 'writing') {
      questionsHtml += renderWritingSection(sec, num)
    } else {
      questionsHtml += renderFillBlankSection(sec, num)
    }

    num += sec.items.length
    questionsHtml += '</div>'
  })

  // ── Answer key (separate page) ──
  const answerKeyHtml = `
  <div style="break-before:page;page-break-before:always;padding-top:20px">
    ${institutionalHeader}
    <div style="margin-top:16px">
      <h2 style="text-align:center;color:#1F3864;font-size:16px;margin:12px 0 6px">ANSWER KEY — ${esc(bp.title || 'Dictation')}</h2>
      <p style="text-align:center;font-size:11px;color:#888;margin:0 0 16px">
        ${esc(bp.grade)} · ${esc(bp.subject)} · ${esc(bp.difficulty)} · ${totalItems} preguntas
      </p>
      ${renderAnswerKey(sections)}
    </div>
  </div>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Dictation — ${esc(bp.title || '')}</title>
<style>
  @page { margin: 15mm 12mm; size: letter; }
  body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #1F3864; }
  @media print {
    .no-print { display: none !important; }
    body { padding: 0; }
  }
</style>
</head>
<body>

<!-- Print button -->
<div class="no-print" style="position:fixed;bottom:24px;right:24px;z-index:9999">
  <button onclick="window.print()" style="
    background:linear-gradient(135deg,#DC2626,#B91C1C);color:white;
    border:none;border-radius:50%;width:56px;height:56px;font-size:22px;
    cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.3)
  ">🖨️</button>
</div>

${institutionalHeader}
${infoRow}
${questionsHtml}
${answerKeyHtml}

</body>
</html>`
}

// ── Print helper ─────────────────────────────────────────────────────────────

export async function printDictationHtml({ blueprint, school, teacherName }) {
  const logoBase64 = school?.logo_url ? await fetchBase64(school.logo_url) : ''
  const html = buildDictationHtml({ blueprint, logoBase64, school, teacherName })
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.onload = () => setTimeout(() => win.print(), 400)
}

// ── Corrected exam HTML ───────────────────────────────────────────────────────
// Builds a printable corrected dictation showing student answers (green/red).
//
// Parameters:
//   blueprint  — dictation_blueprints row (title, grade, subject, difficulty, assessment_mode)
//   instance   — dictation_instances row (student_name, student_section, student_code, generated_questions)
//   responses  — dictation_responses rows ordered by question_index
//   result     — dictation_results row (colombian_grade, grade_level, total_score, max_score, section_scores)
//   school     — schools row (name, dane, resolution, logo_url, doc_version)
//   teacherName— string

export function buildCorrectedHtml({ blueprint, instance, responses, result, logoBase64, school, teacherName }) {
  const s   = school    || {}
  const bp  = blueprint || {}
  const inst = instance  || {}
  const res  = result    || {}
  const resps = responses || []

  const logoSrc = logoBase64 || s.logo_url || ''
  const version = s.doc_version || s.plan_version || '02 — 2022'
  const dane    = s.dane       || '308001800455'
  const resol   = s.resolution || '09685 DE 2019'

  // Build sections from instance.generated_questions (student's order)
  const questions = inst.generated_questions || []
  const sectionsMap = {}
  const sectionOrder = []
  questions.forEach((q, idx) => {
    const type = q.question_type || 'unknown'
    if (!sectionsMap[type]) {
      sectionsMap[type] = { type, title: q.section_title || type, items: [] }
      sectionOrder.push(type)
    }
    const resp = resps.find(r => r.question_index === idx) || {}
    sectionsMap[type].items.push({ ...q, globalIndex: idx, resp })
  })
  const sections = sectionOrder.map(t => sectionsMap[t])

  const grade     = res.colombian_grade ?? '—'
  const level     = res.grade_level     ?? '—'
  const totalPts  = res.total_score     ?? 0
  const maxPts    = res.max_score       ?? 0
  const gradeNum  = parseFloat(grade)
  const gradeHex  = gradeNum >= 4.5 ? '#15803D' : gradeNum >= 4.0 ? '#1D4ED8' : gradeNum >= 3.5 ? '#D97706' : '#DC2626'

  // Institutional header
  const institutionalHeader = `
<table style="width:100%;border-collapse:collapse;border:1px solid #000;font-family:Arial,sans-serif">
  <colgroup><col style="width:15.3%"><col style="width:61%"><col style="width:23.7%"></colgroup>
  <tbody>
    <tr>
      <td rowspan="3" style="border:1px solid #000;padding:6px;text-align:center;vertical-align:middle">
        ${logoSrc ? `<img src="${logoSrc}" style="max-height:70px;max-width:90px;width:auto;height:auto;object-fit:contain">` : '<div style="color:#aaa;font-size:10px">LOGO</div>'}
      </td>
      <td style="border:1px solid #000;padding:6px 10px;text-align:center;vertical-align:middle;background:#DBE5F1">
        <div style="font-weight:700;font-size:15px">${esc(s.name || 'COLEGIO BOSTON FLEXIBLE')}</div>
        <div style="font-size:10px;margin-top:3px">DANE: ${esc(dane)} - RESOLUCIÓN ${esc(resol)}</div>
      </td>
      <td style="border:1px solid #000;padding:6px;text-align:center;vertical-align:middle">
        <div style="font-weight:700;font-size:10px">CÓD: CBF - G AC - 01</div>
      </td>
    </tr>
    <tr>
      <td rowspan="2" style="border:1px solid #000;padding:6px 10px;text-align:center;vertical-align:middle">
        <div style="font-weight:700;font-size:10px"><u>PROCESO</u>: GESTIÓN ACADÉMICA Y CURRICULAR</div>
        <div style="font-weight:700;font-size:10px;margin-top:3px">EVALUACIÓN CORREGIDA — ${bp.assessment_mode === 'vocab_quiz' ? 'VOCABULARY' : bp.assessment_mode === 'combined' ? 'VOCABULARY & LISTENING' : 'LISTENING'}</div>
      </td>
      <td style="border:1px solid #000;padding:5px 6px;text-align:center;vertical-align:middle">
        <div style="font-size:10px"><strong>Versión</strong> ${esc(version)}</div>
      </td>
    </tr>
    <tr>
      <td style="border:1px solid #000;padding:5px 6px;text-align:center;vertical-align:middle">
        <div style="font-size:10px">Fecha: ${new Date().toLocaleDateString('es-CO')}</div>
      </td>
    </tr>
  </tbody>
</table>`

  // Student + result row
  const studentRow = `
<table style="width:100%;border:1px solid #000;border-top:none;border-collapse:collapse;font-family:Arial,sans-serif">
  <tr style="background:#DBE5F1">
    <td style="padding:4px 10px;font-size:11px;border:1px solid #000"><strong>Estudiante:</strong> ${esc(inst.student_name || '—')}</td>
    <td style="padding:4px 10px;font-size:11px;border:1px solid #000"><strong>Sección:</strong> ${esc(inst.student_section || '—')}</td>
    <td style="padding:4px 10px;font-size:11px;border:1px solid #000"><strong>Código:</strong> ${esc(inst.student_code || '—')}</td>
  </tr>
  <tr style="background:#DBE5F1">
    <td style="padding:4px 10px;font-size:11px;border:1px solid #000"><strong>Grado:</strong> ${esc(bp.grade)}</td>
    <td style="padding:4px 10px;font-size:11px;border:1px solid #000"><strong>Asignatura:</strong> ${esc(bp.subject)}</td>
    <td style="padding:4px 10px;font-size:11px;border:1px solid #000"><strong>Docente:</strong> ${esc(teacherName)}</td>
  </tr>
  <tr>
    <td colspan="2" style="padding:6px 10px;font-size:13px;border:1px solid #000">
      <strong>Puntos:</strong> ${totalPts}/${maxPts}
    </td>
    <td style="padding:6px 10px;font-size:14px;font-weight:700;color:${gradeHex};border:1px solid #000;text-align:center">
      ${grade}/5.0 — ${esc(level)}
    </td>
  </tr>
</table>`

  // Render corrected questions
  let questionsHtml = ''
  let num = 1
  sections.forEach(sec => {
    const color = SECTION_COLORS[sec.type] || '#666'
    const correctCount = sec.items.filter(it => it.resp?.is_correct).length
    questionsHtml += `
    <div style="margin-top:20px">
      <div style="background:${color};color:white;padding:8px 14px;border-radius:6px 6px 0 0;font-weight:700;font-size:13px;display:flex;justify-content:space-between">
        <span>${esc(sec.title)}</span>
        <span style="font-weight:400;font-size:11px;opacity:.9">${correctCount}/${sec.items.length} correctas</span>
      </div>
      <div style="padding:8px 0">`

    sec.items.forEach(item => {
      const resp        = item.resp || {}
      const isCorrect   = resp.is_correct
      const border      = isCorrect ? '#15803D' : '#DC2626'
      const bg          = isCorrect ? '#F0FDF4' : '#FEF2F2'
      const answerColor = isCorrect ? '#15803D' : '#DC2626'

      questionsHtml += `
      <div style="break-inside:avoid;margin-bottom:8px;padding:8px 12px;border:1px solid ${border};border-left:3px solid ${border};border-radius:6px;background:${bg}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div style="flex:1">`

      questionsHtml += `<div style="font-weight:700;font-size:11px;color:#374151;margin-bottom:4px">${num}. ${isCorrect ? '✓ Correcto' : '✗ Incorrecto'}</div>`

      if (item.audio_text) questionsHtml += `<div style="font-size:10px;color:#6B7280;margin-bottom:3px">🔊 "${esc(item.audio_text)}"</div>`
      if (item.sentence)   questionsHtml += `<div style="font-size:11px;color:#374151;margin-bottom:3px">${esc(item.sentence)}</div>`
      if (item.options && item.options.length > 0) {
        questionsHtml += `<div style="font-size:10px;color:#6B7280;margin-bottom:3px">${item.options.map(o => `[${esc(o)}]`).join('  ')}</div>`
      }

      questionsHtml += `<div style="margin-top:3px"><span style="font-size:10px;color:#6B7280">Respuesta: </span><span style="font-weight:700;font-size:12px;color:${answerColor}">${esc(resp.answer || '(en blanco)')}</span></div>`

      if (!isCorrect && resp.correct_answer) {
        questionsHtml += `<div style="margin-top:2px"><span style="font-size:10px;color:#6B7280">Correcta: </span><span style="font-weight:700;font-size:12px;color:#15803D">${esc(resp.correct_answer)}</span></div>`
      }

      questionsHtml += `</div>
          <div style="font-size:12px;font-weight:700;color:${answerColor};white-space:nowrap;padding-top:2px">${resp.score ?? 0}/${resp.max_score ?? 1}</div>
        </div>
      </div>`
      num++
    })

    questionsHtml += '</div></div>'
  })

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Corregido — ${esc(inst.student_name || '')} — ${esc(bp.title || '')}</title>
<style>
  @page { margin: 15mm 12mm; size: letter; }
  body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #1F3864; }
  @media print { .no-print { display: none !important; } body { padding: 0; } }
</style>
</head>
<body>
<div class="no-print" style="position:fixed;bottom:24px;right:24px;z-index:9999">
  <button onclick="window.print()" style="background:linear-gradient(135deg,#DC2626,#B91C1C);color:white;border:none;border-radius:50%;width:56px;height:56px;font-size:22px;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.3)">🖨️</button>
</div>
${institutionalHeader}
${studentRow}
${questionsHtml}
</body>
</html>`
}

export async function printCorrectedHtml({ blueprint, instance, responses, result, school, teacherName }) {
  const logoBase64 = school?.logo_url ? await fetchBase64(school.logo_url) : ''
  const html = buildCorrectedHtml({ blueprint, instance, responses, result, logoBase64, school, teacherName })
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.onload = () => setTimeout(() => win.print(), 400)
}
