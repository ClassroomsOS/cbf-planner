// ── exportHtml.js ─────────────────────────────────────────────────────────────
// Builds the CBF guide as a standalone HTML string and optionally downloads it
// or opens it for printing (PDF).

import { blockPreviewHTML, blockInteractiveHTML, BLOCK_TYPES } from './smartBlockHtml'

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

function sectionContent(section, idPrefix = '') {
  const html        = section?.content || ''
  const images      = (section?.images || []).slice(0, 6)
  const videos      = section?.videos      || []
  const smartBlocks = section?.smartBlocks || []

  // Resolve layout: use user-set field, normalize legacy layout_mode
  const rawLayout = section?.image_layout ||
    (section?.layout_mode === 'side' ? 'right' : 'below')
  const layout = images.length > 0 ? rawLayout : 'below'

  const textHtml = html
    ? `<div style="font-size:12px;line-height:1.8;color:#222">${html}</div>`
    : `<p style="color:#ccc;font-size:12px;font-style:italic;margin:0">—</p>`

  const videoHtml = videos.length > 0
    ? videos.map(v => {
        const embedUrl = getEmbedUrl(v.url || v)
        if (!embedUrl) return ''
        const label = v.label ? `<div style="font-size:11px;font-weight:600;color:#2E5598;margin-bottom:4px">${esc(v.label)}</div>` : ''
        return `<div style="margin-top:10px">
          ${label}
          <div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:6px">
            <iframe src="${embedUrl}" frameborder="0" allowfullscreen
              style="position:absolute;top:0;left:0;width:100%;height:100%"></iframe>
          </div>
        </div>`
      }).join('')
    : ''

  const smartHtml = smartBlocks.length > 0
    ? smartBlocks.map((b, idx) => {
        const typeDef = BLOCK_TYPES[b.type] || {}
        const bid = idPrefix ? `sbd_${idPrefix}_${idx}` : `sbd_${b.id || idx}`
        const interactive = blockInteractiveHTML(b, bid) || ''
        return `<div style="margin-top:8px;border:2px solid #${typeDef.color||'cccccc'};border-radius:6px;overflow:hidden">
          <div style="background:#${typeDef.color||'666666'};color:#fff;padding:5px 12px;font-size:11px;font-weight:700">
            ${typeDef.icon||''} ${typeDef.label||b.type}
          </div>
          <div style="padding:10px 14px;background:#fff">${blockPreviewHTML(b)}${interactive}</div>
        </div>`
      }).join('')
    : ''

  if (!images.length) return textHtml + videoHtml + smartHtml

  const imageGrid = buildImageGrid(images, layout)

  if (layout === 'right') {
    return `<table style="width:100%;border-collapse:collapse;table-layout:fixed">
      <tr>
        <td style="vertical-align:top;width:62%;padding-right:12px">${textHtml}</td>
        <td style="vertical-align:top;width:36%">${imageGrid}</td>
      </tr>
    </table>` + videoHtml + smartHtml
  }
  if (layout === 'left') {
    return `<table style="width:100%;border-collapse:collapse;table-layout:fixed">
      <tr>
        <td style="vertical-align:top;width:36%;padding-right:12px">${imageGrid}</td>
        <td style="vertical-align:top;width:62%">${textHtml}</td>
      </tr>
    </table>` + videoHtml + smartHtml
  }

  // below (default)
  return textHtml + `<div style="margin-top:10px">${imageGrid}</div>` + videoHtml + smartHtml
}

