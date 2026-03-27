// ── exportHtml.js ─────────────────────────────────────────────────────────────
// Builds the CBF guide as a standalone HTML string and optionally downloads it
// or opens it for printing (PDF).

const SECTIONS = [
  { key: 'subject',    label: 'SUBJECT TO BE WORKED', hex: '4F81BD', time: '~8 min'  },
  { key: 'motivation', label: 'MOTIVATION',            hex: '4BACC6', time: '~8 min'  },
  { key: 'activity',   label: 'ACTIVITY',              hex: 'F79646', time: '~15 min' },
  { key: 'skill',      label: 'SKILL DEVELOPMENT',     hex: '8064A2', time: '~40 min' },
  { key: 'closing',    label: 'CLOSING',               hex: '9BBB59', time: '~8 min'  },
  { key: 'assignment', label: 'ASSIGNMENT',             hex: '4E84A2', time: '~5 min'  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function getEmbedUrl(url) {
  if (!url) return null
  // YouTube
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  // Vimeo
  const vi = url.match(/vimeo\.com\/(\d+)/)
  if (vi) return `https://player.vimeo.com/video/${vi[1]}`
  return null
}

function sectionContent(section) {
  const html    = section?.content || ''
  const images  = section?.images  || []
  const videos  = section?.videos  || []

  const textHtml = html
    ? `<div style="font-size:12px;line-height:1.8;color:#222">${html}</div>`
    : `<p style="color:#ccc;font-size:12px;font-style:italic;margin:0">—</p>`

  if (!images.length) return textHtml

  // Layout: side-by-side if text is short, stack below if long
  const plainLen = html.replace(/<[^>]+>/g, '').length
  const layout   = plainLen < 400 ? 'side' : 'stack'

  const thumbs = images.map(img => {
    const imgTag = `<img src="${img.url}" alt="${esc(img.name)}"
        style="max-width:220px;max-height:160px;width:auto;height:auto;
               border-radius:5px;border:1px solid #ddd;display:block;object-fit:contain">`
    const inner = img.link
      ? `<a href="${esc(img.link)}" target="_blank" rel="noopener" style="display:inline-block">${imgTag}</a>`
      : imgTag
    return `<div style="margin-bottom:6px;display:inline-block">${inner}</div>`
  }).join('')

  const videoHtml = videos.length > 0
    ? videos.map(v => {
        const embedUrl = getEmbedUrl(v.url || v)
        if (!embedUrl) return ''
        const label = v.label ? `<div style="font-size:11px;font-weight:600;color:#2E5598;margin-bottom:4px">${esc(v.label)}</div>` : ''
        return `<div style="margin-top:10px">
          ${label}
          <div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:6px;border:1px solid #ddd">
            <iframe src="${embedUrl}" frameborder="0" allowfullscreen
              style="position:absolute;top:0;left:0;width:100%;height:100%"></iframe>
          </div>
        </div>`
      }).join('')
    : ''

  if (layout === 'side') {
    return `<table style="width:100%;border-collapse:collapse;table-layout:fixed">
      <tr>
        <td style="vertical-align:top;width:62%;padding-right:12px">${textHtml}</td>
        <td style="vertical-align:top;width:38%">${thumbs}</td>
      </tr>
    </table>` + videoHtml
  }

  return textHtml + (images.length ? `
    <div style="margin-top:10px;padding-top:8px;border-top:2px dashed #e0e8f4;
                display:flex;flex-wrap:wrap;gap:8px">
      ${thumbs}
    </div>` : '') + videoHtml
}

function buildDayBlock(iso, day) {
  const secRows = SECTIONS.map(s => {
    const sd = day.sections?.[s.key] || {}
    return `
    <tr>
      <td style="background:#${s.hex};color:#fff;font-weight:700;font-size:11px;
                 padding:8px 10px;width:140px;vertical-align:top;
                 border:1px solid #ddd;white-space:nowrap">
        ${s.label}<br>
        <span style="font-weight:400;font-size:10px;opacity:.75">${sd.time || s.time}</span>
      </td>
      <td style="padding:10px 14px;vertical-align:top;border:1px solid #ddd;background:#fff">
        ${sectionContent(sd)}
      </td>
    </tr>`
  }).join('')

  return `
  <div style="margin-bottom:20px;border-radius:6px;overflow:hidden;border:2px solid #2E5598">
    <div style="background:#1F3864;color:#fff;padding:10px 16px;
                display:flex;justify-content:space-between;align-items:center">
      <span style="font-weight:700;font-size:14px">
        📅 ${esc(day.date_label || iso)}
      </span>
      ${day.class_periods ? `<span style="font-size:12px;opacity:.8">${esc(day.class_periods)}</span>` : ''}
    </div>
    ${day.unit ? `
    <div style="background:#D6E4F0;padding:6px 16px;font-size:12px;font-weight:600;color:#1F3864">
      📚 ${esc(day.unit)}
    </div>` : ''}
    <table style="width:100%;border-collapse:collapse">${secRows}</table>
  </div>`
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildHtml(content) {
  const h = content.header   || {}
  const i = content.info     || {}
  const o = content.objetivo || {}
  const v = content.verse    || {}
  const s = content.summary  || {}

  const dayBlocks = Object.entries(content.days || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, day]) => day.active !== false)
    .map(([iso, day]) => buildDayBlock(iso, day))
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Guía CBF – ${esc(i.grado)} – Semana ${esc(i.semana)}</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 960px; margin: 0 auto; padding: 20px; color: #222; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  a { color: #2E5598; }
  @media print { body { padding: 0; max-width: 100%; } }
</style>
</head>
<body>

<!-- Encabezado institucional -->
<table style="width:100%;border:2px solid #2E5598;border-collapse:collapse;margin-bottom:12px">
  <tr>
    <td style="width:120px;border:1px solid #2E5598;padding:8px;text-align:center">
      ${h.logo_url
        ? `<img src="${h.logo_url}" style="max-height:80px;max-width:100px;width:auto;height:auto;object-fit:contain">`
        : '<div style="color:#aaa;font-size:11px">LOGO</div>'
      }
    </td>
    <td style="border:1px solid #2E5598;padding:8px;text-align:center">
      <div style="font-weight:700;font-size:16px">${esc(h.school)}</div>
      <div style="font-size:11px;color:#555;margin-top:2px">${esc(h.dane)}</div>
      <div style="font-size:12px;font-weight:600;color:#2E5598;margin-top:4px">${esc(h.proceso)}</div>
    </td>
    <td style="width:150px;border:1px solid #2E5598;padding:8px;text-align:center">
      <div style="font-weight:700;font-size:12px">${esc(h.codigo)}</div>
      <div style="font-size:11px;color:#888">${esc(h.version)}</div>
    </td>
  </tr>
</table>

<!-- Info -->
<table style="width:100%;border:1px solid #ddd;border-collapse:collapse;margin-bottom:12px;background:#D6E4F0">
  <tr>
    <td style="padding:6px 12px;font-size:12px"><strong>Grado:</strong> ${esc(i.grado)}</td>
    <td style="padding:6px 12px;font-size:12px"><strong>Período:</strong> ${esc(i.periodo)}</td>
    <td style="padding:6px 12px;font-size:12px"><strong>Semana:</strong> ${esc(i.semana)}</td>
    <td style="padding:6px 12px;font-size:12px"><strong>Asignatura:</strong> ${esc(i.asignatura)}</td>
    <td style="padding:6px 12px;font-size:12px"><strong>Fechas:</strong> ${esc(i.fechas)}</td>
  </tr>
  <tr>
    <td colspan="5" style="padding:6px 12px;font-size:12px"><strong>Docente:</strong> ${esc(i.docente)}</td>
  </tr>
</table>

<!-- Objetivo -->
${o.general || o.indicador ? `
<table style="width:100%;border:2px solid #2E5598;border-collapse:collapse;margin-bottom:12px">
  <tr>
    <td colspan="2" style="background:#9BBB59;color:#fff;font-weight:700;font-size:12px;
                           padding:7px 14px;text-transform:uppercase">
      🎯 Objetivo de Aprendizaje
    </td>
  </tr>
  <tr>
    <td style="width:50%;padding:10px 14px;vertical-align:top;
               border-top:1px solid #ddd;border-right:1px solid #ddd">
      <div style="font-size:10px;font-weight:700;color:#9BBB59;text-transform:uppercase;margin-bottom:5px">
        Objetivo General
      </div>
      <div style="font-size:12px;line-height:1.6">${o.general || '—'}</div>
    </td>
    <td style="width:50%;padding:10px 14px;vertical-align:top;border-top:1px solid #ddd">
      <div style="font-size:10px;font-weight:700;color:#9BBB59;text-transform:uppercase;margin-bottom:5px">
        Indicador de Logro
      </div>
      <div style="font-size:12px;line-height:1.6">${o.indicador || '—'}</div>
    </td>
  </tr>
  ${o.principio ? `
  <tr>
    <td colspan="2" style="padding:8px 14px;background:#f0f5f0;border-top:1px solid #ddd;
                           font-size:11px;color:#555;font-style:italic;border-left:3px solid #9BBB59">
      <strong style="font-style:normal;color:#9BBB59">Principio:</strong> ${esc(o.principio)}
    </td>
  </tr>` : ''}
</table>` : ''}

<!-- Versículo -->
${v.text ? `
<div style="background:#FFF8E7;border-left:4px solid #C9A84C;padding:10px 16px;
            border-radius:0 6px 6px 0;margin-bottom:14px;font-style:italic;
            font-size:12px;color:#5a4000;line-height:1.6">
  «${esc(v.text)}»<br>
  <strong style="font-style:normal;color:#C9A84C">— ${esc(v.ref)}</strong>
</div>` : ''}

<!-- Actividades -->
<div style="background:#2E5598;color:#fff;font-weight:700;font-size:13px;
            padding:10px 16px;border-radius:6px;margin-bottom:14px;text-align:center;
            text-transform:uppercase;letter-spacing:.5px">
  Descripción de Actividades
</div>

${dayBlocks}

<!-- Resumen -->
${s.done || s.next ? `
<div style="background:#333;color:#fff;padding:14px 18px;border-radius:6px;margin-top:16px">
  <div style="font-weight:700;font-size:12px;margin-bottom:8px;text-transform:uppercase">
    Resumen de la semana
  </div>
  ${s.done ? `<div style="font-size:12px;margin-bottom:8px">
    <strong>Lo trabajado:</strong><br>${s.done}
  </div>` : ''}
  ${s.next ? `<div style="font-size:12px">
    <strong>Próxima semana:</strong><br>${s.next}
  </div>` : ''}
</div>` : ''}

<p style="text-align:center;color:#aaa;font-size:10px;margin-top:16px">
  Generado con CBF Planner · ${new Date().toLocaleDateString('es-CO')}
</p>

</body>
</html>`
}

// ── Export functions ──────────────────────────────────────────────────────────

export function exportHtml(content) {
  const i    = content.info || {}
  const html = buildHtml(content)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `Guia_${(i.grado || 'CBF').replace(/\s/g,'_')}_Sem${i.semana || 'X'}.html`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportPdf(content) {
  const html = buildHtml(content)
  const w    = window.open('', '_blank')
  if (!w) { alert('Activa las ventanas emergentes para exportar PDF.'); return }
  w.document.write(html)
  w.document.close()
  setTimeout(() => w.print(), 800)
}