// ── Image grid HTML — tamaños óptimos por cantidad ────────────────────────────
function buildImageGrid(images, layout) {
  const n        = images.length
  const isVertical = layout === 'right' || layout === 'left'
  const gap      = '4px'

  function imgTag(img) {
    const tag = `<img src="${img.url}" alt="${esc(img.name || '')}"
      style="width:100%;height:100%;object-fit:cover;border-radius:5px;display:block">`
    return img.link
      ? `<a href="${esc(img.link)}" target="_blank" rel="noopener">${tag}</a>`
      : tag
  }

  function cell(img, ratio = '4/3') {
    return `<div style="aspect-ratio:${ratio};overflow:hidden;border-radius:5px">${imgTag(img)}</div>`
  }

  // Vertical (right/left): 1-2 → columna, 3+ → mini-grid 2 cols
  if (isVertical) {
    if (n <= 2) {
      return `<div>${images.map(img => `<div style="aspect-ratio:4/3;overflow:hidden;border-radius:5px;margin-bottom:4px">${imgTag(img)}</div>`).join('')}</div>`
    }
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:${gap}">
      ${images.map(img => cell(img, '1/1')).join('')}
    </div>`
  }

  // Below: grid by count
  if (n === 1) return cell(images[0], '16/9')
  if (n === 2) return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:${gap}">${images.map(img => cell(img)).join('')}</div>`
  if (n === 3) return `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:${gap}">${images.map(img => cell(img)).join('')}</div>`
  if (n === 4) return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:${gap}">${images.map(img => cell(img)).join('')}</div>`
  if (n === 5) return `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:${gap};margin-bottom:${gap}">
      ${images.slice(0, 3).map(img => cell(img, '3/2')).join('')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:${gap}">
      ${images.slice(3, 5).map(img => cell(img, '3/2')).join('')}
    </div>`
  // 6 → 3×2
  return `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:${gap}">${images.map(img => cell(img, '3/2')).join('')}</div>`
}

function buildDayBlock(iso, day) {
  const isoKey = iso.replace(/-/g, '')
  const secRows = SECTIONS.map(s => {
    const sd = day.sections?.[s.key] || {}
    const idPrefix = `${isoKey}_${s.key}`
    return `
    <tr style="break-inside:avoid;page-break-inside:avoid">
      <td style="background:#${s.hex};color:#fff;font-weight:700;font-size:11px;
                 padding:8px 10px;width:140px;vertical-align:top;
                 border:1px solid #ddd;white-space:nowrap">
        ${s.label}<br>
        <span style="font-weight:400;font-size:10px;opacity:.75">${sd.time || s.time}</span>
      </td>
      <td style="padding:10px 14px;vertical-align:top;border:1px solid #ddd;background:#fff">
        ${sectionContent(sd, idPrefix)}
      </td>
    </tr>`
  }).join('')

  return `
  <div class="day-block" style="margin-bottom:20px;border-radius:6px;overflow:hidden;border:2px solid #2E5598">
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

export function buildHtml(content, newsProject) {
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
  @media print {
    body { padding: 0; max-width: 100%; }
    tr   { break-inside: avoid; page-break-inside: avoid; }
    .day-block { break-before: auto; page-break-before: auto; }
    .day-block + .day-block { break-before: page; page-break-before: always; }
    .pdf-fab { display: none !important; }
    .sbd-launch { display: none !important; }
  }
  /* ── SmartBlock Interactive Dialogs ──────────────────────────────── */
  dialog.sbd {
    border: none; border-radius: 12px; padding: 0;
    max-width: 600px; width: 90vw; max-height: 85vh;
    box-shadow: 0 8px 40px rgba(0,0,0,0.30);
  }
  dialog.sbd[open] { display: flex; flex-direction: column; }
  dialog.sbd::backdrop { background: rgba(0,0,0,0.50); }
  .sbd-h {
    flex-shrink: 0;
    color: #fff; padding: 12px 16px;
    display: flex; justify-content: space-between; align-items: center;
    font-weight: 700; font-size: 14px; font-family: Arial, sans-serif;
  }
  .sbd-close {
    background: rgba(255,255,255,0.20); border: none; color: #fff;
    width: 30px; height: 30px; border-radius: 50%;
    cursor: pointer; font-size: 15px; line-height: 1;
  }
  .sbd-b {
    flex: 1; min-height: 0;
    padding: 16px; overflow-y: auto;
    font-family: Arial, sans-serif;
  }
  .sbd-f {
    flex-shrink: 0;
    padding: 10px 16px; border-top: 1px solid #eee;
    display: flex; gap: 8px; align-items: center; justify-content: flex-end;
    font-family: Arial, sans-serif;
  }
  .sbd-launch {
    display: inline-flex; align-items: center; gap: 6px;
    margin-top: 10px; padding: 8px 18px;
    color: #fff; border: none; border-radius: 20px;
    font-size: 12px; font-weight: 700; font-family: Arial, sans-serif;
    cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.20);
    transition: transform .12s, box-shadow .12s;
  }
  .sbd-launch:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.28); }
  .sbd-check {
    padding: 8px 20px; background: #2E5598; color: #fff;
    border: none; border-radius: 6px;
    font-size: 13px; font-weight: 700; font-family: Arial, sans-serif; cursor: pointer;
  }
  .sbd-reset {
    padding: 8px 16px; background: #f0f0f0; color: #555;
    border: none; border-radius: 6px;
    font-size: 13px; font-family: Arial, sans-serif; cursor: pointer;
  }
</style>
</head>
<body>

<!-- Botón flotante Guardar como PDF -->
<button class="pdf-fab" onclick="window.print()" title="Guardar o imprimir como PDF">
  🖨️ Guardar como PDF
</button>
<style>
  .pdf-fab {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 9999;
    padding: 12px 22px;
    background: linear-gradient(135deg, #C0504D 0%, #8B1A1A 100%);
    color: #fff;
    border: none;
    border-radius: 50px;
    font-size: 14px;
    font-weight: 700;
    font-family: Arial, sans-serif;
    cursor: pointer;
    box-shadow: 0 4px 18px rgba(192,80,77,0.5);
    transition: transform .15s, box-shadow .15s;
    letter-spacing: .3px;
  }
  .pdf-fab:hover {
    transform: translateY(-2px) scale(1.03);
    box-shadow: 0 8px 24px rgba(192,80,77,0.6);
  }
  .pdf-fab:active {
    transform: translateY(0) scale(.98);
  }
</style>

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

<!-- Indicadores de Logro -->
${(() => {
  const rawInds = o.indicadores?.length ? o.indicadores : o.indicador ? [o.indicador] : []
  const indicadores = rawInds.map(ind => typeof ind === 'object' ? (ind.texto_es || ind.texto_en || ind.habilidad || '') : (ind || '')).filter(Boolean)
  if (!indicadores.length) return ''
  const indHtml = `<ol style="margin:0;padding-left:18px;font-size:12px;line-height:1.8">${indicadores.map(ind => `<li>${esc(ind)}</li>`).join('')}</ol>`
  const principioRow = o.principio ? `
  <tr>
    <td style="padding:8px 14px;background:#f0f5f0;border-top:1px solid #ddd;
               font-size:11px;color:#555;font-style:italic;border-left:3px solid #9BBB59">
      <strong style="font-style:normal;color:#9BBB59">Principio:</strong> ${esc(o.principio)}
    </td>
  </tr>` : ''
  return `
<table style="width:100%;border:2px solid #2E5598;border-collapse:collapse;margin-bottom:12px">
  <tr>
    <td style="background:#9BBB59;color:#fff;font-weight:700;font-size:12px;
               padding:7px 14px;text-transform:uppercase">
      🎯 Indicadores de Logro
    </td>
  </tr>
  <tr>
    <td style="padding:10px 14px;vertical-align:top;border-top:1px solid #ddd">
      ${indHtml}
    </td>
  </tr>
  ${principioRow}
</table>`
})()}

${(() => {
  if (!newsProject) return ''
  const np = newsProject
  const tb = np.textbook_reference
  const rows = []
  if (np.conditions) rows.push(`<div style="margin-bottom:6px"><strong>Condiciones de entrega:</strong> ${esc(np.conditions)}</div>`)
  if (tb?.book) rows.push(`<div style="margin-bottom:4px"><strong>Libro:</strong> ${esc(tb.book)}</div>`)
  if (tb?.units?.length) rows.push(`<div style="margin-bottom:4px"><strong>Unidades:</strong> ${tb.units.map(esc).join(', ')}</div>`)
  if (tb?.grammar?.length) rows.push(`<div style="margin-bottom:4px"><strong>Gramática:</strong> ${tb.grammar.map(esc).join(', ')}</div>`)
  if (tb?.vocabulary?.length) rows.push(`<div style="margin-bottom:4px"><strong>Vocabulario:</strong> ${tb.vocabulary.map(esc).join(', ')}</div>`)
  if (np.biblical_principle) rows.push(`<div style="margin-bottom:4px"><strong>Principio bíblico:</strong> ${esc(np.biblical_principle)}</div>`)
  if (np.biblical_reflection) rows.push(`<div style="font-style:italic;color:#555;margin-bottom:6px">${esc(np.biblical_reflection)}</div>`)
  const acts = (np.actividades_evaluativas || []).filter(a => a.nombre).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
  if (acts.length) {
    const actRows = acts.map(a => {
      const dateStr = a.fecha ? new Date(a.fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : 'sin fecha'
      return `<span style="display:inline-flex;align-items:center;gap:5px;background:#f0f8f4;border:1px solid #b0d8be;border-radius:5px;padding:2px 8px;margin:2px;font-size:11px"><strong style="color:#1A6B3A">${esc(dateStr)}</strong>${esc(a.nombre)}${a.porcentaje > 0 ? ` <em style="color:#666">${a.porcentaje}%</em>` : ''}</span>`
    }).join('')
    rows.push(`<div style="margin-top:4px"><strong>Actividades evaluativas:</strong><div style="margin-top:4px">${actRows}</div></div>`)
  }
  if (!rows.length) return ''
  return `
<table style="width:100%;border:2px solid #1A6B3A;border-collapse:collapse;margin-bottom:12px">
  <tr>
    <td style="background:#1A6B3A;color:#fff;font-weight:700;font-size:12px;
               padding:7px 14px;text-transform:uppercase">
      📋 Proyecto NEWS — ${esc(np.title || np.skill || '')}
    </td>
  </tr>
  <tr>
    <td style="padding:10px 14px;font-size:12px;line-height:1.6">
      ${rows.join('')}
    </td>
  </tr>
</table>`
})()}

<!-- Versículo -->
${v.text ? `
<div style="background:#FFF8E7;border-left:4px solid #C9A84C;padding:10px 16px;
            border-radius:0 6px 6px 0;margin-bottom:14px;font-style:italic;
            font-size:12px;color:#5a4000;line-height:1.6">
  ${v.text}
  ${v.ref ? `<div style="margin-top:4px"><strong style="font-style:normal;color:#C9A84C">— ${esc(v.ref)}</strong></div>` : ''}
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

export function exportHtml(content, newsProject) {
  const i    = content.info || {}
  const html = buildHtml(content, newsProject)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `Guia_${(i.grado || 'CBF').replace(/\s/g,'_')}_Sem${i.semana || 'X'}.html`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportPdf(content, newsProject) {
  const i    = content.info || {}
  const html = buildHtml(content, newsProject)
  const tip  = `<div id="pdf-tip" style="
    position:fixed;top:12px;right:12px;z-index:9999;
    background:#1F3864;color:#fff;padding:10px 16px;border-radius:8px;
    font-family:Arial,sans-serif;font-size:12px;line-height:1.6;
    box-shadow:0 4px 16px rgba(0,0,0,0.25)">
    🖨️ <strong>Para guardar como PDF:</strong><br>
    En el diálogo de impresión selecciona<br>
    <em>"Guardar como PDF"</em> como destino.
  </div>
  <script>setTimeout(()=>{const e=document.getElementById('pdf-tip');if(e)e.style.display='none'},6000)<\/script>`

  const fullHtml = html.replace('</body>', tip + '</body>')
  const w = window.open('', '_blank')
  if (!w) { alert('Activa las ventanas emergentes para imprimir.'); return }
  w.document.write(fullHtml)
  w.document.close()
  setTimeout(() => w.print(), 900)
}
